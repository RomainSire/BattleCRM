import type { Target } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { ORGANIZATION_TYPE_LABEL } from '@battlecrm/ui';

/** The Target of a Contact as the User reads it. */
export const targetText = (target: Target) =>
  target === 'unknown' ? m.target_unknown() : ORGANIZATION_TYPE_LABEL[target]();
