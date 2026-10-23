import type { AddableContactStatus } from '@battlecrm/contract';
import { createContext, useContext } from 'react';

/** What the quick add opens with: a name already typed, a Status already chosen (spec UX §5.11). */
export type QuickAddStart = { name: string; status: AddableContactStatus };

/** Opens the quick add of a Contact, which the frame of the app holds (spec UX §6.8). */
export const AddContactContext = createContext<(start?: QuickAddStart) => void>(() => undefined);

export const useAddContact = () => useContext(AddContactContext);
