export type ProspectsByStageType = {
  stageId: string
  stageName: string
  count: number
}

export type DashboardSummaryType = {
  totalActiveProspects: number
  prospectsByStage: ProspectsByStageType[]
  interactionsThisWeek: number
  interactionsThisMonth: number
}
