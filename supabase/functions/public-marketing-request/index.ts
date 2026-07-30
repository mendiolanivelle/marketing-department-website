import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import {
  boundedStringArray,
  corsHeaders,
  hasOnlyKeys,
  isAllowedOrigin,
  isEmail,
  isRecord,
  isoDate,
  json,
  optionalText,
  readJson,
  requiredText,
  safeHttpUrl,
  serviceRoleClient,
  sha256Hex,
  signedEditToken,
  text,
  verifyTurnstile,
} from '../_shared/http.ts'

const REQUEST_KEYS = [
  'name',
  'department',
  'email',
  'title',
  'campaign',
  'description',
  'request_type',
  'platforms',
  'audience',
  'resource_links',
  'date_needed',
  'priority',
  'management_approval',
]
const DEPARTMENTS = new Set([
  'HR Department',
  'Operations Department',
  'Finance Department',
  'Sales Department',
  'IT Department',
  'Facilities Department',
])
const REQUEST_TYPES = new Set(['Social Media', 'Print', 'Video', 'Photo', 'Other'])
const PRIORITIES = new Set(['Low', 'Standard', 'High', 'Rush'])
const APPROVALS = new Set(['Yes', 'No', 'Pending'])
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EDIT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1_000

type MarketingRequestWrite = {
  name: string
  department: string
  email: string
  title: string
  campaign: string | null
  description: string | null
  request_type: string[]
  platforms: string | null
  audience: string | null
  resource_links: string
  date_needed: string
  priority: string
  management_approval: string
}

