import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const SMTP_HOST = Deno.env.get('SMTP_HOST') || ''
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587')
const SMTP_USER = Deno.env.get('SMTP_USER') || ''
const SMTP_PASS = Deno.env.get('SMTP_PASS') || ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || ''

serve(async (req) => {
  try {
    const { to, trackingId, projectName, ticketLink } = await req.json()

    if (!to || !trackingId || !ticketLink) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, trackingId, ticketLink' }), { status: 400 })
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !FROM_EMAIL) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), { status: 500 })
    }

    const subject = trackingId + ' - ' + (projectName || 'Untitled')
    const bodyText = trackingId + ' - ' + (projectName || 'Untitled') + ' Ready for review.'

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background-color: #FF5900; padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 32px; }
    .body p { color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
    .tracking { color: #FF5900; font-size: 20px; font-weight: 700; text-align: center; margin: 16px 0; }
    .btn { display: inline-block; background-color: #FF5900; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-size: 14px; font-weight: 600; margin: 16px 0; }
    .footer { padding: 16px 32px; text-align: center; border-top: 1px solid #f3f4f6; }
    .footer p { color: #9ca3af; font-size: 11px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Exodia Game Development</h1>
    </div>
    <div class="body">
      <div class="tracking">` + trackingId + `</div>
      <p style="text-align:center">` + (projectName || 'Untitled') + ` &mdash; Ready for review.</p>
      <div style="text-align:center">
        <a href="` + ticketLink + `" class="btn">View</a>
      </div>
    </div>
    <div class="footer">
      <p>Exodia Game Development &middot; Marketing Department</p>
    </div>
  </div>
</body>
</html>`

    const smtp = await import('https://deno.land/x/smtp@v0.7.0/mod.ts')
    const client = new smtp.SmtpClient()

    await client.connectTLS({
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      username: SMTP_USER,
      password: SMTP_PASS,
    })

    await client.send({
      from: FROM_EMAIL,
      to: to,
      subject: subject,
      content: bodyText,
      html: html,
    })

    await client.close()

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error('Send error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})