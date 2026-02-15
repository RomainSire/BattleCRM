import type { FieldContext, MessagesProviderContact } from '@vinejs/vine/types'
import i18next from 'i18next'

/**
 * Map VineJS rule names to i18n translation keys.
 */
const ruleToKey: Record<string, string> = {
  required: 'validation.required',
  string: 'validation.required',
  email: 'validation.email',
  minLength: 'validation.minLength',
  sameAs: 'validation.confirmed',
}

/**
 * Custom messages provider that resolves translations via i18next at validation time.
 * This ensures VineJS error messages are already in the correct language.
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
