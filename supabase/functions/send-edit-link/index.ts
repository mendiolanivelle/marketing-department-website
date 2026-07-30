import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createTransport } from 'npm:nodemailer@6.9.16'
import {
  corsHeaders,
  escapeHtml,
  headerText,
  hasOnlyKeys,
  isAllowedOrigin,
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
    return new Response(null, {
      status: isAllowedOrigin(req) ? 204 : 403,
      headers: corsHeaders(req),
    })
  }
  if (!isAllowedOrigin(req)) {
    return json(req, { error: 'Origin not allowed' }, 403)
  }
  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405)
  }

  try {
    const parsed = await readJson(req, 4 * 1024)
    if (parsed.error) return parsed.error
    const payload = parsed.value
    if (!isRecord(payload) || !hasOnlyKeys(payload, ['editToken'])) {
      return json(req, { error: 'Invalid request' }, 400)
    }
    const editToken = text(payload.editToken, 128)
    if (!editToken || !/^[A-Za-z0-9_-]{16,128}$/.test(editToken)) {
      return json(req, { error: 'Invalid request' }, 400)
    }

    const siteUrl = safeHttpUrl(Deno.env.get('PUBLIC_SITE_URL') || '')
    const smtp = smtpConfig()
    const supabase = serviceRoleClient()
    if (!siteUrl || !siteUrl.startsWith('https://') || !smtp || !supabase) {
      return json(req, { error: 'Email service unavailable' }, 503)
    }

    const editTokenHash = await sha256Hex(editToken)
    const claimedAt = new Date().toISOString()
    const resendBefore = new Date(Date.now() - 5 * 60 * 1_000).toISOString()
    let { data: request, error: requestError } = await supabase
      .from('marketing_requests')
      .update({ edit_link_last_sent_at: claimedAt })
      .eq('edit_token_hash', editTokenHash)
      .is('edit_token_revoked_at', null)
      .gt('edit_token_expires_at', claimedAt)
      .or(`edit_link_last_sent_at.is.null,edit_link_last_sent_at.lt.${resendBefore}`)
      .select('email, name, title')
      .maybeSingle()
    let claimed = true
    if (requestError?.code === '42703') {
      const legacy = await supabase
        .from('marketing_requests')
        .select('email, name, title')
        .eq('edit_token', editToken)
        .maybeSingle()
      request = legacy.data
      requestError = legacy.error
      claimed = false
    }
    if (requestError || !request) {
      return json(req, { error: 'Edit-link email is unavailable or was sent recently' }, 429)
    }

    const to = text(request.email, 254)
    const name = text(request.name, 200) || 'there'
    const title = headerText(request.title, 300) || 'Marketing Request'
    if (!to || !isEmail(to)) {
      if (claimed) {
        await supabase
          .from('marketing_requests')
          .update({ edit_link_last_sent_at: null })
          .eq('edit_token_hash', editTokenHash)
          .eq('edit_link_last_sent_at', claimedAt)
      }
      return json(req, { error: 'Request is incomplete' }, 409)
    }
    const editLink = new URL(`/#/edit-request/${encodeURIComponent(editToken)}`, siteUrl).toString()

    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    })

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:0;background:#f4f4f5}.container{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.header{background:#FF5900;padding:24px 32px;text-align:center}.header h1{color:#fff;margin:0;font-size:18px;font-weight:700}.body{padding:32px;text-align:center}.title{font-size:16px;font-weight:600;color:#1B1A1C;margin:8px 0 16px}.btn{display:inline-block;background:#FF5900;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;margin:8px 0}.footer{padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6}.footer p{color:#9ca3af;font-size:11px;margin:0}.note{font-size:12px;color:#6b7280;margin:16px 0 0}</style></head><body><div class="container"><div class="header"><h1>Exodia Game Development</h1></div><div class="body"><p style="color:#6b7280;font-size:14px;margin:0">Hi ${escapeHtml(name)},</p><p style="color:#6b7280;font-size:14px">Your marketing request has been received.</p><div class="title">${escapeHtml(title)}</div><a href="${escapeHtml(editLink)}" class="btn">Edit Your Request</a><p class="note">Save this email or bookmark the link to make changes later.</p></div><div class="footer"><p>Exodia Game Development &middot; Marketing Department</p></div></div></body></html>`

    try {
      await transporter.sendMail({
        from: smtp.from,
        to: to,
        subject: `Marketing Request Received - ${title}`,
        text: `Hi ${name},\n\nYour marketing request has been received.\n\nEdit link: ${editLink}\n\nExodia Game Development - Marketing Department`,
        html: htmlBody,
      })
    } catch (error) {
      if (claimed) {
        await supabase
          .from('marketing_requests')
          .update({ edit_link_last_sent_at: null })
          .eq('edit_token_hash', editTokenHash)
          .eq('edit_link_last_sent_at', claimedAt)
      }
      throw error
    }

    return json(req, { success: true })
  } catch (error) {
    console.error('send-edit-link failed', error)
    return json(req, { error: 'Email could not be sent' }, 500)
  }
})
