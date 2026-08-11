export async function runPrivateStorageMaintenance(enabled, maintenance) {
  if (!enabled) return true
  return maintenance()
}
