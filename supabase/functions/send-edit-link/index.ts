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
    const { to, name, editLink, title } = await req.json()
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

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:0;background:#f4f4f5}.container{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.header{background:#FF5900;padding:24px 32px;text-align:center}.header h1{color:#fff;margin:0;font-size:18px;font-weight:700}.body{padding:32px;text-align:center}.title{font-size:16px;font-weight:600;color:#1B1A1C;margin:8px 0 16px}.btn{display:inline-block;background:#FF5900;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;margin:8px 0}.footer{padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6}.footer p{color:#9ca3af;font-size:11px;margin:0}.note{font-size:12px;color:#6b7280;margin:16px 0 0}</style></head><body><div class="container"><div class="header"><h1>Exodia Game Development</h1></div><div class="body"><p style="color:#6b7280;font-size:14px;margin:0">Hi ${name},</p><p style="color:#6b7280;font-size:14px">Your marketing request has been received.</p><div class="title">${title || 'Marketing Request'}</div><a href="${editLink}" class="btn">Edit Your Request</a><p class="note">Save this email or bookmark the link to make changes later.</p></div><div class="footer"><p>Exodia Game Development &middot; Marketing Department</p></div></div></body></html>`

    await transporter.sendMail({
      from: fromEmail,
      to: to,
      subject: `Marketing Request Received - ${title || 'Untitled'}`,
      text: `Hi ${name},\n\nYour marketing request has been received.\n\nEdit link: ${editLink}\n\nExodia Game Development - Marketing Department`,
      html: htmlBody,
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})