const protectedRouteNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/timeline': 'Timeline',
  '/templates': 'Messaging & Templates',
  '/calendar': 'Calendar',
  '/files': 'File Tracker',
  '/leads': 'Lead Generation',
  '/campaigns': 'Campaigns',
  '/acceptance-criteria': 'Acceptance Criteria',
  '/marketing-project-list': 'Project List',
  '/marketing-projects': 'Project List',
  '/requests': 'Marketing Requests',
  '/website-requests': 'Website Requests',
}

export function getActivityRouteName(pathname: string): string | null {
  const exactName = protectedRouteNames[pathname]
  if (exactName) return exactName
  if (/^\/view-acceptance\/[^/]+$/.test(pathname)) return 'Shared Acceptance View'
  return null
}

export function getAuthenticatedActivityRouteName(
  pathname: string,
  isAuthenticatedStaff: boolean,
): string | null {
  return isAuthenticatedStaff ? getActivityRouteName(pathname) : null
}
