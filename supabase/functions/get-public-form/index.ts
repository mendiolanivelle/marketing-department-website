import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { authenticatedClient, corsHeaders, json, text } from '../_shared/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req, 'GET, OPTIONS') })
  }
  if (req.method !== 'GET') {
    return json(req, { error: 'Method not allowed' }, 405)
  }

  try {
    const supabase = await authenticatedClient(req)
    if (!supabase) {
      return json(req, { error: 'Unauthorized' }, 401)
    }

    const url = new URL(req.url)
    const id = text(url.searchParams.get('id'), 100)

    if (!id) {
      return json(req, { error: 'Missing id parameter' }, 400)
    }

    const { data, error } = await supabase
      .from('acceptance_forms')
      .select('id, tracking_id, project_name, client_name, project_type, created_at')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('get-public-form query failed', error.code)
      return json(req, { error: 'Form could not be loaded' }, 500)
    }

    if (!data) {
      return json(req, { error: 'Form not found' }, 404)
    }

    return json(req, data)
  } catch (error) {
    console.error('get-public-form failed', error)
    return json(req, { error: 'Form could not be loaded' }, 500)
  }
})
