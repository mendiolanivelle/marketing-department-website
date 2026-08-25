export interface CampaignFormState {
  name: string
  dept: string
  status: string
  due: string
  requesterName: string
  requesterEmail: string
  priority: string
  requestType: string[]
  description: string
}

export function queueCampaignFormPatch(patch: Partial<CampaignFormState>) {
  return (current: CampaignFormState): CampaignFormState => ({ ...current, ...patch })
}
