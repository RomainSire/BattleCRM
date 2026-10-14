import { createContext, useContext } from 'react';

/** Opens the quick add of a Contact, which the frame of the app holds (spec UX §6.8). */
export const AddContactContext = createContext<() => void>(() => undefined);

export const useAddContact = () => useContext(AddContactContext);
