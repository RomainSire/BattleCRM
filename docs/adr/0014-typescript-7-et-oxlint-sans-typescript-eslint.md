# TypeScript 7 et Oxlint, sans typescript-eslint

Le monorepo compile avec TypeScript 7 (le compilateur natif) et se vérifie avec Oxlint en mode typé (tsgolint), au lieu de TypeScript 6 avec ESLint et typescript-eslint. TypeScript 7.0 n'a pas d'API programmatique : typescript-eslint et `astro check` ne tournent pas dessus avant la 7.1 et leurs portages (attendus début 2027). TS 6 + ESLint aurait été l'écosystème le plus mûr (plugins de frontières, règles maison faciles), mais sur une version de transition, avec une migration certaine en 2027 ; Oxlint couvre déjà 59 des 61 règles typées de typescript-eslint, `react-hooks`, `jsx-a11y` et `no-restricted-imports` par dossier, et rend son verdict assez vite pour qu'un agent le relance à chaque modification. Biome a été écarté : son moteur de types maison ne voit qu'un fichier à la fois.

## Consequences

- Les règles d'architecture passent par ce qu'Oxlint offre nativement (`no-restricted-imports`, `no-restricted-globals`, `overrides` par dossier) ou par le compilateur ; les plugins JS d'Oxlint (alpha) ne sont pas utilisés, et ce qui n'est pas exprimable reste en revue.
- `apps/site` (Astro) garde TypeScript 6 pour `astro check` jusqu'à son portage, ou s'en passe ; le build Astro attrape l'essentiel.
- Le formatage reste à Prettier tant qu'oxfmt n'est pas en 1.0.
