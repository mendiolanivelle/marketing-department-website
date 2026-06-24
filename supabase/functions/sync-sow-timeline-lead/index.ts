import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = getServiceKey()

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ error: 'Supabase function secrets are missing' }, { status: 500, headers: corsHeaders })
    }

    const { leadId } = await req.json()
    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('timeline_leads')
      .select('*')
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
      return Response.json({ synced: false, reason: 'Lead is not in SOW and costing creation' }, { headers: corsHeaders })
    }

    const clientKey = `${String(lead.company || '').trim()}|${String(lead.contact || '').trim()}`.toLowerCase()
    if (!clientKey || clientKey === '|') {
      return Response.json({ error: 'Lead company and contact are required' }, { status: 400, headers: corsHeaders })
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

    return Response.json({ synced: true, clientId }, { headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error.message || 'Sync failed' }, { status: 500, headers: corsHeaders })
  }
})
