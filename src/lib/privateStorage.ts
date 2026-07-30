import type { SupabaseClient } from '@supabase/supabase-js'
import { sha256Hex } from './fileIntegrity'
export { isDefiniteDatabaseRejection } from './databaseOutcome'

export type PrivateUploadOutcome = 'stored' | 'absent' | 'unknown'

function storageErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const candidate = error as { status?: unknown; statusCode?: unknown }
  const value = candidate.statusCode ?? candidate.status
  const status = typeof value === 'string' || typeof value === 'number'
    ? Number(value)
    : NaN
  return Number.isInteger(status) ? status : null
}

function isDefiniteStorageRejection(error: unknown): boolean {
  const status = storageErrorStatus(error)
  return status !== null
    && status >= 400
    && status < 500
    && ![408, 409, 425, 429].includes(status)
}

export async function uploadPrivateObject(
  client: SupabaseClient,
  bucket: string,
  objectPath: string,
  file: Blob,
  contentType: string,
  expectedSha256: string,
): Promise<PrivateUploadOutcome> {
  let definiteRejection = false
  try {
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(objectPath, file, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      })
    if (!uploadError) return 'stored'
    definiteRejection = isDefiniteStorageRejection(uploadError)
  } catch {
    // A transport failure can happen after Storage commits; verify by path.
  }

  try {
    const { data, error: verifyError } = await client.storage
      .from(bucket)
      .download(objectPath)
    if (verifyError) {
      return definiteRejection && storageErrorStatus(verifyError) === 404
        ? 'absent'
        : 'unknown'
    }
    if (!data) return 'unknown'
    return await sha256Hex(data) === expectedSha256 ? 'stored' : 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function queuePrivateStorageCleanup(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
  sourceTable: 'failed_file_upload' | 'failed_website_request_upload',
  sourceId: string,
  cleanupAllowed = true,
): Promise<boolean> {
  if (paths.length === 0) return true
  try {
    const { error } = await client
      .from('private_storage_cleanup')
      .upsert(
        paths.map(objectPath => ({
          bucket_id: bucket,
          object_path: objectPath,
          source_table: sourceTable,
          source_id: sourceId,
          cleanup_allowed: cleanupAllowed,
        })),
        { onConflict: 'bucket_id,object_path', ignoreDuplicates: true },
      )
    return !error
  } catch {
    return false
  }
}

export async function acknowledgePrivateStorageReview(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<boolean> {
  if (paths.length === 0) return true
  try {
    const { error } = await client
      .from('private_storage_cleanup')
      .delete()
      .eq('bucket_id', bucket)
      .eq('cleanup_allowed', false)
      .in('object_path', paths)
    return !error
  } catch {
    return false
  }
}

export async function markPrivateStorageCleanupSafe(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<boolean> {
  try {
    const results = await Promise.all(paths.map(objectPath =>
      client.rpc('mark_private_storage_cleanup_safe', {
        p_bucket: bucket,
        p_object_path: objectPath,
      }),
    ))
    return results.every(result => !result.error && result.data === true)
  } catch {
    return false
  }
}

export async function cleanupUnreferencedPrivateObjects(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<boolean> {
  if (paths.length === 0) return true
  try {
    const { error } = await client.storage.from(bucket).remove(paths)
    if (error) return await markPrivateStorageCleanupSafe(client, bucket, paths)
    return await acknowledgePrivateStorageReview(client, bucket, paths)
  } catch {
    return await markPrivateStorageCleanupSafe(client, bucket, paths)
  }
}

export async function drainPrivateStorageCleanup(
  client: SupabaseClient,
  bucket: string,
): Promise<boolean> {
  try {
    const { data: queued, error: queueError } = await client
      .from('private_storage_cleanup')
      .select('id, object_path')
      .eq('bucket_id', bucket)
      .eq('cleanup_allowed', true)
      .order('created_at', { ascending: true })
      .limit(50)
    if (queueError || !queued?.length) return !queueError

    const paths = [...new Set(queued.map(item => item.object_path as string))]
    const { error: removeError } = await client.storage.from(bucket).remove(paths)
    if (removeError) return false

    const { error: acknowledgeError } = await client
      .from('private_storage_cleanup')
      .delete()
      .in('id', queued.map(item => item.id))
    if (acknowledgeError) {
      console.error('Private objects were removed but cleanup acknowledgements remain.')
    }
    return true
  } catch {
    return false
  }
}
