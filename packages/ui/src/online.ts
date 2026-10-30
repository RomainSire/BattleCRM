import { createContext } from 'react';

/**
 * Whether the app can reach its API, given by the app: offline, a button that saves is disabled
 * (ADR 0004). Offline when no app gives it: a forgotten provider shows at once, and never lets a
 * save through.
 */
export const OnlineContext = createContext(false);
