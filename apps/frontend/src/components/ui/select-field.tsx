import type { ReactNode } from 'react'
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { FieldError } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface SelectFieldOption {
  value: string
  label: string
}

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  options: SelectFieldOption[]
  placeholder?: string
  /** Renders a red asterisk next to the label (purely visual — the schema is the source of truth). */
  required?: boolean
  disabled?: boolean
  /** While true, renders a Skeleton in place of the Select (data still loading). */
  loading?: boolean
  /** Wires both the Label `htmlFor` and the trigger `id`. Defaults to `name`. */
  id?: string
  triggerClassName?: string
  'aria-label'?: string
}

/**
 * Controller-backed shadcn Select wired into react-hook-form.
 * Mirrors `TextField` so submit-forms can keep their select values inside the
 * form/Vine schema instead of a parallel `useState`.
 */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  loading,
  id,
  triggerClassName,
  'aria-label': ariaLabel,
}: SelectFieldProps<T>) {
  const fieldId = id ?? name

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId}>
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
          {loading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger
                id={fieldId}
                aria-label={ariaLabel}
                aria-invalid={fieldState.invalid}
                className={cn('w-full', triggerClassName)}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <FieldError errors={[fieldState.error]} />
        </div>
      )}
    />
  )
}
