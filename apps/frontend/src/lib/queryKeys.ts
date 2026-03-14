import type {
  InteractionsFilterType,
  PositioningsFilterType,
  ProspectsFilterType,
} from '@battlecrm/shared'

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    registrationStatus: () => [...queryKeys.auth.all, 'registration-status'] as const,
  },
  funnelStages: {
    all: ['funnel-stages'] as const,
    list: () => [...queryKeys.funnelStages.all, 'list'] as const,
  },
  prospects: {
    all: ['prospects'] as const,
    list: (filters?: ProspectsFilterType) =>
      filters && Object.keys(filters).length > 0
        ? ([...queryKeys.prospects.all, 'list', filters] as const)
        : ([...queryKeys.prospects.all, 'list'] as const),
    detail: (id: string) => [...queryKeys.prospects.all, 'detail', id] as const,
    stageTransitions: (id: string) =>
      [...queryKeys.prospects.all, 'stage-transitions', id] as const,
  },
  positionings: {
    all: ['positionings'] as const,
    list: (filters?: PositioningsFilterType) =>
      filters && Object.keys(filters).length > 0
        ? ([...queryKeys.positionings.all, 'list', filters] as const)
        : ([...queryKeys.positionings.all, 'list'] as const),
    prospects: (id: string) => [...queryKeys.positionings.all, 'prospects', id] as const,
  },
  interactions: {
    all: ['interactions'] as const,
    list: (filters?: InteractionsFilterType) =>
      filters && Object.keys(filters).length > 0
        ? ([...queryKeys.interactions.all, 'list', filters] as const)
        : ([...queryKeys.interactions.all, 'list'] as const),
  },
}
