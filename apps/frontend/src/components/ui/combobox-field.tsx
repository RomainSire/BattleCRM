import type { ReactNode } from 'react'
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { FieldError } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ComboboxFieldOption {
  value: string
  label: string
}

interface ComboboxFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  options: ComboboxFieldOption[]
  placeholder?: string
  /** Renders a red asterisk next to the label (purely visual — the schema is the source of truth). */
  required?: boolean
  disabled?: boolean
  /** While true, renders a Skeleton in place of the field (data still loading). */
  loading?: boolean
  /** Optional muted hint rendered between the field and the error. */
  description?: ReactNode
  /** Extra side-effect fired alongside the RHF `field.onChange` (e.g. reset a dependent field). */
  onValueChange?: (value: string) => void
  /** Shows a button to clear the selection (sets the value to `''`). Off by default. */
  clearable?: boolean
  /** Message shown when no option matches the search query. Defaults to `table.noResults`. */
  emptyLabel?: ReactNode
  /** Wires both the Label `htmlFor` and the input `id`. Defaults to `name`. */
  id?: string
  inputClassName?: string
  'aria-label'?: string
}

/**
 * Controller-backed searchable combobox wired into react-hook-form.
 * Mirrors `SelectField` so submit-forms keep their value inside the form/Vine
 * schema, but lets the user type to filter — use it instead of `SelectField`
 * whenever the option list can be long (prospects, positionings…).
 */
export function ComboboxField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  loading,
  description,
  onValueChange,
  clearable = false,
  emptyLabel,
  id,
  inputClassName,
  'aria-label': ariaLabel,
}: ComboboxFieldProps<T>) {
  const { t } = useTranslation()
  const fieldId = id ?? name

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((option) => option.value === field.value) ?? null

        return (
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
              <Combobox<ComboboxFieldOption>
                items={options}
                value={selected}
                onValueChange={(option) => {
                  const value = option?.value ?? ''
                  field.onChange(value)
                  onValueChange?.(value)
                }}
                disabled={disabled}
              >
                <ComboboxInput
                  id={fieldId}
                  placeholder={placeholder}
                  aria-label={ariaLabel}
                  aria-invalid={fieldState.invalid}
                  showClear={clearable && !!selected}
                  disabled={disabled}
                  className={cn('w-full', inputClassName)}
                />
                <ComboboxContent>
                  <ComboboxEmpty>{emptyLabel ?? t('table.noResults')}</ComboboxEmpty>
                  <ComboboxList>
                    {(option: ComboboxFieldOption) => (
                      <ComboboxItem key={option.value} value={option}>
                        {option.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <FieldError errors={[fieldState.error]} />
          </div>
        )
      }}
    />
  )
}
