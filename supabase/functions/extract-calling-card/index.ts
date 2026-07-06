import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    company: { type: 'string' },
    role: { type: 'string' },
    email: { type: 'string' },
    contact_number: { type: 'string' },
    address: { type: 'string' },
    notes: { type: 'string' },
    raw_text: { type: 'string' },
  },
  required: ['name', 'company', 'role', 'email', 'contact_number', 'address', 'notes', 'raw_text'],
}

function extractOutputText(response: any) {
  if (typeof response.output_text === 'string') return response.output_text
  const textParts: string[] = []
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') textParts.push(content.text)
    }
  }
  return textParts.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { image } = await req.json()
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'Missing image data URL' }), { status: 400, headers: corsHeaders })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), { status: 500, headers: corsHeaders })
    }

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.5'
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'low' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'calling_card_lead',
            strict: true,
            schema,
          },
        },
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: 'Extract business card lead details from the image. Return only information visible on the card. Use empty strings for missing fields. Do not guess names or contact details. Put extra useful visible text in notes.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Read this calling card and extract the contact fields.',
              },
              {
                type: 'input_image',
                image_url: image,
                detail: 'high',
              },
            ],
          },
        ],
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: payload.error?.message || 'OpenAI extraction failed' }), { status: response.status, headers: corsHeaders })
    }

    const outputText = extractOutputText(payload)
    const parsed = JSON.parse(outputText)

    return new Response(JSON.stringify({ lead: parsed }), { status: 200, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to extract calling card' }), { status: 500, headers: corsHeaders })
  }
})
