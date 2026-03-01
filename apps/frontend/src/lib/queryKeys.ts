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
    list: (filters?: { funnel_stage_id?: string; include_archived?: boolean }) =>
      filters && Object.keys(filters).length > 0
        ? ([...queryKeys.prospects.all, 'list', filters] as const)
        : ([...queryKeys.prospects.all, 'list'] as const),
    detail: (id: string) => [...queryKeys.prospects.all, 'detail', id] as const,
    stageTransitions: (id: string) =>
      [...queryKeys.prospects.all, 'stage-transitions', id] as const,
  },
}
