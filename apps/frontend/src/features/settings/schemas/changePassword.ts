import vine from '@vinejs/vine'

export const changePasswordSchema = vine.create(
  vine.object({
    currentPassword: vine.string().minLength(1),
    newPassword: vine.string().minLength(8),
    newPasswordConfirmation: vine.string().sameAs('newPassword'),
  }),
)
