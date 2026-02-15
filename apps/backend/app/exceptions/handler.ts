import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { errors as vineErrors } from '@vinejs/vine'

/**
 * Map VineJS rule names to translation keys
 */
const ruleToKey: Record<string, string> = {
  required: 'validation.required',
  email: 'validation.email',
  minLength: 'validation.minLength',
  confirmed: 'validation.confirmed',
}

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const errors = (
        error.messages as Array<{
          message: string
          field: string
          rule: string
          meta?: Record<string, unknown>
        }>
      ).map((err) => ({
        message: ruleToKey[err.rule] ?? `validation.${err.rule}`,
        field: err.field,
        rule: err.rule,
        ...(err.meta ? { meta: err.meta } : {}),
      }))
      return ctx.response.unprocessableEntity({ errors })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
