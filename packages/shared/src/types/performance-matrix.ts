export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type ConversionCellType = {
  positioningId: string
  positioningName: string
  funnelStageId: string
  funnelStageName: string
  rate: number
  numerator: number
  denominator: number
  confidenceLevel: ConfidenceLevel
}

export type PerformanceMatrixType = {
  cells: ConversionCellType[]
}
