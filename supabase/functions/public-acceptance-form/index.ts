import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import {
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
  text,
  verifyTurnstile,
} from '../_shared/http.ts'

const FORM_KEYS = [
  'client_name',
  'project_name',
  'contact',
  'email',
  'project_type',
  'target_platform',
  'timezone',
  'start_date',
  'deadline',
  'budget',
  'doc_link',
  'deliverables',
  'reviewer',
  'review_rounds',
  'review_time',
  'approval_basis',
  'comms_tool',
  'weekly_meeting',
  'meeting_time',
  'daily_sync',
  'sync_time',
  'training',
  'game_engine',
  'tech_requirements',
  'tools_software',
  'performance_constraints',
  'signatory_name',
  'signature_png',
  'submissionKey',
  'turnstileToken',
]
const DELIVERABLE_KEYS = ['name', 'description', 'criteria', 'reference', 'quantity', 'serviceType']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const OTHER_PREFIX = 'Others: '
const PROJECT_TYPES = ['Project Base', 'Staff Augmentation']
const TARGET_PLATFORMS = ['PC', 'Mobile', 'Web', 'Console', 'Not sure yet']
const REVIEWERS = ['Client', "Client's Team", 'Stakeholders', "Client's QA"]
const REVIEW_ROUNDS = ['1', '2', '3', 'Not Sure']
const REVIEW_TIMES = ['1 day', '2 days', '3 days', 'Not Sure']
const APPROVAL_BASES = ['Acceptance criteria from Section 2']
const COMMS_TOOLS = ['Discord', 'Slack']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const SYNC_DAYS = ['Everyday', ...WEEKDAYS]
const MEETING_TIMES = ['10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM']
const TRAINING = ['Client', 'Exodia', 'Third Party']
const GAME_ENGINES = ['Unity', 'Unreal', 'Not sure yet']

function enumValue(
  value: unknown,
  allowed: string[],
  { allowEmpty = false, allowOther = false } = {},
): string | null {
  if (allowEmpty && (value === undefined || value === null || value === '')) return ''
  const parsed = requiredText(value, allowOther ? 108 : 100)
  if (!parsed) return null
  if (allowed.includes(parsed)) return parsed
  if (!allowOther || !parsed.startsWith(OTHER_PREFIX)) return null
  const custom = requiredText(parsed.slice(OTHER_PREFIX.length), 100)
  return custom ? `${OTHER_PREFIX}${custom}` : null
}

function enumArray(
  value: unknown,
  allowed: string[],
  maxItems: number,
  minItems = 0,
  allowOther = false,
): string[] | null {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) return null
  const parsed = value.map((item) => enumValue(item, allowed, { allowOther }))
  if (parsed.some((item) => item === null)) return null
  const items = parsed as string[]
  return new Set(items).size === items.length ? items : null
}

function signaturePng(value: unknown): string | null | false {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 96 * 1024) return false
  const prefix = 'data:image/png;base64,'
  if (!value.startsWith(prefix) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(prefix.length))) return false
  try {
    const png = atob(value.slice(prefix.length))
    const bytes = Array.from(png.slice(0, 24), (byte) => byte.charCodeAt(0))
    const readSize = (offset: number) =>
      ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    const validHeader = bytes.length === 24 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) &&
      bytes.slice(12, 16).every((byte, index) => byte === [73, 72, 68, 82][index]) &&
      readSize(16) === 400 && readSize(20) === 120
    return validHeader ? value : false
  } catch {
    return false
  }
}

function deliverables(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null
  const parsed = []
  for (const row of value) {
    if (!isRecord(row) || !hasOnlyKeys(row, DELIVERABLE_KEYS)) return null
    const name = requiredText(row.name, 300)
    const description = optionalText(row.description, 2_000)
    const criteria = requiredText(row.criteria, 3_000)
    const reference = optionalText(row.reference, 2_048)
    const quantity = optionalText(row.quantity, 100)
    const serviceType = optionalText(row.serviceType, 200)
    if (
      !name || description === null || !criteria ||
      reference === null || quantity === null || serviceType === null
    ) return null
    const normalizedReference = reference ? safeHttpUrl(reference) : ''
    if (reference && !normalizedReference) return null
    parsed.push({
      name,
      description,
      criteria,
      reference: normalizedReference,
      quantity,
      serviceType,
    })
  }
  return parsed
}

