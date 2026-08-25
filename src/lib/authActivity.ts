export interface SignOutResult {
  error: Error | null
}

type ActivityRecorder = (detail: string) => unknown

const safelyRecordActivity = (recordActivity: ActivityRecorder, detail: string) => {
  try {
    void Promise.resolve(recordActivity(detail)).catch(() => {})
  } catch {
    // Authentication must continue even when activity instrumentation is unavailable.
  }
}

export async function signOutWithActivity(
  signOut: () => Promise<SignOutResult>,
  recordActivity: ActivityRecorder,
): Promise<SignOutResult> {
  safelyRecordActivity(recordActivity, 'Sign-out requested')
  try {
    const result = await signOut()
    if (result.error) safelyRecordActivity(recordActivity, 'Sign-out failed')
    return result
  } catch (error) {
    safelyRecordActivity(recordActivity, 'Sign-out failed')
    return {
      error: error instanceof Error ? error : new Error('Sign-out failed'),
    }
  }
}
