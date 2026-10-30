# Fixtures de test du scraping

Type: grilling
Status: resolved
Blocked by: 09

## Question

Comment tester la lecture de LinkedIn dans la CI et `pnpm check`, alors que les pages réelles restent dans `.private/linkedin/` et ne sortent jamais de là ?

- **Fixtures synthétiques** minimales (structure seule, noms inventés) dérivées des vraies pages : qui les écrit, comment on vérifie qu'elles restent fidèles aux vraies, où elles vivent dans `apps/extension`.
- **Tests locaux sur les vraies pages** : un second jeu qui ne tourne que si `.private/linkedin/` existe (sauté sinon), pour attraper l'écart entre fixtures et réalité ?
- **Ce que les fixtures doivent reproduire** : ce qu'utilise la lecture retenue par [Quand LinkedIn change son DOM](09-quand-linkedin-change-son-dom.md) (clés `componentkey` avec le slug, ligne « - aujourd’hui », `role="listitem"`, titre de la page, ou repères de contenu), plus les cas limites de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) (slug différent de l'URL, pas d'expérience en cours, école, « Coordonnées » ouverte ou non).
- Elles tournent dans l'instance Firefox du projet Vitest `extension` ([Stack de l'extension](05-stack-de-l-extension.md)).

## Answer

Tranché avec Romain le 2026-10-30, en deux tours. Le premier partait de fixtures écrites à la main ; Romain l'a recadré : **les fixtures sont les vraies pages, entièrement anonymisées** (pas seulement le Contact : Organisations, écoles, autres membres, identifiants), versionnées, lues par la CI. Exécution faite dans ce ticket, à sa demande.

1. **Anonymisation par liste blanche** : le script [`apps/extension/scripts/anonymize-linkedin.ts`](../../../apps/extension/scripts/anonymize-linkedin.ts) réécrit chaque copie de l'inspecteur dans le navigateur (Playwright, le même `DOMParser` que les tests, sans nouvelle dépendance) :
   - **supprimés** : scripts, styles, images, SVG, frames, `<template>`, commentaires, tout le `<head>` sauf `<title>` ;
   - **attributs** : seuls `componentkey`, `data-testid`, `role`, `href`, `open`, `lang`, `dir` restent ; leurs identifiants (slugs, `ACoA…`, UUID, nombres longs, jetons) deviennent des faux, stables ;
   - **textes** : tous remplacés (`Texte 12`, stable dans la page), sauf les libellés LinkedIn de la liste `LABELS`, les dates et durées (« janv. 2025 - aujourd’hui · 1 an 10 mois »), et les valeurs que la configuration associe à des valeurs inventées ;
   - **liens** : `/in/`, `/company/`, `/school/`, `mailto:` vers de faux identifiants (un slug accentué ou en `%xx` garde cette forme), tous les autres en `#`.
2. **Garde-fou** : le script échoue si un mot d'un texte remplacé, un slug, un identifiant ou une valeur réelle de la configuration reste dans la sortie (aussi après décodage `%xx`). Il a attrapé un vrai défaut pendant l'écriture (les chiffres d'un faux slug réécrits dans les clés).
3. **Configuration** : `.private/linkedin/anonymize.json` (git-ignoré : valeurs réelles → inventées, pages, URL, valeurs attendues). Le script versionné ne contient aucune donnée réelle.
4. **Sortie** dans `apps/extension/test/linkedin/` (1,5 Mo, exclue de Prettier) : 7 pages, les seules copies de l'inspecteur (les enregistrements Firefox sont ignorés) :
   - `profile-contract-type.html` : « Organisation · CDI », Coordonnées ouverte (e-mail) ;
   - `profile-accented-slug.html` et `profile-accented-slug-contact-info.html` : slug accentué, URL en `%xx` ; la seconde avec Coordonnées ouverte (e-mail, téléphone « (Mobile) ») ;
   - `profile-no-experience.html` : nom avec un point, headline seul, école ;
   - `profile-out-of-network.html` : hors réseau, « Organisation · CDI » ;
   - `search-people.html` et `search-people-page-2.html` : 10 `role="listitem"` chacune, relations en commun, liens encodés.
   `expected.json` donne pour chaque page l'URL de la page et, pour les profils, les valeurs inventées attendues (`name`, `jobTitle`, `organizationName`, `email`, `phone`). Les résultats attendus de la recherche sont à écrire par le ticket d'implémentation.
5. **Vérifié** : aucune valeur réelle connue dans la sortie, tous les textes restants relus (libellés, faux textes, dates, petits nombres), et les repères de la lecture intacts sur chaque page : titre = un seul `h2`, clés `componentkey` finissant par le faux slug, poste « - aujourd’hui » dans l'Expérience (sauf sans expérience), `dialog[open]` avec `mailto:`, résultats de recherche avec lien `/in/`. Les vraies pages contiennent aussi « plusieurs postes dans la même Organisation » (expériences passées).
6. **Pas de second jeu sur les vraies pages** : les copies anonymisées le remplacent. Quand LinkedIn change, Romain enregistre de nouvelles pages dans `.private/linkedin/` et relance le script (suggéré, jamais obligatoire). Relire la sortie avant de la commiter est suggéré, pas imposé.
7. **Cas limites par modification du DOM dans le test**, sur une page anonymisée : `h2` retiré (illisible), slug de l'URL changé (rien de lu), « (3) » ajouté au titre, `listitem` vidés (recherche illisible), expérience en cours retirée (Organisation vide, poste = headline). « LinkedIn en anglais » abandonné (français seulement).
8. **Lecture sur un `Document`** : les fonctions de lecture prennent un `Document` (`DOMParser`) et l'URL, jamais `document` ni `location`. Seuls les tests du content script touchent le DOM vivant.
9. **Headline localisé** (repli de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md), décision 2) : dans la `section` du haut du profil (celle du `h2` du nom, clé opaque), le premier `p` qui suit les `p` de degré (« · 1er », « · 2e »…).

Autour : `apps/extension/scripts/tsconfig.json` (DOM + Node), ajouté aux `references` du `tsconfig.json` racine ; `apps/extension/test/linkedin/*.html` dans `.prettierignore`. `pnpm check` passe.

## Comments

- 2026-10-30 : résolu avec Romain ; question recadrée au premier tour (vraies pages anonymisées plutôt que fixtures écrites à la main), puis toutes les recommandations acceptées. Exécution faite dans le ticket à sa demande, par exception à « la carte décide et ne construit pas ». Aucun terme nouveau pour `CONTEXT.md`, pas d'ADR. Pas de commit (Romain commite).
