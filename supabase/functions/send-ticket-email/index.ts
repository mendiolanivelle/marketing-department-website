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
    body{margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    .outer{max-width:560px;margin:0 auto;padding:24px 16px}
    .card{background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e8e8ec;box-shadow:0 8px 30px rgba(0,0,0,0.06)}
    .header{background:linear-gradient(135deg,#FF5900 0%,#FF8C33 60%,#FFB366 100%);padding:36px 40px 32px;text-align:center;position:relative}
    .header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.15)}
    .header-icon{width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:24px}
    .header h1{margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px}
    .header p{margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:400;letter-spacing:0.2px}
    .body{padding:36px 40px 32px}
    .badge{display:inline-flex;align-items:center;gap:6px;background:#FFF7ED;color:#C2410C;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:20px;border:1px solid #FFEDD5}
    .badge-dot{width:6px;height:6px;border-radius:50%;background:#EA580C;display:inline-block;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .intro{font-size:15px;color:#374151;line-height:1.7;margin:0 0 28px;font-weight:400}
    .details{background:linear-gradient(135deg,#FF590006 0%,#FF8C3306 100%);border:1px solid #FFEDD5;border-radius:16px;padding:24px;margin-bottom:28px}
    .details-row{display:flex;align-items:flex-start;padding:10px 0;border-bottom:1px solid #FFF7ED}
    .details-row:last-child{border-bottom:none;padding-bottom:0}
    .details-row:first-child{padding-top:0}
    .details-label{flex:0 0 110px;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:600;line-height:1.8}
    .details-value{font-size:20px;font-weight:800;color:#FF5900;margin:0;letter-spacing:-0.4px;line-height:1.4}
    .details-value-text{font-size:15px;color:#1B1A1C;font-weight:500;margin:0;line-height:1.6}
    .divider{height:1px;background:linear-gradient(90deg,transparent,#F3F4F6 20%,#F3F4F6 80%,transparent);margin:24px 0 28px}
    .btn-wrap{text-align:center;margin:0 0 16px}
    .btn{display:inline-block;background:linear-gradient(135deg,#FF5900,#FF8C33);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:14px;font-size:16px;font-weight:700;box-shadow:0 6px 20px rgba(255,89,0,0.3);transition:all 0.2s}
    .btn:hover{box-shadow:0 8px 28px rgba(255,89,0,0.4)}
    .fallback-wrap{text-align:center;background:#F9FAFB;border-radius:10px;padding:12px 16px;margin:0 0 4px}
    .fallback-label{font-size:11px;color:#9CA3AF;display:block;margin-bottom:4px;font-weight:500}
    .fallback-link{font-size:12px;color:#FF5900;font-weight:500;word-break:break-all;text-decoration:none}
    .fallback-link:hover{text-decoration:underline}
    .footer{padding:24px 40px;text-align:center;border-top:1px solid #F3F4F6;background:#FAFAFA}
    .footer-logo{font-size:13px;color:#1B1A1C;font-weight:700;margin:0 0 4px}
    .footer p{margin:0;color:#9CA3AF;font-size:12px;line-height:1.7}
    .footer-divider{width:40px;height:2px;background:#FF5900;border-radius:2px;margin:10px auto}
  </style>
</head>
<body>
  <div class="outer">
    <div class="card">
      <div class="header">
        <div class="header-icon">&#x1F4E8;</div>
        <h1>Exodia Game Development</h1>
        <p>Marketing Department &middot; Acceptance Criteria</p>
      </div>
      <div class="body">
        <span class="badge"><span class="badge-dot"></span> Ready for Review</span>
        <p class="intro">A new Acceptance Criteria has been forwarded for your review. Please check the details below and access the full form through the operations portal.</p>
        <div class="details">
          <div class="details-row">
            <span class="details-label">Tracking ID</span>
            <span class="details-value">${trackingId}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Project</span>
            <span class="details-value-text">${projectName || 'Untitled'}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Date</span>
            <span class="details-value-text">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="btn-wrap">
          <a href="${ticketLink}" class="btn">&#x1F513; Open Ticket</a>
        </div>
        <div class="fallback-wrap">
          <span class="fallback-label">Or copy the link below</span>
          <a href="${ticketLink}" class="fallback-link">${ticketLink}</a>
        </div>
      </div>
      <div class="footer">
        <p class="footer-logo">Exodia Game Development</p>
        <div class="footer-divider"></div>
        <p>Marketing Department</p>
        <p style="margin-top:6px;font-size:11px;color:#B0B0B8">This is an automated notification. Please do not reply directly to this email.</p>
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