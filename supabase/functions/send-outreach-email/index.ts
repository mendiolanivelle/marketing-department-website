import { corsHeaders, json } from '../_shared/http.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) })
  }
  return json(req, { error: 'This endpoint has been retired.' }, 410)
})
