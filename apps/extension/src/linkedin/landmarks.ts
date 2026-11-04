/**
 * What the extension recognizes LinkedIn by, in one place (spec extension §6, ST-103): LinkedIn in
 * French only. When LinkedIn changes them, or shows another language, what depends on them stays empty.
 */

/** “Camille Durand | LinkedIn”, after a count of notifications such as “(3) ”, if any. */
export const PROFILE_TITLE = /^(?:\(\d+\+?\)\s*)?(.+?)\s*\|\s*LinkedIn$/;

/** The attribute LinkedIn names its blocks by; the slug of a profile ends some of them. */
export const COMPONENT_KEY = 'componentkey';
