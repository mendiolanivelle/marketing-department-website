import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  try {
    const { to, trackingId, projectName, ticketLink } = await req.json()
    if (!to || !trackingId || !ticketLink) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
    }

    const apiKey = Deno.env.get('SENDGRID_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SENDGRID_API_KEY not set' }), { status: 500 })
    }

    const subject = trackingId + ' - ' + (projectName || 'Untitled')
    const textBody = trackingId + ' - ' + (projectName || 'Untitled') + ' Ready for review.\n\nView: ' + ticketLink
    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:0;background:#f4f4f5}.container{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}.header{background:#FF5900;padding:24px 32px;text-align:center}.header h1{color:#fff;margin:0;font-size:18px;font-weight:700}.body{padding:32px}.tracking{color:#FF5900;font-size:20px;font-weight:700;text-align:center;margin:16px 0}.btn{display:inline-block;background:#FF5900;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;margin:16px 0}.footer{padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6}.footer p{color:#9ca3af;font-size:11px;margin:0}</style></head><body><div class="container"><div class="header"><h1>Exodia Game Development</h1></div><div class="body"><div class="tracking">${trackingId}</div><p style="text-align:center">${projectName || 'Untitled'} &mdash; Ready for review.</p><div style="text-align:center"><a href="${ticketLink}" class="btn">View</a></div></div><div class="footer"><p>Exodia Game Development &middot; Marketing Department</p></div></div></body></html>`

    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'maxene_pableo@exodiagamedev.com' },
        subject: subject,
        content: [
          { type: 'text/plain', value: textBody },
          { type: 'text/html', value: htmlBody },
        ],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error('SendGrid error:', err)
      return new Response(JSON.stringify({ error: 'SendGrid error: ' + resp.status }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error('Send error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})