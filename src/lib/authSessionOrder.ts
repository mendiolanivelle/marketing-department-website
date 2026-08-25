export interface AuthSessionOrder {
  revision: number
}

export function createAuthSessionOrder(): AuthSessionOrder {
  return { revision: 0 }
}

export function beginAuthSessionRead(order: AuthSessionOrder): number {
  return order.revision
}

export function supersedeAuthSessionReads(order: AuthSessionOrder) {
  order.revision += 1
}

export function isAuthSessionReadCurrent(order: AuthSessionOrder, revision: number): boolean {
  return order.revision === revision
}

export function applyAuthEventSession<T>(
  session: T | null,
  applySession: (session: T | null) => boolean,
): boolean {
  return applySession(session)
}