function parseForm(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, FORM_KEYS)) return null

  const clientName = requiredText(value.client_name, 200)
  const projectName = requiredText(value.project_name, 300)
  const contact = requiredText(value.contact, 200)
  const email = requiredText(value.email, 254)
  const projectType = enumValue(value.project_type, PROJECT_TYPES, { allowOther: true })
  const targetPlatform = enumArray(value.target_platform, TARGET_PLATFORMS, 6, 1, true)
  const timezone = requiredText(value.timezone, 200)
  const startDate = isoDate(value.start_date)
  const deadline = isoDate(value.deadline)
  const budget = optionalText(value.budget, 200)
  const docLink = optionalText(value.doc_link, 2_048)
  const parsedDeliverables = deliverables(value.deliverables)
  const reviewer = enumArray(value.reviewer, REVIEWERS, 5, 1, true)
  const reviewRounds = enumValue(value.review_rounds, REVIEW_ROUNDS, { allowEmpty: true })
  const reviewTime = enumValue(value.review_time, REVIEW_TIMES, { allowEmpty: true })
  const approvalBasis = enumArray(value.approval_basis, APPROVAL_BASES, 1)
  const commsTool = enumArray(value.comms_tool, COMMS_TOOLS, 3, 0, true)
  const weeklyMeeting = enumArray(value.weekly_meeting, WEEKDAYS, 5)
  const meetingTime = enumValue(value.meeting_time, MEETING_TIMES, { allowEmpty: true, allowOther: true })
  const dailySync = enumArray(value.daily_sync, SYNC_DAYS, 6)
  const syncTime = enumValue(value.sync_time, MEETING_TIMES, { allowEmpty: true, allowOther: true })
  const training = enumArray(value.training, TRAINING, 3)
  const gameEngine = enumArray(value.game_engine, GAME_ENGINES, 4, 0, true)
  const techRequirements = optionalText(value.tech_requirements, 5_000)
  const toolsSoftware = optionalText(value.tools_software, 3_000)
  const performanceConstraints = optionalText(value.performance_constraints, 3_000)
  const signatoryName = requiredText(value.signatory_name, 200)
  const parsedSignaturePng = signaturePng(value.signature_png)

  if (
    !clientName || !projectName || !contact || !email || !isEmail(email) ||
    !projectType || !targetPlatform || !timezone || !startDate || !deadline ||
    budget === null || docLink === null || !parsedDeliverables || !reviewer ||
    reviewRounds === null || reviewTime === null || !approvalBasis || !commsTool ||
    !weeklyMeeting || meetingTime === null || !dailySync || syncTime === null ||
    !training || !gameEngine || techRequirements === null || toolsSoftware === null ||
    performanceConstraints === null || !signatoryName || parsedSignaturePng === false
  ) return null

  const normalizedDocLink = docLink ? safeHttpUrl(docLink) : ''
  if ((docLink && !normalizedDocLink) || deadline < startDate) return null

  return {
    client_name: clientName,
    project_name: projectName,
    contact,
    email,
    project_type: projectType,
    target_platform: targetPlatform,
    timezone,
    start_date: startDate,
    deadline,
    budget,
    doc_link: normalizedDocLink,
    deliverables: parsedDeliverables,
    reviewer,
    review_rounds: reviewRounds,
    review_time: reviewTime,
    approval_basis: approvalBasis,
    comms_tool: commsTool,
    weekly_meeting: weeklyMeeting,
    meeting_time: meetingTime,
    daily_sync: dailySync,
    sync_time: syncTime,
    training,
    game_engine: gameEngine,
    tech_requirements: techRequirements,
    tools_software: toolsSoftware,
    performance_constraints: performanceConstraints,
    signatory_name: signatoryName,
    signature_png: parsedSignaturePng,
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
    const parsed = await readJson(req, 640 * 1024)
    if (parsed.error) return parsed.error
    if (!isRecord(parsed.value) || !hasOnlyKeys(parsed.value, FORM_KEYS)) {
      return json(req, { error: 'Invalid form fields' }, 400)
    }
    const submissionKey = text(parsed.value.submissionKey, 36)
    const turnstileToken = text(parsed.value.turnstileToken, 2_048)
    if (!submissionKey || !UUID_PATTERN.test(submissionKey) || !turnstileToken) {
      return json(req, { error: 'Invalid submission verification' }, 400)
    }

    const supabase = serviceRoleClient()
    if (!supabase) return json(req, { error: 'Form service unavailable' }, 503)

    const { data: existing, error: existingError } = await supabase
      .from('acceptance_forms')
      .select('tracking_id')
      .eq('submission_key', submissionKey)
      .maybeSingle()
    const submissionKeySupported = !existingError
    if (existingError?.code === '42703') {
      console.warn('public-acceptance-form compatibility fallback', existingError.code)
    } else if (existingError) {
      console.error('public-acceptance-form idempotency lookup failed', existingError.code)
      return json(req, { error: 'Form could not be submitted' }, 500)
    }
    if (existing?.tracking_id) return json(req, { trackingId: existing.tracking_id })

    const form = parseForm(parsed.value)
    if (!form) return json(req, { error: 'Invalid form fields' }, 400)
    if (!await verifyTurnstile(req, turnstileToken, 'acceptance_form')) {
      return json(req, { error: 'Submission verification failed' }, 403)
    }

    const now = new Date()
    const trackingId = `AC-${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}-${(await sha256Hex(submissionKey)).slice(0, 8).toUpperCase()}`
    const write: Record<string, unknown> = {
      ...form,
      accepted_at: now.toISOString(),
      tracking_id: trackingId,
      ...(submissionKeySupported ? { submission_key: submissionKey } : {}),
    }
    let { data, error } = await supabase
      .from('acceptance_forms')
      .insert(write)
      .select('tracking_id')
      .single()
    if (error?.code === '42703') {
      const legacyWrite = { ...write }
      delete legacyWrite.accepted_at
      delete legacyWrite.signatory_name
      delete legacyWrite.signature_png
      if (!submissionKeySupported) delete legacyWrite.submission_key
      legacyWrite.signature = form.signatory_name
      legacyWrite.signature_date = now.toISOString().slice(0, 10)
      ;({ data, error } = await supabase
        .from('acceptance_forms')
        .insert(legacyWrite)
        .select('tracking_id')
        .single())
    }
    if (error?.code === '23505') {
      const lookup = supabase
        .from('acceptance_forms')
        .select('tracking_id')
      const { data: concurrent, error: concurrentError } = submissionKeySupported
        ? await lookup.eq('submission_key', submissionKey).maybeSingle()
        : await lookup.eq('tracking_id', trackingId).maybeSingle()
      if (!concurrentError && concurrent?.tracking_id) {
        return json(req, { trackingId: concurrent.tracking_id })
      }
    }
    if (error || data?.tracking_id !== trackingId) {
      console.error('public-acceptance-form submit failed', error?.code || 'unconfirmed')
      return json(req, { error: 'Form could not be submitted' }, 500)
    }

    return json(req, { trackingId }, 201)
  } catch {
    console.error('public-acceptance-form failed')
    return json(req, { error: 'Form service failed' }, 500)
  }
})
