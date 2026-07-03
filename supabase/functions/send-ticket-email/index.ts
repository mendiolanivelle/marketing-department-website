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
    const { to, trackingId, projectName, ticketLink } = await req.json()
    if (!to || !trackingId || !ticketLink) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders })
    }

    const pass = Deno.env.get('SMTP_PASS')
    if (!pass) {
      return new Response(JSON.stringify({ error: 'SMTP_PASS not set' }), { status: 500, headers: corsHeaders })
    }

    const subject = trackingId + ' - ' + (projectName || 'Untitled')
    const textBody = trackingId + ' - ' + (projectName || 'Untitled') + ' Ready for review.\n\nView: ' + ticketLink
    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f7}.container{max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08)}.header{background:linear-gradient(135deg,#FF5900,#FF8C33);padding:32px 40px;text-align:center}.header h1{color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px}.header p{color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;font-weight:400}.body{padding:36px 40px}.status-badge{display:inline-block;background:#FFF7ED;color:#EA580C;font-size:12px;font-weight:600;padding:4px 14px;border-radius:20px;letter-spacing:0.3px;text-transform:uppercase}.tracking-label{font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:20px 0 4px}.tracking-id{font-size:28px;font-weight:800;color:#FF5900;letter-spacing:-0.5px;margin:0 0 4px}.project-name{font-size:16px;color:#1B1A1C;font-weight:600;margin:0 0 20px}.divider{height:1px;background:#F3F4F6;margin:24px 0}.link-section{background:#F9FAFB;border-radius:12px;padding:16px 20px;margin:16px 0}.link-section p{font-size:12px;color:#6B7280;margin:0 0 6px;font-weight:500}.link-section a{color:#FF5900;font-size:13px;word-break:break-all;font-weight:500}.btn{display:inline-block;background:#FF5900;color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;margin:8px 0 0}.footer{padding:20px 40px;text-align:center;border-top:1px solid #F3F4F6}.footer p{color:#9CA3AF;font-size:11px;margin:0;line-height:1.6}</style></head><body><div class="container"><div class="header"><h1>Exodia Game Development</h1><p>Marketing Department</p></div><div class="body"><span class="status-badge">Ready for Review</span><div class="tracking-label">Tracking ID</div><div class="tracking-id">${trackingId}</div><p class="project-name">${projectName || 'Untitled'}</p><div class="divider"></div><div class="link-section"><p>Review Link</p><a href="${ticketLink}">${ticketLink}</a></div><div style="text-align:center"><a href="${ticketLink}" class="btn">Open Ticket</a></div></div><div class="footer"><p>Exodia Game Development &middot; Marketing Department</p><p style="margin-top:4px">If you have any questions, please reply to this email.</p></div></div></body></html>`

    const transporter = createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: 'maxene_pableo@exodiagamedev.com', pass: pass },
    })

    await transporter.sendMail({
      from: 'maxene_pableo@exodiagamedev.com',
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})