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
    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
    .outer{max-width:560px;margin:0 auto;padding:24px 16px}
    .card{background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eceef2}
    .header{background:linear-gradient(135deg,#FF5900,#FF8C33);padding:32px 40px;text-align:center}
    .header h1{margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px}
    .header p{margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:400}
    .body{padding:32px 40px}
    .badge{display:inline-block;background:#FFF7ED;color:#EA580C;font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px}
    .intro{font-size:15px;color:#1B1A1C;line-height:1.6;margin:0 0 24px;font-weight:400}
    .details{background:#F9FAFB;border-radius:14px;padding:20px 24px;margin-bottom:24px}
    .details-row{margin-bottom:14px}
    .details-row:last-child{margin-bottom:0}
    .details-label{font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 2px}
    .details-value{font-size:18px;font-weight:700;color:#FF5900;margin:0;letter-spacing:-0.3px}
    .details-value-text{font-size:15px;color:#1B1A1C;font-weight:500;margin:0}
    .divider{height:1px;background:#F3F4F6;margin:24px 0}
    .btn-wrap{text-align:center;margin:24px 0 12px}
    .btn{display:inline-block;background:#FF5900;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(255,89,0,0.25)}
    .fallback-link{text-align:center;font-size:12px;color:#9CA3AF;margin:8px 0 0}
    .fallback-link a{color:#FF5900;font-weight:500;word-break:break-all}
    .footer{padding:20px 40px;text-align:center;border-top:1px solid #F3F4F6}
    .footer p{margin:0;color:#9CA3AF;font-size:11px;line-height:1.6}
  </style>
</head>
<body>
  <div class="outer">
    <div class="card">
      <div class="header">
        <h1>Exodia Game Development</h1>
        <p>Marketing Department</p>
      </div>
      <div class="body">
        <span class="badge">Ready for Review</span>
        <p class="intro">A new Acceptance Criteria has been forwarded for your review. Please check the details and access the full form below.</p>
        <div class="details">
          <div class="details-row">
            <p class="details-label">Tracking ID</p>
            <p class="details-value">${trackingId}</p>
          </div>
          <div class="details-row">
            <p class="details-label">Project</p>
            <p class="details-value-text">${projectName || 'Untitled'}</p>
          </div>
          <div class="details-row">
            <p class="details-label">Date Forwarded</p>
            <p class="details-value-text">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
        <div class="divider"></div>
        <div class="btn-wrap">
          <a href="${ticketLink}" class="btn">Open Ticket</a>
        </div>
        <p class="fallback-link">Or copy the link: <a href="${ticketLink}">${ticketLink}</a></p>
      </div>
      <div class="footer">
        <p>Exodia Game Development &middot; Marketing Department</p>
        <p style="margin-top:4px">This is an automated notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`

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