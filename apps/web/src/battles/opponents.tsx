import { m } from '@battlecrm/i18n';
import { Swords } from 'lucide-react';

import { RolePill, type RolePillKind } from './role-pill.tsx';

/**
 * The two sides of a Battle, face to face (spec UX §2): the Champion in neutral, the Challenger in the
 * accent, crossed swords between them, as in the menu. Each role is written under its pill, never
 * told by the colour alone; read as “Champion X against Challenger Y”.
 */
export function Opponents({ champion, challenger }: { champion: string; challenger: string }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
      <Side role={m.battle_champion()} label={champion} kind="champion" />
      <Swords aria-hidden className="mt-1.5 size-6 shrink-0 text-accent-text" />
      <span className="sr-only"> {m.battles_against()} </span>
      <Side role={m.battle_challenger()} label={challenger} kind="challenger" />
    </div>
  );
}

/** A side of the Battle: its role, then its Positioning in a pill; shown pill first. */
function Side({ role, label, kind }: { role: string; label: string; kind: RolePillKind }) {
  return (
    <span className="flex min-w-0 flex-col-reverse items-center gap-0.5">
      <span className="px-1 text-xs text-muted-foreground">{role} </span>
      <RolePill kind={kind}>{label}</RolePill>
    </span>
  );
}
