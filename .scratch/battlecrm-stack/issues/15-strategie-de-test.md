# Stratégie de test

Type: grilling
Status: resolved
Blocked by: 09

## Question

Comment l'app est-elle testée, à quels niveaux et avec quels outils ?

À trancher :
- Niveaux et frontières : tests unitaires de `packages/domain` (Règle de victoire exacte, choix du Tirage, états du jour, jour local, normalisation) ; tests des gestes par leur endpoint contre un vrai Postgres (RLS forcée, `withUser`, index partiels, inverses d'« Annuler » de l'ADR 0011) ; tests de bout en bout du navigateur (lesquels, combien).
- Outils : lanceur (Vitest…), base de test (conteneur jetable, une base par fichier ou par transaction annulée), bout en bout (Playwright…), en local et en CI.
- Tests de sécurité exigés par « [Auth : bibliothèque, sessions et client extension](08-auth.md) » (`trustDevice` forcé à faux, liste blanche) et par l'ADR 0009 (un Utilisateur ne voit jamais les lignes d'un autre, même si le filtre est oublié).
- Contrôle automatique d'accessibilité (ST-80) : outil, écrans couverts, bloquant en CI ou non ; ce qui reste manuel (lecteur d'écran, zoom 400 %).
- Temps et hasard injectés (horloge, fuseau, `random`) pour tester valeurs en vigueur, Cadence et Tirage sans attendre.

- Outillage tranché par « [Outillage du monorepo](13-outillage-monorepo.md) » : TypeScript 7, Oxlint, scripts pnpm, `pnpm check` qui lance les tests, CI `ci` bloquante.

- E-mails (« [E-mails transactionnels traduits](14-e-mails.md) ») : aucun test n'envoie d'e-mail ; un faux `EmailTransport` enregistre les envois pour vérifier contenu, langue et liens (vérification, réinitialisation…).

Entrées : « [Architecture : où vivent les règles du domaine](09-architecture.md) », « [Base de données et accès aux données](07-donnees.md) ».

## Answer

Tranché avec Romain le 2026-10-08. Pas d'ADR : rien de difficile à défaire.

- **Niveaux** : le gros des tests porte sur **les gestes par leur endpoint**, avec l'app Hono en mémoire (`app.request()`, sans serveur HTTP) contre un vrai Postgres. On vérifie la réponse, les lignes du résumé renvoyées et l'inverse d'« Annuler ». Autour :
  - **unitaires exhaustifs** de `packages/domain` ;
  - **composants** de la SPA, limités aux trois écrits à la main (kanban, toast, panneau non modal), dans un vrai navigateur ;
  - **quelques parcours de bout en bout**.

  Ni composants shadcn ni pages en test unitaire.
- **Lanceur** : **Vitest 4**, `vitest.config` racine en `projects` : `domain`, `api` (Node), `web` (mode navigateur, fournisseur Playwright). `pnpm check` lance `vitest run`. Pas de seuil de couverture.
- **Base de test** : **une base par exécution**, migrée une fois par le vrai point d'entrée `migrate` sous le rôle propriétaire. **Chaque test crée son propre Utilisateur** : l'isolation par Utilisateur sépare les tests, sans nettoyage et en parallèle. Postgres 18 d'un `compose.dev.yml` en local (base `battlecrm_test` à côté de celle de dev), `services: postgres` en CI, sans Testcontainers.
  - Les tests se connectent sous **le rôle applicatif de la prod**, ni propriétaire ni superutilisateur, car un superutilisateur contourne la RLS même forcée. Un test de garde vérifie au démarrage l'absence de `BYPASSRLS` et du statut de superutilisateur.
- **Données de test** : des **fabriques** (`apps/api/test/factories`, `makeUser()`, `makeBattle(user, { trials })`…) insèrent directement en base dans `withUser`, donc sous RLS.
  - Chaque fabrique ne produit que des états atteignables par les gestes.
  - `makeUser()` contourne l'inscription : Utilisateur vérifié, cookie de session renvoyé.
  - Le geste testé passe **toujours** par son endpoint.
