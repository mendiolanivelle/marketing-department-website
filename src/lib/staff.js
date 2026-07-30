/**
 * Staff access must come from administrator-controlled app metadata.
 * @param {{ app_metadata?: Record<string, unknown> } | null | undefined} user
 */
export const isStaffUser = (user) => user?.app_metadata?.staff === true
