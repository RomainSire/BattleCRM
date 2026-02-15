export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    registrationStatus: () => [...queryKeys.auth.all, 'registration-status'] as const,
  },
}
