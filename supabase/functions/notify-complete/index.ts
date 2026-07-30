import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createTransport } from 'npm:nodemailer@6.9.16'
import {
  authenticatedClient,
  corsHeaders,
  escapeHtml,
  headerText,
  hasOnlyKeys,
  isEmail,
  isRecord,
  json,
  readJson,
  safeHttpUrl,
  serviceRoleClient,
  sha256Hex,
  smtpConfig,
  text,
} from '../_shared/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) })
  }
  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405)
  }

  try {
    const client = await authenticatedClient(req)
    if (!client) {
      return json(req, { error: 'Unauthorized' }, 401)
    }

    const parsed = await readJson(req, 64 * 1024)
    if (parsed.error) return parsed.error
    const payload = parsed.value
    const allowed = ['source', 'recordId', 'links', 'description']
    if (!isRecord(payload) || !hasOnlyKeys(payload, allowed)) {
      return json(req, { error: 'Invalid request' }, 400)
    }

    const source = payload.source === 'campaigns' || payload.source === 'marketing_requests'
      ? payload.source
      : null
    const recordId = payload.recordId
    if (!source || !Number.isSafeInteger(recordId) || Number(recordId) <= 0) {
      return json(req, { error: 'Invalid record' }, 400)
    }

    const columns = source === 'campaigns'
      ? 'requester_email, requester_name, name, tracking_id, priority, description'
      : 'email, name, title, tracking_id, priority, description'
    const { data: record, error: recordError } = await client
      .from(source)
      .select(columns)
      .eq('id', recordId)
      .maybeSingle()
    if (recordError || !record) {
      return json(req, { error: 'Record not found' }, 404)
    }

    const to = text(source === 'campaigns' ? record.requester_email : record.email, 254)
    const name = text(source === 'campaigns' ? record.requester_name : record.name, 200) || 'there'
    const title = headerText(source === 'campaigns' ? record.name : record.title, 300)
    const trackingId = headerText(record.tracking_id, 100) || ''
    const priority = text(record.priority, 100) || ''
    const requestedDescription = payload.description === undefined
      ? undefined
      : text(payload.description, 5_000)
    const description = requestedDescription ||
      text(record.description, 5_000) ||
      'Your request has been completed.'
    const links = Array.isArray(payload.links) && payload.links.length <= 20
      ? payload.links.map((link) => typeof link === 'string' && link.length <= 2_048 ? safeHttpUrl(link) : null)
      : null
    if (!to || !isEmail(to) || !title || requestedDescription === null || !links ||
      links.some((link) => !link || !link.startsWith('https://'))) {
      return json(req, { error: 'Stored record or delivery details are invalid' }, 409)
    }

    const smtp = smtpConfig()
    if (!smtp) {
      return json(req, { error: 'Email service unavailable' }, 503)
    }
    const deliveryClient = serviceRoleClient()
    if (!deliveryClient) {
      return json(req, { error: 'Delivery ledger unavailable' }, 503)
    }
    const payloadHash = await sha256Hex(JSON.stringify({
      description,
      links,
      name,
      priority,
      title,
      to,
      trackingId,
    }))
    const deliveryKey = {
      source,
      source_record_id: recordId,
      payload_hash: payloadHash,
    }
    const { error: claimError } = await deliveryClient
      .from('completion_notification_deliveries')
      .insert(deliveryKey)
    if (claimError) {
      if (claimError.code !== '23505') {
        console.error('notify-complete claim failed', claimError.code)
        return json(req, { error: 'Delivery could not be reserved' }, 500)
      }
      const { data: existing, error: existingError } = await deliveryClient
        .from('completion_notification_deliveries')
        .select('status')
        .match(deliveryKey)
        .maybeSingle()
      if (existingError || !existing) {
        return json(req, { error: 'Delivery state could not be resolved' }, 500)
      }
      if (existing.status === 'Sent') {
        return json(req, { success: true, alreadySent: true, deliveryRecorded: true })
      }
      return json(req, { error: 'Delivery state requires administrator review' }, 409)
    }

    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    })

    const linksHtml = links.length > 0
      ? `<ul style="margin:4px 0 0;padding-left:20px">${links.map((link) => `<li style="font-size:13px;color:#FF5900;margin:2px 0">${escapeHtml(link!)}</li>`).join('')}</ul>`
      : '<p style="font-size:13px;color:#9CA3AF;font-style:italic;margin:4px 0 0">(No file links attached)</p>'

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:0;background:#f4f4f5}.container{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.header{background:#FF5900;padding:24px 32px;text-align:center}.header h1{color:#fff;margin:0;font-size:18px;font-weight:700}.body{padding:32px}.summary{background:#F3F4F6;padding:16px;border-radius:8px;margin:12px 0}.summary p{margin:4px 0;font-size:13px;color:#4B5563}.section-title{font-size:14px;font-weight:700;color:#1B1A1C;margin:16px 0 4px}.footer{padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6}.footer p{color:#9ca3af;font-size:11px;margin:0}</style></head><body><div class="container"><div class="header"><h1>Exodia Game Development</h1></div><div class="body"><p style="font-size:14px;color:#4B5563;margin:0">Hi ${escapeHtml(name)},</p><p style="font-size:14px;color:#4B5563;margin:12px 0 0">Great news! The Marketing team has completed your request.</p><div class="summary"><p style="font-weight:700;margin:0 0 8px;font-size:13px;color:#1B1A1C">📋 Request Summary</p><p style="font-size:13px;color:#4B5563;margin:4px 0">Tracking ID: <span style="color:#FF5900;font-weight:600">${escapeHtml(trackingId || '—')}</span></p><p style="font-size:13px;color:#4B5563;margin:4px 0">Project Name: ${escapeHtml(title)}</p><p style="font-size:13px;color:#4B5563;margin:4px 0">Original Priority: ${escapeHtml(priority || '—')}</p></div><p class="section-title">Final Deliverables</p><p style="font-size:13px;color:#4B5563;margin:0">Please find your completed assets at the links below:</p>${linksHtml}<p class="section-title">📝 Delivery Notes from the Team</p><p style="font-size:13px;color:#4B5563;margin:4px 0">${escapeHtml(description)}</p><p style="font-size:13px;color:#4B5563;margin:12px 0 0">If you need any minor tweaks, just reply to this email or message us on the internal portal.</p></div><div class="footer"><p>Exodia Game Development &middot; Marketing Department</p></div></div></body></html>`

    await transporter.sendMail({
      from: smtp.from,
      to: to,
      subject: `[Completed] ${trackingId}: ${title}`,
      text: `Hi ${name},\n\nGreat news! The Marketing team has completed your request.\n\n📋 Request Summary\nTracking ID: ${trackingId || '—'}\nProject Name: ${title}\nOriginal Priority: ${priority || '—'}\n\nFinal Deliverables\nPlease find your completed assets at the links below:\n${links.length > 0 ? links.map((link) => `- ${link}`).join('\n') : '(No file links attached)'}\n\n📝 Delivery Notes from the Team\n${description}\n\nIf you need any minor tweaks, just reply to this email or message us on the internal portal.\n\nExodia Game Development - Marketing Department`,
      html: htmlBody,
    })

    const { data: recorded, error: deliveryRecordError } = await deliveryClient
      .from('completion_notification_deliveries')
      .update({ status: 'Sent', sent_at: new Date().toISOString() })
      .match(deliveryKey)
      .eq('status', 'Sending')
      .select('source')
      .maybeSingle()
    if (deliveryRecordError || !recorded) {
      console.error('notify-complete delivery update failed', deliveryRecordError?.code || 'no-row')
      return json(req, { success: true, deliveryRecorded: false }, 202)
    }

    return json(req, { success: true, deliveryRecorded: true })
  } catch (error) {
    console.error('notify-complete failed', error)
    return json(req, { error: 'Email could not be sent' }, 500)
  }
})
