export const queryKeys = {
  prospects: {
    all: ['prospects'] as const,
    check: (linkedinUrl: string) => [...queryKeys.prospects.all, 'check', linkedinUrl] as const,
  },
}
