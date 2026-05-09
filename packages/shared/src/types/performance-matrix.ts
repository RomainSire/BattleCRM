export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type ConversionCellType = {
  positioningId: string
  positioningName: string | null
  funnelStageId: string
  funnelStageName: string | null
  rate: number
  numerator: number
  denominator: number
  confidenceLevel: ConfidenceLevel
}

export type PerformanceMatrixType = {
  cells: ConversionCellType[]
}
