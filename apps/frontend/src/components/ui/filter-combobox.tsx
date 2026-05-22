import { useEffect, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'

interface FilterComboboxProps {
  options: string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder: string
  emptyLabel: string
  className?: string
}

export function FilterCombobox({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  className,
}: FilterComboboxProps) {
  const [inputValue, setInputValue] = useState('')

  // Reset search when the filter is cleared externally (e.g. "Effacer les filtres")
  useEffect(() => {
    if (!value) setInputValue('')
  }, [value])

  const filteredOptions = inputValue
    ? options.filter((opt) => opt.toLowerCase().includes(inputValue.toLowerCase()))
    : options

  return (
    <Combobox
      value={value ?? null}
      onValueChange={(val) => onChange(val ?? undefined)}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onOpenChange={(open) => {
        if (open) setInputValue('')
      }}
    >
      <ComboboxInput
        placeholder={placeholder}
        showClear={!!value}
        className={cn('h-8 w-44', className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {filteredOptions.map((opt) => (
            <ComboboxItem key={opt} value={opt}>
              {opt}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
