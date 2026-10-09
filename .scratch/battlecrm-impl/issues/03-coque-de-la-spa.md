# 03: Coque de la SPA

**What to build:** la SPA React s'ouvre en FR ou EN, dans le thème Système / Clair / Sombre, avec la navigation de bureau (barre latérale) et de mobile (onglets en bas) menant à des écrans vides pour chaque entrée. Les jetons de couleur et les composants de base sont en place pour toutes les tranches suivantes. Sources : spec UX §1, §2, §3.1, §3.2, §7 ; spec stack §3.

**Blocked by:** 01

**Status:** resolved

- [x] Vite + React 19, TanStack Router (paramètres de recherche typés par Zod), TanStack Query (rejeu des mutations désactivé), client `hc<AppType>` branché sur l'API
- [x] `packages/i18n` : un projet Paraglide FR/EN ; `lang` de la page posé depuis la langue courante
- [x] `packages/theme` : jetons de la spec UX §2 (accent, succès, retard, bientôt, neutre) dans les deux thèmes, base Zinc, aucun rouge ni `--destructive` ; focus par un utilitaire unique sur `data-focus-visible`
- [x] Fournisseur de thème maison : Système / Clair / Sombre par appareil (`localStorage`, lu sans planter s'il est indisponible), suit `prefers-color-scheme` en direct
- [x] Composants shadcn base `aria` éjectés (Dialog, Combobox, Table, champs) ; aucun paquet banni
- [x] Bureau : barre latérale de la spec UX §3.1 (marque, Rechercher…, + Ajouter, groupes Prospection et Expérimentation, Réglages, Raccourcis, compte : **reporté au ticket 07**, voir commentaire) ; mobile : onglets Aujourd'hui, Contacts, Funnel, Plus ; bascule par la largeur seule (ST-02)
- [x] Lien « Aller au contenu », régions repères ; cibles 24 px / 44 px
- [x] Logo recoloré en dégradé teal `#115e59` → `#0d9488`
- [x] Tests web en mode navigateur avec axe bloquant sur la coque, dans les deux thèmes

## Comments

**2026-10-09, implémentation (agent).**

- **Pile** : Vite 8, React 19, TanStack Router (routes en code, sans génération), TanStack Query, React Aria Components, Tailwind 4. `minimumReleaseAge` a retenu `react-aria-components` 1.21.1, `@inlang/paraglide-js` 2.25.4, `lucide-react` 1.50.0.
- **Client d'API** : `createApiClient()` renvoie `hc<AppType>(origin).api`. Pour que `AppType` porte les routes, `createApp` chaîne désormais `app.get('/health', …)` et renvoie ce résultat (`apps/api/src/app.ts`) ; `@battlecrm/api` exporte `./src/app.ts`, en dépendance de dev du web (types seuls). Chaque route future devra être chaînée de la même façon.
- **TanStack Query** : `mutations: { networkMode: 'always', retry: false }`. Hors ligne, une mutation échoue tout de suite au lieu d'être mise en pause puis rejouée (test).
- **Paramètres de recherche typés par Zod** : aucun écran n'en a encore. TanStack Router accepte directement un schéma Zod 4 dans `validateSearch` (Standard Schema), sans adaptateur. `zod` sera ajouté au web avec le premier écran qui en a besoin.
- **Paraglide** : `packages/i18n` contient le projet (`project.inlang`, `messages/{fr,en}.json`) et compile vers `src/paraglide/` (ignoré par git) au `postinstall` du paquet, ou via `pnpm --filter @battlecrm/i18n compile` après une modification des messages. Le plugin de format est chargé depuis `node_modules`, donc sans réseau à la compilation. Stratégie `localStorage` → `preferredLanguage` → `baseLocale` (fr) ; le ticket 20 branchera la langue de l'Utilisateur dessus. `applyDocumentLanguage()` pose `lang` au démarrage. **Écart à la spec stack §2** : `@battlecrm/i18n` exporte du JS généré (avec ses `.d.ts`) et `@battlecrm/theme` une feuille CSS, pas des `.ts` ; `packages/theme` n'a plus de projet TypeScript.
- **Jetons** (`packages/theme/src/theme.css`) : base Zinc et rôles de la spec UX §2 (`accent`, `accent-text`, `success`, `overdue`, `soon-text`/`soon-gauge`, `neutral-dot`/`neutral-text`), thème sombre par la classe `dark` sur `<html>`. `--input` vaut `#71717a` pour le 3:1 des contours de champ. Le `primary` de shadcn est devenu `accent`, son `accent` (survol) est devenu `surface`.
- **Focus** : un seul utilitaire `focus-ring`, sur `data-focus-visible` pour React Aria, et sur `:focus-visible` pour un élément natif (`data-rac` absent, ici le lien « Aller au contenu »). Dans un groupe de champ, c'est le groupe qui porte l'anneau, pas son contrôle (`index.css`).
- **Composants éjectés** : générés par `shadcn init -b aria` puis `eject` dans un projet jetable, copiés dans `apps/web/src/components/ui` (button, dialog, combobox, table, input, textarea, field, label, separator, input-group). Adaptations : plus de `destructive` ni de classes `aria-invalid` rouges, focus par `focus-ring` (y compris lignes et cellules de Table), jetons du thème, rayons `rounded-control`/`rounded-card`, libellés « Fermer »/« Effacer » par Paraglide. Le `onClick` de `InputGroupAddon` et les `role="group"` de `Field` et `InputGroupAddon` ont été retirés (règles jsx-a11y). Dépendances runtime : `react-aria-components`, `class-variance-authority`, `cn` (le fusionneur de classes de shadcn), `lucide-react`, `tw-animate-css`.
- **Navigation** : le `RouterProvider` de React Aria est branché sur TanStack Router, avec des chemins typés (`RouterConfig`) ; tout composant React Aria à `href` navigue par le routeur. La bascule bureau/mobile est en CSS seul (`md`, 48 rem). Chemins : `/today`, `/circle`, `/contacts`, `/funnel`, `/battles`, `/positionings`, `/insights`, `/settings`, `/more` ; `/` redirige vers `/today`. « Indicateurs » se dit « Insights » en anglais (nom d'écran, pas de terme au glossaire). Sur mobile, l'écran Plus liste Cercle, Battles, Indicateurs, Réglages puis « Sur ordinateur » : Positionnements ; l'onglet Plus reste courant sur ces écrans.
- **Laissé aux tickets suivants** : les boutons Rechercher…, + Ajouter et Raccourcis sont rendus sans action (41, 13) ; l'adresse du compte et « Se déconnecter » (07) ; les pastilles (37) ; le bouton + flottant du mobile (40) ; le choix du thème et de la langue dans Réglages (20). Le fournisseur de thème expose déjà `useTheme().setPreference`.
- **Connu** : le thème s'applique au montage de React ; avant le chargement du JS, la page vide reste claire en thème sombre. Un script en ligne dans `index.html` l'éviterait, à trancher avec la CSP du conteneur `web` (ticket 04).
- **Tests** (projet Vitest `web`, qui reprend `apps/web/vite.config.ts` pour qu'axe mesure les vrais styles) : thème (système en direct par une commande Playwright `emulateColorScheme`, choix conservé, stockage indisponible), coque (entrées et écrans, largeurs, cibles 24/44 px, lien d'évitement, repères, anglais et `lang`), axe bloquant en clair et en sombre, bureau et mobile. Vérifiés par mutation : un contraste dégradé et des onglets toujours visibles font échouer les tests.
