export type TimelineNoteOperation = 'added' | 'deleted'
export type TemplateFailureOperation = 'create' | 'update' | 'delete'

export function timelineNoteDetail(operation: TimelineNoteOperation, company: string): string {
  return operation === 'added'
    ? `Added note to "${company}"`
    : `Deleted a note from "${company}"`
}

export function fileLinkAddedDetail(name: string): string {
  return `Added link "${name}"`
}

export function templateFailureDetail(operation: TemplateFailureOperation, title: string): string {
  const outcome = operation === 'create'
    ? 'Creation'
    : operation === 'update'
      ? 'Update'
      : 'Deletion'
  return `${outcome} failed for "${title}"`
}
