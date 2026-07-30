import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  authenticatedClient,
  corsHeaders,
  hasOnlyKeys,
  isRecord,
  json,
  readJson,
  text,
} from '../_shared/http.ts'

const isSowCostingColumn = (label = '') => {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  return ['sow', 'costing', 'creation'].every((term) => normalized.includes(term))
}

const getServiceKey = () => {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys)
    if (parsed.default) return parsed.default
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405)
  }

  try {
    if (!await authenticatedClient(req, 'sales@exodiagamedev.com')) {
      return json(req, { error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = getServiceKey()

    if (!supabaseUrl || !serviceKey) {
      return json(req, { error: 'Sync service unavailable' }, 503)
    }

    const parsed = await readJson(req, 4 * 1024)
    if (parsed.error) return parsed.error
    const payload = parsed.value
    if (!isRecord(payload) || !hasOnlyKeys(payload, ['leadId'])) {
      return json(req, { error: 'Invalid request' }, 400)
    }
    const leadId = text(payload.leadId, 36)
    if (!leadId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leadId)) {
      return json(req, { error: 'Invalid leadId' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('timeline_leads')
      .select('id, table_id, company, contact, email, value, date, column_key, notes')
      .eq('id', leadId)
      .single()

    if (leadError) throw leadError

    const { data: table, error: tableError } = await supabaseAdmin
      .from('timeline_tables')
      .select('columns')
      .eq('id', lead.table_id)
      .single()

    if (tableError) throw tableError

    const columns = Array.isArray(table.columns) ? table.columns : JSON.parse(table.columns || '[]')
    const targetColumn = columns.find((column: { key: string }) => column.key === lead.column_key)

    if (!targetColumn || !isSowCostingColumn(targetColumn.label)) {
      return json(req, { synced: false, reason: 'Lead is not in SOW and costing creation' })
    }

    const clientKey = `${String(lead.company || '').trim()}|${String(lead.contact || '').trim()}`.toLowerCase()
    if (!clientKey || clientKey === '|') {
      return json(req, { error: 'Lead company and contact are required' }, 400)
    }

    const email = String(lead.email || '').trim()
    const syncedNotes = [
      `Auto-synced from marketing timeline stage: ${targetColumn.label || 'SOW and Costing Creation'}`,
      `Lead value: ${lead.value || ''}`,
      `Lead date: ${lead.date || ''}`,
      lead.notes || '',
    ].filter(Boolean).join('\n\n')

    let clientId: string | undefined
    const { data: keyClients, error: keyClientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('client_key', clientKey)
      .order('created_at', { ascending: true })
      .limit(1)

    if (keyClientError) throw keyClientError
    clientId = keyClients?.[0]?.id

    if (!clientId && email) {
      const { data: emailClients, error: emailClientError } = await supabaseAdmin
        .from('clients')
        .select('id')
        .ilike('contact_email', email)
        .order('created_at', { ascending: true })
        .limit(1)

      if (emailClientError) throw emailClientError
      clientId = emailClients?.[0]?.id
    }

    const clientPayload = {
      client_key: clientKey,
      contact_name: lead.contact,
      contact_email: email || null,
      company_name: lead.company,
      updated_at: new Date().toISOString(),
    }

    if (clientId) {
      const { error: clientUpdateError } = await supabaseAdmin
        .from('clients')
        .update(clientPayload)
        .eq('id', clientId)

      if (clientUpdateError) throw clientUpdateError
    } else {
      const { data: createdClients, error: clientInsertError } = await supabaseAdmin
        .from('clients')
        .insert([clientPayload])
        .select('id')
        .single()

      if (clientInsertError) throw clientInsertError
      clientId = createdClients.id
    }

    const { data: forwards, error: forwardLookupError } = await supabaseAdmin
      .from('marketing_forwards')
      .select('id')
      .eq('client_id', clientId)
      .order('forwarded_at', { ascending: true })
      .limit(1)

    if (forwardLookupError) throw forwardLookupError

    if (forwards?.[0]?.id) {
      const { error: forwardUpdateError } = await supabaseAdmin
        .from('marketing_forwards')
        .update({
          forwarded_by: 'Marketing Timeline',
          marketing_notes: syncedNotes,
        })
        .eq('id', forwards[0].id)

      if (forwardUpdateError) throw forwardUpdateError
    } else {
      const { error: forwardInsertError } = await supabaseAdmin
        .from('marketing_forwards')
        .insert([{
          client_id: clientId,
          forwarded_by: 'Marketing Timeline',
          marketing_notes: syncedNotes,
          status: 'pending',
        }])

      if (forwardInsertError) throw forwardInsertError
    }

    return json(req, { synced: true, clientId })
  } catch (error) {
    console.error('sync-sow-timeline-lead failed', error)
    return json(req, { error: 'Sync failed' }, 500)
  }
})
