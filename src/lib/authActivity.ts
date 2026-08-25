export interface SignOutResult {
  error: Error | null
}

type ActivityRecorder = (detail: string) => unknown

export async function signOutWithActivity(
  signOut: () => Promise<SignOutResult>,
  recordActivity: ActivityRecorder,
): Promise<SignOutResult> {
  void recordActivity('Sign-out requested')
  const result = await signOut()
  if (result.error) void recordActivity('Sign-out failed')
  return result
}