function parseRequest(value: unknown): MarketingRequestWrite | null {
  if (!isRecord(value) || !hasOnlyKeys(value, REQUEST_KEYS)) return null

  const name = requiredText(value.name, 200)
  const department = requiredText(value.department, 100)
  const email = requiredText(value.email, 254)
  const title = requiredText(value.title, 300)
  const campaign = optionalText(value.campaign, 300)
  const description = optionalText(value.description, 5_000)
  const requestTypes = boundedStringArray(value.request_type, 6, 100)
  const platforms = optionalText(value.platforms, 1_000)
  const audience = optionalText(value.audience, 3_000)
  const resourceLinks = boundedStringArray(value.resource_links, 10, 2_048)
  const dateNeeded = isoDate(value.date_needed)
  const priority = requiredText(value.priority, 20)
  const managementApproval = requiredText(value.management_approval, 20)

  if (
    !name || !department || !DEPARTMENTS.has(department) ||
    !email || !isEmail(email) ||
    !title || campaign === null || description === null ||
    !requestTypes ||
    requestTypes.some((type) =>
      !REQUEST_TYPES.has(type) && !(type.startsWith('Other: ') && type.length > 'Other: '.length)
    ) ||
    platforms === null || audience === null || !resourceLinks ||
    !dateNeeded || !priority || !PRIORITIES.has(priority) ||
    !managementApproval || !APPROVALS.has(managementApproval)
  ) return null

  const normalizedLinks = resourceLinks.map(safeHttpUrl)
  if (normalizedLinks.some((link) => link === null)) return null

  return {
    name,
    department,
    email,
    title,
    campaign: campaign || null,
    description: description || null,
    request_type: requestTypes,
    platforms: platforms || null,
    audience: audience || null,
    resource_links: (normalizedLinks as string[]).join(', '),
    date_needed: dateNeeded,
    priority,
    management_approval: managementApproval,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: isAllowedOrigin(req) ? 204 : 403,
      headers: corsHeaders(req),
    })
  }
  if (!isAllowedOrigin(req)) {
    return json(req, { error: 'Origin not allowed' }, 403)
  }
  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405)
  }

  try {
    const parsed = await readJson(req, 128 * 1024)
    if (parsed.error) return parsed.error
    if (!isRecord(parsed.value)) return json(req, { error: 'Invalid request' }, 400)

    const payload = parsed.value
    const action = text(payload.action, 10)
    const editToken = text(payload.editToken, 128)
    const supabase = serviceRoleClient()
    if (!supabase) return json(req, { error: 'Request service unavailable' }, 503)

    if (action === 'load') {
      if (!hasOnlyKeys(payload, ['action', 'editToken']) || !editToken || !TOKEN_PATTERN.test(editToken)) {
        return json(req, { error: 'Invalid request' }, 400)
      }
      const editTokenHash = await sha256Hex(editToken)
      let { data, error } = await supabase
        .from('marketing_requests')
        .select('tracking_id, name, department, email, title, campaign, description, request_type, platforms, audience, resource_links, date_needed, priority, management_approval')
        .eq('edit_token_hash', editTokenHash)
        .is('edit_token_revoked_at', null)
        .gt('edit_token_expires_at', new Date().toISOString())
        .maybeSingle()
      if (error?.code === '42703') {
        ({ data, error } = await supabase
          .from('marketing_requests')
          .select('tracking_id, name, department, email, title, campaign, description, request_type, platforms, audience, resource_links, date_needed, priority, management_approval')
          .eq('edit_token', editToken)
          .maybeSingle())
      }
      if (error) {
        console.error('public-marketing-request load failed', error.code)
        return json(req, { error: 'Request could not be loaded' }, 500)
      }
      if (!data) return json(req, { error: 'Request not found' }, 404)
      return json(req, { request: data })
    }

    if (action !== 'create' && action !== 'update') {
      return json(req, { error: 'Invalid request' }, 400)
    }
    const allowedKeys = action === 'create'
      ? ['action', 'request', 'submissionKey', 'turnstileToken']
      : ['action', 'editToken', 'request']
    if (!hasOnlyKeys(payload, allowedKeys)) {
      return json(req, { error: 'Invalid request' }, 400)
    }
    if (action === 'update' && (!editToken || !TOKEN_PATTERN.test(editToken))) {
      return json(req, { error: 'Invalid request' }, 400)
    }

    const request = parseRequest(payload.request)
    if (!request) return json(req, { error: 'Invalid request fields' }, 400)

    if (action === 'create') {
      const submissionKey = text(payload.submissionKey, 36)
      const turnstileToken = text(payload.turnstileToken, 2_048)
      if (!submissionKey || !UUID_PATTERN.test(submissionKey) || !turnstileToken) {
        return json(req, { error: 'Invalid submission verification' }, 400)
      }
      const generatedToken = await signedEditToken(submissionKey)
      if (!generatedToken) return json(req, { error: 'Request service unavailable' }, 503)

      const { data: existing, error: existingError } = await supabase
        .from('marketing_requests')
        .select('tracking_id')
        .eq('submission_key', submissionKey)
        .maybeSingle()
      const hardenedSchema = existingError?.code !== '42703'
      if (existingError && hardenedSchema) {
        console.error('public-marketing-request idempotency lookup failed', existingError.code)
        return json(req, { error: 'Request could not be submitted' }, 500)
      }
      if (existing?.tracking_id) {
        return json(req, { editToken: generatedToken, trackingId: existing.tracking_id })
      }
      if (!await verifyTurnstile(req, turnstileToken, 'marketing_request')) {
        return json(req, { error: 'Submission verification failed' }, 403)
      }

      const editTokenHash = await sha256Hex(generatedToken)
      const { data, error } = await supabase
        .from('marketing_requests')
        .insert(hardenedSchema
          ? {
              ...request,
              edit_token: null,
              edit_token_expires_at: new Date(Date.now() + EDIT_TOKEN_TTL_MS).toISOString(),
              edit_token_hash: editTokenHash,
              submission_key: submissionKey,
            }
          : { ...request, edit_token: generatedToken })
        .select('tracking_id')
        .single()
      if (error?.code === '23505') {
        const lookup = supabase
          .from('marketing_requests')
          .select('tracking_id')
        const { data: concurrent, error: concurrentError } = hardenedSchema
          ? await lookup.eq('submission_key', submissionKey).maybeSingle()
          : await lookup.eq('edit_token', generatedToken).maybeSingle()
        if (!concurrentError && concurrent?.tracking_id) {
          return json(req, { editToken: generatedToken, trackingId: concurrent.tracking_id })
        }
      }
      if (error || !data?.tracking_id) {
        console.error('public-marketing-request create failed', error?.code || 'unconfirmed')
        return json(req, { error: 'Request could not be submitted' }, 500)
      }
      return json(req, { editToken: generatedToken, trackingId: data.tracking_id }, 201)
    }

    const editTokenHash = await sha256Hex(editToken as string)
    let { data, error } = await supabase
      .from('marketing_requests')
      .update({
        ...request,
        edit_token_expires_at: new Date(Date.now() + EDIT_TOKEN_TTL_MS).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('edit_token_hash', editTokenHash)
      .is('edit_token_revoked_at', null)
      .gt('edit_token_expires_at', new Date().toISOString())
      .select('tracking_id')
      .maybeSingle()
    if (error?.code === '42703') {
      ({ data, error } = await supabase
        .from('marketing_requests')
        .update({ ...request, updated_at: new Date().toISOString() })
        .eq('edit_token', editToken as string)
        .select('tracking_id')
        .maybeSingle())
    }
    if (error) {
      console.error('public-marketing-request update failed', error.code)
      return json(req, { error: 'Request could not be updated' }, 500)
    }
    if (!data) return json(req, { error: 'Request not found' }, 404)
    return json(req, { trackingId: data.tracking_id })
  } catch {
    console.error('public-marketing-request failed')
    return json(req, { error: 'Request service failed' }, 500)
  }
})
