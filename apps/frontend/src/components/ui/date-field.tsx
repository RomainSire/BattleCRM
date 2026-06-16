import type { ReactNode } from 'react'
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface DateFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  required?: boolean
  disabled?: boolean
  /** Wires both the Label `htmlFor` and the input `id`. Defaults to `name`. */
  id?: string
  /** Applied to the `<input type="date">` (e.g. to constrain width). */
  className?: string
  labelClassName?: string
}

/**
 * Controller-backed `<input type="date">` wired into react-hook-form.
 * The field value is the native date-input string (`YYYY-MM-DD`); ISO conversion
 * stays the caller's responsibility (cf. `lib/dates`).
 */
export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  id,
  className,
  labelClassName,
}: DateFieldProps<T>) {
  const fieldId = id ?? name

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId} className={labelClassName}>
            {label}
            {required && (
              <>
                {' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </>
            )}
          </Label>
          <Input
            id={fieldId}
            type="date"
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            className={cn(className)}
          />
          <FieldError errors={[fieldState.error]} />
        </div>
      )}
    />
  )
}
