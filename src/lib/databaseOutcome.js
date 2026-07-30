export function isDefiniteDatabaseRejection(error) {
  if (!error || typeof error !== 'object') return false
  const { code } = error
  if (typeof code !== 'string') return false

  // Only errors that guarantee PostgreSQL rejected the statement are safe for
  // compensating object cleanup. Connection and completion outcomes stay
  // ambiguous, including SQLSTATE classes 08/40 and all PGRST transport errors.
  return code.startsWith('22')
    || code.startsWith('23')
    || code === '42501'
}
