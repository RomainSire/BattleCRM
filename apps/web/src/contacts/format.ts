import type { Locale } from '../i18n.ts';

/** A local day (`YYYY-MM-DD`) as the User reads it: already a day of its own time zone, never shifted by the device's. */
export const formatLocalDay = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** The first letter of a name, whole even when it is made of several code points. */
export const initialOf = (name: string) =>
  new Intl.Segmenter().segment(name)[Symbol.iterator]().next().value?.segment;
