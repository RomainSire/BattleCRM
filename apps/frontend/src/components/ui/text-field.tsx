import type { ComponentProps } from 'react'
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'

interface TextFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  type?: ComponentProps<typeof Input>['type']
  placeholder?: string
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  type = 'text',
  placeholder,
}: TextFieldProps<T>) {
  const InputComponent = type === 'password' ? PasswordInput : Input

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <InputComponent
            {...field}
            id={field.name}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
            {...(type !== 'password' ? { type } : {})}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
