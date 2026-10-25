import { createContext, useContext } from 'react';

/** Opens the command palette, or the help of the shortcuts, which the frame of the app holds (spec UX §3.3). */
export const PaletteContext = createContext<{ openPalette: () => void; openShortcuts: () => void }>(
  {
    openPalette: () => undefined,
    openShortcuts: () => undefined,
  },
);

export const usePalette = () => useContext(PaletteContext);
