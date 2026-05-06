import type { ExtensionProspectData } from '@battlecrm/shared'

export type CachedCheckResult = { found: true; prospect: ExtensionProspectData } | { found: false }
