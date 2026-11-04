/**
 * What the extension recognizes LinkedIn by, in one place (spec extension §6, ST-103): LinkedIn in
 * French only. When LinkedIn changes them, or shows another language, what depends on them stays empty.
 */

/** “Camille Durand | LinkedIn”, after a count of notifications such as “(3) ”, if any. */
export const PROFILE_TITLE = /^(?:\(\d+\+?\)\s*)?(.+?)\s*\|\s*LinkedIn$/;

/** The attribute LinkedIn names its blocks by; the slug of a profile ends some of them. */
export const COMPONENT_KEY = 'componentkey';

/** The block of the Experience section; its key ends with the slug of the profile. */
export const EXPERIENCE_KEY = 'ExperienceTopLevelSection';

/** The key every item of a section of the profile starts with: the first one of Experience is the latest. */
export const ITEM_KEY = 'entity-collection-item';

/** The dates of a post still held: “janv. 2025 - aujourd’hui · 1 an 10 mois”. */
export const CURRENT_DATES = /\s-\saujourd[’']hui\b/;

/** The degree of the relation, after the name: “· 1er”, “· 2e”, “· 3e et +”. */
export const DEGREE = /^·\s*\d+(?:er|e)(?:\s+et\s+\+)?$/;

/** What LinkedIn puts after the name of the Organization of a post: “Altémis Conseil · CDI”. */
export const CONTRACT_TYPES = new Set([
  'CDI',
  'CDD',
  'Temps plein',
  'Temps partiel',
  'Indépendant',
  'Freelance',
  'Stage',
  'Contrat en alternance',
  'Alternance',
  'Apprentissage',
  'Intérim',
  'Saisonnier',
]);

/** The title of the window LinkedIn opens on “Coordonnées”. */
export const CONTACT_INFO_TITLE = 'Coordonnées';

/** The label of the phone in that window; its type follows it in brackets: “(Mobile)”. */
export const PHONE_LABEL = 'Téléphone';
