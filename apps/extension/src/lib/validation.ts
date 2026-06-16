import type { FieldContext, MessagesProviderContact } from '@vinejs/vine/types'
import i18next from 'i18next'

/**
 * Map VineJS rule names to i18n translation keys.
 * Keep in phase with apps/frontend/src/lib/validation.ts (intentional duplication —
 * packages/shared is types-only and the locale keys are app-specific).
 */
const ruleToKey: Record<string, string> = {
  required: 'validation.required',
  string: 'validation.required',
  email: 'validation.email',
  minLength: 'validation.minLength',
}

/**
 * Custom messages provider that resolves translations via i18next at validation time,
 * so VineJS error messages are already in the correct language.
 */
class I18nMessagesProvider implements MessagesProviderContact {
  getMessage(
    _rawMessage: string,
    rule: string,
    field: FieldContext,
    args?: Record<string, unknown>,
  ) {
    const key = ruleToKey[rule] ?? `validation.${rule}`
    return i18next.t(key, { field: field.name, ...args })
  }
}

export const i18nMessagesProvider = new I18nMessagesProvider()
