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
    const { to, name, subject, body, inReplyTo, customMessageId } = await req.json()
    if (!to || !subject) {
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

    const mailOptions: any = {
      from: fromEmail,
      to: to,
      subject: subject,
      text: body || '',
      html: body ? body.replace(/\n/g, '<br>') : '',
    }

    if (customMessageId) {
      mailOptions.messageId = customMessageId
    }

    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo
      mailOptions.references = [inReplyTo]
    }

    const info = await transporter.sendMail(mailOptions)

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})