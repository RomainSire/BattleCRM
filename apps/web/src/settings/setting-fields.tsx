import { Checkbox, Input, Label } from '@battlecrm/ui';
import { cn } from 'cn';
import { useId, useState, type ReactNode } from 'react';
import { NumberField, Text } from 'react-aria-components';

import { useIsOnline } from '../online.ts';

/** A value from the server that the User edits: it follows the server again once it changes there, “Undo” included. */
export function useDraft<Value>(saved: Value) {
  const [draft, setDraft] = useState(saved);
  const [seen, setSeen] = useState(saved);
  if (JSON.stringify(saved) !== JSON.stringify(seen)) {
    setSeen(saved);
    setDraft(saved);
  }
  return [draft, setDraft] as const;
}

/**
 * A whole number, saved once committed: on leaving the field or on `Enter` (spec UX §5.8). Out of
 * bounds, it is brought back within them; emptied, it goes back to its value.
 */
export function NumberSetting({
  label,
  hint,
  value,
  minValue = 1,
  maxValue,
  isDisabled = false,
  onCommit,
  className,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  minValue?: number;
  maxValue: number;
  isDisabled?: boolean;
  onCommit: (value: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useDraft(value);
  // Every setting is saved on the server: offline, it is only read (ADR 0004).
  const isOnline = useIsOnline();
  return (
    <NumberField
      value={draft}
      minValue={minValue}
      maxValue={maxValue}
      step={1}
      formatOptions={{ maximumFractionDigits: 0 }}
      isDisabled={isDisabled || !isOnline}
      onChange={(committed) => {
        if (Number.isNaN(committed) || committed === draft) {
          setDraft(draft);
          return;
        }
        setDraft(committed);
        onCommit(committed);
      }}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <Label>{label}</Label>
      <Input className="w-24" />
      {hint && (
        <Text slot="description" className="text-sm text-muted-foreground">
          {hint}
        </Text>
      )}
    </NumberField>
  );
}

/**
 * A goal the User may turn off (CONTEXT.md): a box to keep it, then its number. Turned on again, it
 * comes back with the number it had, or its default.
 */
export function GoalSetting({
  title,
  countLabel,
  hint,
  value,
  fallback,
  maxValue,
  onChange,
}: {
  title: string;
  countLabel: string;
  hint?: ReactNode;
  value: number | null;
  fallback: number;
  maxValue: number;
  onChange: (value: number | null) => void;
}) {
  const hintId = useId();
  const [lastCount, setLastCount] = useState(value ?? fallback);
  if (value !== null && value !== lastCount) setLastCount(value);
  const isOnline = useIsOnline();
  return (
    <div className="flex flex-col gap-2">
      <Checkbox
        isSelected={value !== null}
        isDisabled={!isOnline}
        onChange={(isOn) => onChange(isOn ? lastCount : null)}
        {...(hint && { 'aria-describedby': hintId })}
        className="font-medium"
      >
        {title}
      </Checkbox>
      <NumberSetting
        label={countLabel}
        value={value ?? lastCount}
        maxValue={maxValue}
        isDisabled={value === null}
        onCommit={(count) => {
          setLastCount(count);
          onChange(count);
        }}
        className="pl-6"
      />
      {hint && (
        <p id={hintId} className="pl-6 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A preference that is on or off, with what it does under it. */
export function ToggleSetting({
  label,
  hint,
  isSelected,
  isDisabled = false,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  const hintId = useId();
  const isOnline = useIsOnline();
  return (
    <div className="flex flex-col gap-1">
      <Checkbox
        isSelected={isSelected}
        isDisabled={isDisabled || !isOnline}
        onChange={onChange}
        {...(hint && { 'aria-describedby': hintId })}
        className="font-medium data-disabled:opacity-50"
      >
        {label}
      </Checkbox>
      {hint && (
        <p id={hintId} className="pl-6 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
