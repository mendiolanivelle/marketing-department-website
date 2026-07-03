import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createTransport } from 'npm:nodemailer@6.9.16'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, name, editLink, title, links, tracking_id, priority, description } = await req.json()
    if (!to || !editLink) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders })
    }

    const fromEmail = Deno.env.get('FROM_EMAIL') || 'maxene_pableo@exodiagamedev.com'
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('SMTP_USER') || fromEmail
    const smtpPass = Deno.env.get('SMTP_PASS')

    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })

    const linksHtml = links && links.length > 0
      ? `<ul style="margin:4px 0 0;padding-left:20px">${links.map((l: string) => `<li style="font-size:13px;color:#FF5900;margin:2px 0">${l}</li>`).join('')}</ul>`
      : '<p style="font-size:13px;color:#9CA3AF;font-style:italic;margin:4px 0 0">(No file links attached)</p>'

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:0;background:#f4f4f5}.container{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.header{background:#FF5900;padding:24px 32px;text-align:center}.header h1{color:#fff;margin:0;font-size:18px;font-weight:700}.body{padding:32px}.summary{background:#F3F4F6;padding:16px;border-radius:8px;margin:12px 0}.summary p{margin:4px 0;font-size:13px;color:#4B5563}.section-title{font-size:14px;font-weight:700;color:#1B1A1C;margin:16px 0 4px}.footer{padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6}.footer p{color:#9ca3af;font-size:11px;margin:0}</style></head><body><div class="container"><div class="header"><h1>Exodia Game Development</h1></div><div class="body"><p style="font-size:14px;color:#4B5563;margin:0">Hi ${name},</p><p style="font-size:14px;color:#4B5563;margin:12px 0 0">Great news! The Marketing team has completed your request.</p><div class="summary"><p style="font-weight:700;margin:0 0 8px;font-size:13px;color:#1B1A1C">📋 Request Summary</p><p style="font-size:13px;color:#4B5563;margin:4px 0">Tracking ID: <span style="color:#FF5900;font-weight:600">${tracking_id || '—'}</span></p><p style="font-size:13px;color:#4B5563;margin:4px 0">Project Name: ${title}</p><p style="font-size:13px;color:#4B5563;margin:4px 0">Original Priority: ${priority || '—'}</p></div><p class="section-title">Final Deliverables</p><p style="font-size:13px;color:#4B5563;margin:0">Please find your completed assets at the links below:</p>${linksHtml}<p class="section-title">📝 Delivery Notes from the Team</p><p style="font-size:13px;color:#4B5563;margin:4px 0">${description || 'Your request has been completed.'}</p><p style="font-size:13px;color:#4B5563;margin:12px 0 0">If you need any minor tweaks, just reply to this email or message us on the internal portal.</p></div><div class="footer"><p>Exodia Game Development &middot; Marketing Department</p></div></div></body></html>`

    await transporter.sendMail({
      from: fromEmail,
      to: to,
      subject: `[Completed] ${tracking_id || ''}: ${title || 'Untitled'}`,
      text: `Hi ${name},\n\nGreat news! The Marketing team has completed your request.\n\n📋 Request Summary\nTracking ID: ${tracking_id || '—'}\nProject Name: ${title}\nOriginal Priority: ${priority || '—'}\n\nFinal Deliverables\nPlease find your completed assets at the links below:\n${links && links.length > 0 ? links.map((l: string) => `- ${l}`).join('\n') : '(No file links attached)'}\n\n📝 Delivery Notes from the Team\n${description || 'Your request has been completed.'}\n\nIf you need any minor tweaks, just reply to this email or message us on the internal portal.\n\nExodia Game Development - Marketing Department`,
      html: htmlBody,
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})