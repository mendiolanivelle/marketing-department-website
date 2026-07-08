import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createTransport } from 'npm:nodemailer@6.9.16'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const stripHtml = (value: string) =>
  value.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, name, subject, body, inReplyTo, references, messageId } = await req.json()
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

    const emailBody = body || ''
    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(emailBody)
    const mailOptions: any = {
      from: fromEmail,
      to: to,
      subject: subject,
      text: hasHtml ? stripHtml(emailBody) : emailBody,
      html: hasHtml ? emailBody : escapeHtml(emailBody).replace(/\n/g, '<br>'),
      headers: {
        'Message-ID': messageId,
      },
    }

    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo
      mailOptions.references = references || inReplyTo
    }

    const info = await transporter.sendMail(mailOptions)

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