- **Temps, hasard et frontières** : une racine de composition `createApp({ clock, random, email, hibp, config })`.
  - **Horloge** : `clock.now()` pilotable (`advance('P7D')`). **Aucun `DEFAULT now()` pour un horodatage du domaine** : l'app l'écrit depuis `clock`.
  - **Hasard** : `random` scriptable, pour forcer un Tirage.
  - **E-mails** : le faux `EmailTransport` (« [E-mails transactionnels traduits](14-e-mails.md) »).
  - **Have I Been Pwned** : jamais de réseau en test (vérificateur injecté ou `undici` `MockAgent`).
  - **Délais internes de Better Auth** (sessions 90 j, récupération J+7) : `vi.useFakeTimers({ toFake: ['Date'] })` dans ces seuls tests.
  - **Planificateur** : les tâches sont appelées directement, avec l'horloge factice.
  - **Fuseau** : `TZ=UTC` forcé pour le processus. Des cas explicites placent le fuseau de l'Utilisateur à minuit et au changement d'heure (`Pacific/Kiritimati`, `America/St_Johns`, `Europe/Paris` fin octobre).
- **Sécurité** (ADR 0009, « [Auth : bibliothèque, sessions et client extension](08-auth.md) »), des tests systématiques et générés :
  1. **catalogue** : toute table applicative hors Better Auth a `user_id`, la RLS activée et forcée, et une politique ;
  2. **filtre oublié** : A sème une ligne par table, et un `select` brut sans `where` dans `withUser(B)` renvoie 0 ligne ;
  3. **inventaire des routes** : `app.routes` parcouru ; chaque route est en liste blanche de Better Auth ou derrière le middleware, et tout répond 401 ou 404 sans session ;
  4. **accès croisé** : chaque endpoint de geste appelé par B avec les identifiants de A répond 404 et ne change rien ;
  5. **auth** : `trustDevice` forcé à faux, chemins hors liste blanche en 404, `SIGNUPS_OPEN` fermé par défaut ;
  6. **instantané des routes de Better Auth** : la liste des routes exposées est comparée à un instantané relu. Une montée de version qui en ajoute une casse la CI, et il faut alors classer la route (liste blanche ou 404). Pas de fusion automatique Renovate pour `better-auth`.
- **Règle par geste** : au moins un test du chemin nominal et un test de son inverse « Annuler », dont le refus après 15 min ou après un geste ultérieur. Le geste entre aussi dans l'inventaire de sécurité. Le TDD est recommandé dans les tickets d'implémentation, pas imposé. **fast-check** est réservé à `packages/domain` : équilibre de `chooseAssignment`, symétrie et monotonie de la Règle de victoire, idempotence de la normalisation.
- **Migrations** : la CI échoue si `drizzle-kit generate` produit un fichier (dérive du schéma). Toutes les migrations sont rejouées depuis zéro à chaque exécution. Pas de test automatique de compatibilité N-1 : on s'en remet à la relecture expand/contract (ADR 0013).
- **Bout en bout** : Playwright **contre les images construites** (`api`, `web` nginx, Postgres) via un `compose.e2e.yml`, sous Firefox et Chromium.
  - **Six parcours environ** : connexion avec 2FA ; Contact → Battle (Tirage) → Interaction → « Annuler » ; kanban à la souris et au clavier ; consultation hors ligne (ADR 0004) ; rechargement sur changement de `X-App-Version` ; « Aujourd'hui ».
  - **Utilisateur de départ** semé en base par un `globalSetup`. L'inscription par e-mail est couverte au niveau des endpoints.
  - **En CI** : un job séparé et parallèle du workflow `ci`, pour tenir les ~5 min.
- **Accessibilité (ST-80)** : `@axe-core/playwright` sur **chaque écran, dans les deux thèmes**, **bloquant sur toute violation**. Les exceptions sont nommées et justifiées dans le code. La navigation au clavier du kanban, du panneau et du toast est testée en bout en bout et en composant. Restent manuels : le lecteur d'écran (Orca/NVDA) et le zoom à 400 %, par une liste `docs/a11y-checklist.md` déroulée quand un écran est créé ou remanié, et cochée dans le ticket d'implémentation.
