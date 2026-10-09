# Spec stack : BattleCRM

Status: ready-for-agent
Source : [carte stack](map.md), 18 tickets résolus (`issues/01` à `issues/18`), consolidés le 2026-10-08.

Cette spec est la destination de la carte stack. Elle rassemble les choix de langages, frameworks, données, auth, architecture, test, déploiement et exploitation, et donne pour chaque exigence `ST-xx` de la [spec UX](../battlecrm-ux/spec.md) (§8) sa réponse (§14). Elle alimente directement le découpage en tickets d'implémentation.

**Ce qui fait foi.** Le vocabulaire vient de [`CONTEXT.md`](../../CONTEXT.md), les choix difficiles à défaire de [`docs/adr/`](../../docs/adr/) (0008 à 0014 pour la stack). Le détail de chaque décision (options écartées, raisons, faits vérifiés) reste dans son ticket ; cette spec n'en garde que la décision et renvoie au ticket entre crochets.

**Tout le code est en anglais** : fichiers, identifiants, tables, colonnes, endpoints, commentaires. Les termes du domaine prennent la ligne `_EN_` de `CONTEXT.md` ; une notion sans terme au glossaire s'y règle d'abord (règle de revue).

---

## 1. Vue d'ensemble

```
battlecrm.romainsire.com ──► web (nginx) ── landing Astro statique
app.battlecrm.romainsire.com
   ├─ /api/*  ──────────────► api (Node LTS, Hono) ──► postgres 18 (réseau interne)
   └─ le reste ─────────────► web (nginx) ── SPA React (PWA)
extension Firefox (plus tard) ─► /api/* en jeton bearer
```

- **TypeScript de bout en bout**, en monorepo pnpm (ADR 0008). Repli nommé pour l'API : Go.
- **SPA Vite + API séparée**, même origine (`/api`), pas de rendu serveur pour l'app. La même API sert la SPA et l'extension.
- **Une seule instance** de chaque conteneur, sur le VPS de Romain (Docker, Traefik). Rien de payant, aucun service tiers ajouté.

## 2. Monorepo et outillage

[Forme de l'app et langages](issues/06-forme-app-langages.md), [Outillage du monorepo](issues/13-outillage-monorepo.md) ; ADR 0008, 0014.

- **pnpm** seul (`packageManager` épinglé), **catalogs** pour toute dépendance partagée, `minimumReleaseAge` 7 jours, liste blanche des scripts d'installation.
- **Workspaces** (`@battlecrm/*`), paquets **source seule** (`exports` vers les `.ts`) :

| Workspace | Rôle |
|---|---|
| `apps/web` | SPA (composants shadcn éjectés compris) |
| `apps/api` | API Hono, point d'entrée `migrate` |
| `apps/site` | landing Astro |
| `apps/extension` | extension Firefox, plus tard (§9) |
| `packages/domain` | règles pures, sans E/S (§5.3) |
| `packages/contract` | schémas Zod écrits à la main, types de l'API |
| `packages/theme` | jetons Tailwind partagés par web et site |
| `packages/i18n` | un seul projet Paraglide : app, landing, e-mails |

- **TypeScript 7** (`tsc -b` : le binaire de TS 7 stable s'appelle `tsc`, `tsgo` était celui de la préversion), `tsconfig.base.json` racine ; `apps/site` reste en TS 6 pour `astro check` jusqu'à son portage. Options : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (ni `enum` ni `namespace`).
- **Lint** : Oxlint en mode typé, règles natives seules. **Format** : Prettier + `prettier-plugin-tailwindcss`.
- **Commande unique `pnpm check`** (format, lint, types, tests), scripts pnpm récursifs, ni Turborepo ni hooks git.
- **Interdictions outillées** :
  - entrer dans le dossier d'un autre module de l'API (`no-restricted-imports`) : on passe par son `index.ts` ;
  - `withoutIsolation` hors de `auth/` et `migrate` ; aucun `schema` passé à `drizzle()` (`db.query…` ne compile pas) ;
  - `packages/domain` sans dépendance, `lib: ["ES2024"]` sans DOM, `types: []`, `crypto` et `performance` interdits, `Date.now` et `Math.random` interdits si Oxlint le permet (sinon revue) ;
  - paquets bannis, avec l'alternative dans le message : `@base-ui/react`, `@radix-ui/*`, `radix-ui`, `cmdk`, `vaul`, `sonner`, `next-themes`, `react-router`, `i18next`, `react-i18next`, `@prisma/client`, `drizzle-zod`.
- **Renovate** hebdomadaire et groupé (catalogs, images, Actions épinglées par SHA) ; fusion automatique des correctifs d'outils de dev si la CI passe ; Drizzle, Better Auth et `postgres` toujours en PR manuelle, versions exactes.
- **`CLAUDE.md` racine** court : `pnpm check` avant de rendre la main ; code en anglais d'après `CONTEXT.md` ; jamais d'import profond d'un autre module ; jamais de `drizzle-kit push` ni d'édition d'une migration livrée ; expand/contract.

## 3. Front : la SPA

[Candidats front](issues/02-candidats-front.md), [shadcn/ui face aux bibliothèques headless](issues/12-shadcn-et-bibliotheques.md), [Forme de l'app et langages](issues/06-forme-app-langages.md), [Architecture](issues/09-architecture.md) ; ADR 0004, 0012.

- **React 19**, **TanStack Router** (routes et paramètres de recherche typés, validés par Zod), **TanStack Query**, **Paraglide** (messages compilés en fonctions typées), **vite-plugin-pwa**, **tinykeys**, **Tailwind 4**.
- **Composants** : shadcn/ui en base **`aria`** (React Aria Components), puis `shadcn eject` : le code est possédé, le CLI n'est jamais une dépendance. Gardés : palette (Autocomplete), Table, Dialog, Combobox, champs. **Écrits à la main** : le toast (sur `UNSTABLE_Toast` de React Aria), le panneau non modal, le kanban et le réordonnancement des Étapes (GridList + `useDragAndDrop`, d'après l'exemple Kanban d'Adobe), le fournisseur de thème. Sheet React Aria en feuille plein écran sur mobile. Repli : shadcn base Base UI.
- **Thème** : jetons de la spec UX §2 dans `packages/theme`, base Zinc, ni `--destructive` ni variante rouge ; focus par un utilitaire unique sur `data-focus-visible`.
- **Résumé de travail complet** (ADR 0012) : `GET /api/summary` chargé dans TanStack Query et **persisté dans IndexedDB** ; recherche, doublons, pastille et « Aujourd'hui » se calculent localement avec `packages/domain`. Le détail (historiques, agrégats sur 12 mois) se charge à la demande. Chaque geste renvoie les lignes du résumé qu'il a changées.
- **Hors ligne en consultation seulement** (ADR 0004) : coque précachée par le service worker, qui **ne cache aucune réponse d'API** (une seule copie à purger) ; actions désactivées hors ligne avec un message ; **mutations jamais persistées ni rejouées** (désactiver le rejeu par défaut de TanStack Query).
- **Nouvelle version** : l'API renvoie `X-App-Version` ; à un écart, la SPA lance `registration.update()`, puis propose « Nouvelle version disponible, recharger » (`updateSW(true)`). Jamais forcé.
- **Transport** : client RPC de Hono (`hc<AppType>`) ; repli `fetch` + Zod.

## 4. Landing page

[Forme de l'app et langages](issues/06-forme-app-langages.md).

- **Astro statique**, FR/EN par Paraglide (`packages/i18n`), mêmes jetons (`packages/theme`). Servie par le conteneur `web` sur `battlecrm.romainsire.com` ; elle reste en ligne quand l'API redémarre.
- **Vitrine seule**, sans compte de démo ; elle ne lit pas `SIGNUPS_OPEN`. Son contenu est hors de cette spec, pour une session de grilling dédiée.
- **À trancher avec son contenu, avant sa première mise en ligne** : les **mentions légales** (identité de l'éditeur et de l'hébergeur, exigées par la LCEN pour toute page publique, inscriptions ouvertes ou non : elles ne peuvent pas attendre le chantier RGPD du §16) et la présence ou non de statistiques de visite (sans elles, aucun bandeau de cookies).

## 5. API et architecture

[Architecture : où vivent les règles du domaine](issues/09-architecture.md) ; ADR 0011, 0012.

### 5.1 Pile

TypeScript sur **Node 24 LTS** (`.node-version`), **Hono** (`basePath('/api')`), **Zod**. En dev, `node --watch src/main.ts` (TS natif) ; en prod, **bundle tsdown** (`dist/main.js` et `migrate`). Configuration validée par Zod au démarrage : refus de démarrer si elle manque.

### 5.2 Modules

Modules profonds dans `apps/api/src/<module>/`, chacun **seul à écrire ses tables** (`<module>/tables.ts`). Un autre module passe par une fonction exportée qui reçoit la même `tx`. Pas de couche repository : les gestes écrivent leur SQL Drizzle dans `withUser`.

| Module | Contenu |
|---|---|
| `prospecting` | Contacts, États, Interactions, Relances et Cadence, Essais et Tirage (gestes de la fiche Contact) |
| `battles` | ouvrir, clôturer, Verdict, Champion, Historique des Champions |
| `funnel` | Étapes (ordre, archivage), Positionnements (copie modifiée, pièces jointes) ; exporte `stageOrder(tx)` |
| `organizations` | unicité normalisée, fusion |
| `settings` | préférences et valeurs en vigueur ; exporte `localDateOf(tx, instant)`, `activityGoalOn(tx, date)`, `entryGoalForWeek(tx, monday)` et les écritures « à partir du lendemain / du lundi suivant » |
| `views` | lectures par vue (`GET /summary`, Aujourd'hui, Indicateurs, Activité, Taux de passage), `daily_pick` ; lit les tables des autres modules (sauf `auth`), n'écrit que les siennes |
| `auth` | Better Auth et parcours maison (§7) ; n'expose que « qui est l'Utilisateur » (`c.var.userId` ou 401) |
| `db` | `withUser(userId, fn)` pour tous ; `withoutIsolation` pour `auth` seul |
| `jobs` | planificateur dans le processus (§10.6) |
| `email` | transport et gabarits (§8) |

### 5.3 Où vivent les règles

- **`packages/domain`**, importé par l'API et la SPA, sans E/S : « maintenant », fuseau et hasard en paramètres, avec ses propres types d'entrée. Il contient :
  - les états du jour, jamais stockés : `contactAgenda(contact, today)`, `allySignal(ally, today, rhythm)` ;
  - la Règle de victoire, `evaluateWinRule(counts, threshold, horizon)`, calcul exact sur deux lois Bêta (ADR 0001) ;
  - le choix équilibré du Tirage, `chooseAssignment(counts, random)` (ADR 0002) ;
  - la normalisation (noms d'Organisation, URL LinkedIn), partagée par l'index unique et la vérification des doublons.
- **Dans l'API** : le hasard (`crypto.randomInt`), le verrou sur la Battle (`SELECT … FOR UPDATE`) et la réservation du Tirage (`prospecting`) ; le jour local, calculé **à l'écriture** par `settings.localDateOf` ; les transitions d'État permises.

### 5.4 Gestes et « Annuler »

- **Un endpoint par geste** (`POST /contacts/:id/use-positioning`…), une transaction chacun ; il renvoie les lignes du résumé changées et un `undoToken`.
- **« Annuler »** (ADR 0011) : `POST /gestures/:id/undo` défait le geste dans une transaction (supprime ce qu'il a créé, restaure ce qu'il a modifié) d'après la table `gesture` ; chaque module écrit l'inverse de ses gestes. Accepté **15 min**, refusé si un geste ultérieur a touché le même Contact ou la même Battle. Le Tirage révélé survit ; une célébration affichée n'est pas défaite.
- **Compatibilité** : tout changement d'endpoint reste compatible avec la version précédente (expand/contract, règle de revue).

## 6. Données

[Base de données : SQLite ou Postgres](issues/03-base-de-donnees.md), [Base de données et accès aux données](issues/07-donnees.md) ; ADR 0003, 0006, 0009.

- **PostgreSQL 18**, base dédiée dans son conteneur, épinglée sur une mineure, sans port publié.
- **Drizzle 0.45** épinglé, pilote `pg`, **constructeur proche du SQL seul** (jamais `db.query…`) ; colonnes `date` en mode `string`. Passage à Drizzle 1.0 une fois stable, comme tâche planifiée. Repli : Kysely + `pg`.
- **Migrations** : `drizzle-kit generate` depuis les `src/*/tables.ts`, relues en revue ; compléments (`GRANT`, fonctions, politiques) en migrations `--custom` ; en avant seulement ; `drizzle-kit push` interdit hors base jetable. Appliquées par le point d'entrée **`migrate`** sous le rôle **propriétaire** (`NOSUPERUSER`) ; l'API ne connaît que le rôle **applicatif**.
- **Isolation (ADR 0009)** : filtre applicatif **et** RLS forcée. Chaque table métier porte `user_id` et une politique `user_id = current_setting('app.user_id')::uuid`. Toute requête métier passe par `withUser(userId, async (tx) => …)` (transaction + `set_config('app.user_id', …, true)`).
- **Garanties de la base** : clés étrangères **composites `(user_id, id)`** ; `NOT NULL` par défaut ; `CHECK` sur les énumérations ; **index uniques partiels** pour les « au plus un » (Essai en cours, Relance planifiée, Battle ouverte par Étape) ; index uniques sur les colonnes normalisées ; `ON DELETE CASCADE` depuis l'Utilisateur.
- **Identifiants** : UUID v7 générés par la base (`uuidv7()`), tables de Better Auth comprises.
- **Temps** :
  - instants en `timestamptz`, **écrits par l'app depuis son horloge**, jamais par un `DEFAULT now()` pour un horodatage du domaine ;
  - jours locaux en `date`, calculés à l'écriture dans le fuseau en vigueur, lus comme chaînes `YYYY-MM-DD`, jamais en `Date` JS ;
  - valeurs en vigueur (fuseau, Objectif d'activité, Objectif d'entrées) dans des tables `(user_id, effective_from, value)` (ADR 0003).
- **Anonymisation (ADR 0006)** : sur place ; champs identifiants et notes d'Interactions effacés, marqueur `anonymized_at`, `CHECK` qu'un Contact anonymisé n'a plus de champ identifiant.
- **Pièces jointes** : `bytea` dans `attachment_blob`, sous RLS ; 5 Mio par fichier, 100 Mio par Utilisateur ; tous types, servis en `Content-Disposition: attachment` avec `nosniff`, par une route sous `withUser`. Derrière une interface de stockage du module `funnel` (`put`, `get`, `delete`), qui garde la porte ouverte à un S3.
- **Better Auth** : adaptateur Drizzle, `better-auth` ≥ 1.7.7 ; schéma généré par sa CLI, migré comme le reste ; tables **hors RLS**, avec des `GRANT` limités.

## 7. Authentification

[Auth : ce que couvrent les bibliothèques](issues/04-auth.md), [Auth : bibliothèque, sessions et client extension](issues/08-auth.md) ; ADR 0010.

- **Better Auth en noyau** derrière une **liste blanche de chemins** dans Hono (le reste répond 404) ; plugins `twoFactor` et `haveIBeenPwned` seuls. Hors liste : `/sign-up/email`, `/change-email`, `/reset-password`, remplacés par des parcours maison. `hooks.before` force `trustDevice: false` ; `customSyntheticUser` contre l'énumération.
- **Inscription maison** : chaque tentative est une ligne `pending_signup` (e-mail, empreinte du mot de passe, langue, fuseau, empreinte du jeton) ; le compte n'est créé qu'au clic, avec le mot de passe de cette tentative, qui ouvre une session. Adresse déjà prise : même réponse, e-mail « Tu as déjà un compte ».
- **`SIGNUPS_OPEN`** (`true|false`, **fermé par défaut**), lu par l'API seule ; `GET /api/config` renvoie `{ signupsOpen }`. Une tentative commencée reste vérifiable porte fermée.
- **Mots de passe** : 15 à 128 caractères, aucune autre règle ; HIBP (k-anonymat) à l'inscription, au changement et à la réinitialisation, **HIBP injoignable = refus** ; scrypt.
- **Sessions** : opaques en base, 90 j (`expiresIn`), `updateAge` 1 j, `cookieCache` désactivé ; cookie `__Secure-`, HttpOnly, **SameSite=Lax** ; CSRF par contrôle d'origine (liste d'origines partagée, §9). Révocation des autres sessions au changement et à la réinitialisation du mot de passe.
- **Limitation** : compteurs **en base**. Par IP : limiteur de Better Auth (stockage `database`, `trustedProxies` sur Traefik), 30 tentatives / 15 min. Par compte (table `login_attempt`) : 5 échecs en 15 min puis délai croissant, 10 échecs puis blocage de 15 min ; codes TOTP et de secours dans les mêmes compteurs.
- **Réauthentification** : le mot de passe accompagne **chaque** requête sensible (changer l'e-mail ou le mot de passe, activer ou désactiver la 2FA, régénérer les codes de secours), sans fenêtre.
- **Nouvel appareil** : cookie d'appareil `__Host-`, aléatoire, longue durée, qui survit à la déconnexion ; empreinte dans `known_device` ; e-mail de sécurité à une connexion réussie sans cookie connu, rien pour la première session du compte.
- **2FA** : TOTP et 10 codes de secours natifs ; nombre de codes restants par une route maison ; e-mails d'activation et de désactivation.
- **Récupération de la 2FA (maison)** : table `two_factor_recovery` ; alerte avec « Annuler », rappel à J-1, désactivation à J+7 par la tâche planifiée ; une connexion avec un vrai code annule.
- **Fin de réinitialisation et changement d'e-mail (maison)** : jeton à usage unique de 1 h ; la réinitialisation enchaîne code 2FA, nouveau mot de passe (HIBP), révocation de toutes les sessions, levée du blocage ; le changement d'e-mail exige le mot de passe, confirme sur la nouvelle adresse et prévient l'ancienne.
- **Module `auth`** : seul à toucher les tables de Better Auth et `pending_signup`, `known_device`, `login_attempt`, `two_factor_recovery`, toutes hors RLS.

## 8. E-mails transactionnels

[E-mails transactionnels traduits](issues/14-e-mails.md).

- **Nodemailer** sur `smtp.gmail.com:465` (mot de passe d'application) ; expéditeur `SMTP_USER` (le Gmail de Romain), nom « BattleCRM », sans `Reply-To`. `romainsire.com` est chez Tuta en DMARC strict : ne jamais l'utiliser comme expéditeur. Derrière une interface `EmailTransport` (`send`).
- **Module `email`** : `sendEmail(to, template, params)`, typé par gabarit ; seul `auth` l'appelle aujourd'hui.
- **Envoi direct après le commit**, sans `await`, sans file ni reprise ; un échec est journalisé (adresse masquée) et déclenche l'alerte (§11). E-mails planifiés : étape marquée en base dans la transaction, envoi après le commit. Au `SIGTERM`, l'API attend au plus ~5 s les envois en vol.
- **Gabarits** : fonctions TS `(params, locale) → { subject, text, html }`, un gabarit HTML minimal, version texte obligatoire, échappement par un tagged template testé. Textes Paraglide `email_*`. Liens construits sur `APP_HOST`.
- **Langue** : `verify_email` et `account_exists` dans la langue de la tentative ; les autres dans la langue de l'Utilisateur au moment de l'envoi ; dates dans son fuseau.
- **Les 12 gabarits** : `verify_email`, `account_exists`, `password_reset_link`, `password_changed`, `email_change_confirm`, `email_change_notice`, `two_factor_enabled`, `two_factor_disabled`, `new_device`, `two_factor_recovery_started`, `two_factor_recovery_reminder`, `two_factor_recovery_completed`. « Ce n'était pas moi » dans les e-mails de sécurité.
- **Dev** : le vrai Gmail (alias `+n` de `SMTP_USER`) ; **tests** : jamais d'envoi, faux transport.

## 9. Contrat d'API pour l'extension Firefox

[Contrat d'API pour l'extension](issues/18-contrat-api-extension.md) ; faits : [research/18-extension-firefox-auth.md](research/18-extension-firefox-auth.md) (lecture du code, à vérifier dans un vrai Firefox au début du chantier extension).

L'extension elle-même est hors périmètre ; la stack garantit ceci :

- **Session** : connexion dans l'extension (mot de passe puis 2FA), plugin `bearer` **activé avec le chantier extension** (en attendant, l'API n'accepte que le cookie). Même ligne `session` que le cookie : 90 j glissants, marquée « Extension Firefox » dans « Appareils connectés », révocable, compte comme un nouvel appareil. Jeton dans `browser.storage.local`, appels en `credentials: 'omit'`. Mêmes droits que la SPA.
- **Origine** : aucun CORS (le background contourne CORS par `host_permissions` ; les content scripts passent par lui). **Une seule liste d'origines** dans la configuration : l'origine de l'app et `moz-extension://` (tout uuid), partagée par `trustedOrigins` de Better Auth et le contrôle d'origine des routes Hono métier (`csrf()`). `browser_specific_settings.gecko.id` fixé.
- **Surface** : les endpoints « un par geste » de la SPA. Aucun endpoint ne suppose la SPA (ni cookie d'appareil, ni en-tête propre à la SPA). Un geste propre à l'extension sera un endpoint comme les autres.
- **Client** : `apps/extension` dans le monorepo, sur `packages/contract`, `packages/domain`, `packages/i18n` et `hc<AppType>` ; même numéro de version que l'app.
- **Versions** : la règle N-1 reste la seule fenêtre. L'extension envoie `X-Client: extension/<version>` ; en dessous de la constante `MIN_EXTENSION_VERSION`, l'API répond `426` ; on ne la monte que quand une étape « contract » casse l'extension.
- **Limitation et tests** : aucun quota propre ; quand `bearer` est activé, les tests de sécurité générés tournent pour les deux modes et doivent donner les mêmes refus.

## 10. Déploiement et exploitation

[Relevé du VPS](issues/05-releve-vps.md), [Déploiement](issues/10-deploiement.md) ; ADR 0013.

### 10.1 Images et conteneurs

- Deux images **publiques sur GHCR**, `linux/amd64` :
  - `api` : `node:24-alpine`, multi-étapes, `pnpm deploy --prod`, points d'entrée `main` et `migrate` ;
  - `web` : nginx non privilégié, sert la SPA et la landing selon l'hôte.
- `/opt/docker/battlecrm/docker-compose.prod.yml` : `web`, `api`, `postgres`, `migrate` (ponctuel). **Tous exclus de Watchtower** par label. Une seule instance d'API.
- **Réglages** : journaux `json-file` (`max-size: 10m`, `max-file: 3`) ; `restart: unless-stopped` ; Postgres sur le seul réseau interne ; `web` et `api` non root, système de fichiers en lecture seule où c'est possible ; `postgresql.conf` versionné et monté.
- **Mémoire** (`mem_limit`, sans swap) : `api` 384 Mio (`--max-old-space-size=256`), `postgres` 512 Mio (`shared_buffers=128MB`, `max_connections=20`), `web` 64 Mio, `migrate` 256 Mio ; à revoir après une semaine de `docker stats`.

### 10.2 Adresses et réseau

- Landing sur `battlecrm.romainsire.com`, SPA sur `app.battlecrm.romainsire.com`, API sous `/api` du même hôte. Traefik route `Host(app…) && PathPrefix(/api)` vers `api` (priorité haute), le reste vers `web`, sans `StripPrefix`. Pas de `www`. Hôtes lus dans `APP_HOST`, `SITE_HOST`.
- **En-têtes** : nginx pose HSTS, CSP stricte, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` ; Hono `secureHeaders` pour `/api`. Traefik ne porte qu'un ratelimit grossier par IP sur `/api`. L'API n'accepte `X-Forwarded-For` que depuis `traefik-public`.

### 10.3 Livraison

- Push sur `main` : CI seule (`ci` : install, `prettier --check`, `oxlint --type-aware`, `tsc -b`, tests, build ; tout bloquant ; e2e en job parallèle).
- **Tag SemVer `v*`** posé par `pnpm version` (version unique) : le workflow `release` refuse un tag hors de `main`, rejoue la CI, pousse les images (`1.2.3`, `sha-<court>`), lance `deploy.sh v1.2.3` en SSH, crée la GitHub Release. Retour arrière manuel par `workflow_dispatch`.
- **`deploy.sh <tag>`** : `migrate` (un échec arrête tout), `up -d`, attente de `/api/health` ; en cas d'échec, **retour automatique** au tag précédent (`deployed_tag`). Il dépose aussi `ops/backup.sh`.
- **SSH** : utilisateur dédié `battlecrm-deploy` (groupe `docker`, sans sudo), clé en `restrict,command="/opt/docker/battlecrm/deploy.sh"`, tag validé (`^v\d+\.\d+\.\d+$`). Les secrets GitHub ne portent que la clé et l'hôte.
- **Expand/contract** : toute migration et tout changement d'endpoint restent compatibles avec la version précédente ; le retour arrière ne défait que les images.

### 10.4 Configuration et secrets

Écrits à la main sur le VPS, droits 600, jamais dans GitHub ; un fichier par service (`env_file`), un `.env.example` versionné par fichier :

- `postgres.env` : superutilisateur ;
- `migrate.env` : rôle propriétaire ;
- `api.env` : rôle applicatif, `BETTER_AUTH_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM_NAME`, `SIGNUPS_OPEN=false`, `APP_HOST`, `SITE_HOST`, `UPTIME_KUMA_PUSH_URL` (facultatif).

Rôles propriétaire et applicatif créés par un script `docker-entrypoint-initdb.d`.

### 10.5 Bascule depuis la V1

La V1 est supprimée sans dump (conteneurs, volume `battlecrm_pgdata`, `/opt/docker/battlecrm`) ; l'ancienne clé de déploiement est retirée ; la V2 s'installe au même endroit. Créer l'entrée DNS de `app.battlecrm.romainsire.com` si elle manque.

### 10.6 Tâches planifiées

Planificateur **dans le processus de l'API** (module `jobs`) : boucle toutes les 15 min, tâches idempotentes en SQL, une seule instance. Tâches : purge des inscriptions non vérifiées (7 j), échéances de la récupération 2FA, ménage des sessions expirées et des compteurs, ping `up` vers uptime-kuma toutes les 5 min. Le domaine n'en ajoute aucune (« rien n'est automatique »).

## 11. Observabilité

[Observabilité](issues/16-observabilite.md).

- **pino**, JSON sur stdout ; une ligne par requête (méthode, route modèle, statut, durée, `userId`, `requestId`), `requestId` renvoyé dans `X-Request-Id`. `info` en prod, `debug` + `pino-pretty` en dev. Lecture par `docker compose logs api | jq` ; conservation par la rotation Docker.
- **Jamais journalisé** : mots de passe, jetons, cookies, `Authorization`, codes 2FA, corps, contenu utilisateur, IP ; e-mails masqués. `redact` de pino, champs choisis à la main, un test le vérifie.
- **`GET /api/health`** : public ; `SELECT 1` et dernière migration de cette version **au moins** appliquée ; 200 `{ status, version }` ou 503. Ni SMTP ni tâches. Sert au healthcheck Docker, à `deploy.sh` et à uptime-kuma.
- **Alertes : uptime-kuma → Pushover**, la seule centrale. Un moniteur HTTP sur `/api/health` ; un moniteur push « BattleCRM API » (`up` du planificateur toutes les 5 min ; `down` sur toute exception imprévue, e-mail en échec et erreur du navigateur compris, sans contenu utilisateur). Le ping passe par une interface injectée dans `createApp`.
- **Erreurs du navigateur** : `POST /api/client-errors` (session requise), journalisées puis `down`.
- Ni métriques, ni Sentry, ni table d'erreurs.

## 12. Sauvegardes

[Sauvegardes et RGPD avant d'ouvrir les inscriptions](issues/17-sauvegardes-et-rgpd.md).

- **Cron de l'hôte à 3 h** : `ops/backup.sh` (versionné), `pg_dump -Fc` en superutilisateur par le socket local, dans `/opt/docker/battlecrm/backups/` (`700`, root) ; effacement au-delà de **30 jours** ; ping d'un moniteur push uptime-kuma distinct si tout a réussi (alerte sans ping pendant ~25 h).
- Ni copie hors du VPS ni chiffrement ; filet : instantanés hebdomadaires de l'hébergeur (≤ 3 semaines). Perte au plus 24 h (erreur applicative), une semaine (VPS perdu).
- **Restauration** documentée dans `docs/ops/restore.md`, essayée une fois à la main.

## 13. Stratégie de test

[Stratégie de test](issues/15-strategie-de-test.md).

- **Vitest 4** en projets : `domain`, `api` (Node), `web` (mode navigateur, Playwright). Pas de seuil de couverture.
- **Le gros aux gestes par endpoint** : `app.request()` contre un vrai Postgres 18 ; réponse, lignes du résumé et inverse d'« Annuler » vérifiés. Règle : au moins un test nominal et un test d'« Annuler » (refus compris) par geste.
- **Base** : une base par exécution, migrée par le vrai `migrate` ; **un Utilisateur par test**, en parallèle sans nettoyage ; connexion sous **le rôle applicatif de la prod** (un test de garde refuse superutilisateur et `BYPASSRLS`). Postgres d'un `compose.dev.yml` en local, `services: postgres` en CI.
- **Fabriques** (`apps/api/test/factories`) sous RLS, états atteignables seulement ; `makeUser()` renvoie un Utilisateur vérifié et son cookie.
- **Racine de composition** `createApp({ clock, random, email, hibp, config })` (et le ping d'alerte) : horloge pilotable, hasard scriptable, faux transport d'e-mails, HIBP sans réseau ; tâches planifiées appelées directement ; `TZ=UTC`, avec des cas de fuseau à minuit et au changement d'heure.
- **Sécurité, tests générés** : catalogue RLS ; filtre oublié ; inventaire des routes (401 ou 404 sans session) ; accès croisé (404 sans effet) ; garde-fous d'auth ; instantané des routes de Better Auth.
- **fast-check** dans `packages/domain` seul. **Dérive Drizzle** bloquante ; migrations rejouées depuis zéro.
- **Bout en bout** : Playwright contre les images construites (`compose.e2e.yml`), Firefox et Chromium, ~6 parcours (2FA ; Contact → Battle → Interaction → Annuler ; kanban souris et clavier ; hors ligne ; changement de `X-App-Version` ; Aujourd'hui).
- **Accessibilité** : axe bloquant sur chaque écran dans les deux thèmes ; lecteur d'écran et zoom 400 % par `docs/a11y-checklist.md`.

## 14. Réponse à chaque exigence `ST-xx`

Les numéros de section renvoient à cette spec. « Implémentation » signale un détail laissé au ticket d'implémentation, sans choix de stack en jeu.

### 14.1 Plateforme, distribution, hors-ligne

| ID | Réponse |
|---|---|
| ST-01 | PWA par vite-plugin-pwa (manifeste, service worker) (§3). |
| ST-02 | Points de rupture Tailwind sur la largeur, jamais de détection d'appareil (§3). |
| ST-03 | Coque précachée, résumé persisté dans IndexedDB, actions désactivées, aucune mutation rejouée ; « Copier le message » calculé localement (§3, ADR 0004). |
| ST-04 | Une seule copie locale (IndexedDB, le service worker ne cache pas l'API), purgée à la déconnexion et sur un 401 de session révoquée (§3). |
| ST-05 | Paraglide FR/EN (`packages/i18n`), `lang` de la page posé depuis la langue de l'Utilisateur (§2, §3). |

### 14.2 Comptes et sécurité

| ID | Réponse |
|---|---|
| ST-10 | `SIGNUPS_OPEN` fermé par défaut, `GET /api/config` ; tentative commencée vérifiable porte fermée (§7). |
| ST-11 | Module `email`, Nodemailer sur Gmail, 12 gabarits Paraglide (§8). |
| ST-12 | Jetons à usage unique : vérification 24 h (`pending_signup`), réinitialisation et changement d'e-mail 1 h ; « Renvoyer le lien » réémet un jeton pour la même tentative, délai entre deux envois à l'implémentation (§7). |
| ST-13 | Réponses neutres, `customSyntheticUser`, inscription maison qui répond pareil à une adresse prise, envoi sans `await` (§7, §8). |
| ST-14 | Plugin `haveIBeenPwned`, injoignable = refus (§7). |
| ST-15 | Limiteur de Better Auth par IP en base, compteurs par compte (`login_attempt`), filet Traefik (§7, §10.2). |
| ST-16 | Sessions opaques 90 j glissantes, sans cache de cookie, listées et révocables ; révocation au changement et à la réinitialisation (§7). |
| ST-17 | Cookie d'appareil `__Host-` et `known_device` (§7). |
| ST-18 | Plugin `twoFactor` ; nombre de codes restants par route maison (§7). |
| ST-19 | `two_factor_recovery`, tâche planifiée J-1 et J+7, e-mails d'alerte (§7, §10.6). |
| ST-20 | Mot de passe joint à chaque requête sensible, vérifié côté serveur (§7). |
| ST-21 | Purge des `pending_signup` à 7 jours par le planificateur (§10.6). |
| ST-22 | Destination dans un paramètre de recherche typé de TanStack Router, rejouée après la connexion (§3). |
| ST-23 | Filtre applicatif + RLS forcée, `withUser`, FK composites, tests de sécurité générés (§6, §13 ; ADR 0009). |

### 14.3 Données et intégrité du modèle

| ID | Réponse |
|---|---|
| ST-30 | Normalisation dans `packages/domain`, colonne normalisée sous index unique par `user_id` (§5.3, §6). |
| ST-31 | Geste de fusion du module `organizations`, une transaction (§5.2). |
| ST-32 | Faits lus en base par `funnel` (Étape passée, Positionnement utilisé) au moment du geste de suppression ou d'archivage, dans sa transaction (§5.2). |
| ST-33 | Positions de départ et d'arrivée dans l'ordre du moment, stockées sur chaque changement d'Étape (§5.3). |
| ST-34 | `chooseAssignment` dans `domain`, hasard, verrou sur la Battle et réservation dans `prospecting` ; dérogations et écarts tracés sur l'Essai (§5.3 ; ADR 0002). |
| ST-35 | `attachment_blob` en `bytea` sous RLS, 5 Mio par fichier, 100 Mio par Utilisateur, interface de stockage de `funnel` (§6). |
| ST-36 | Date de l'Interaction saisie distincte de l'horodatage d'écriture ; jour local calculé depuis la date saisie (§6). |
| ST-37 | Étapes types créées à la création du compte (au clic de vérification), dans la langue de la tentative, textes Paraglide (§7 ; implémentation). |
| ST-38 | Anonymisation sur place (`anonymized_at`, `CHECK`), copie locale rafraîchie par le résumé, dumps à 30 jours, journaux sans contenu (§6, §11, §12 ; ADR 0006). |
| ST-39 | Historique des changements d'État écrit par `prospecting` depuis l'horloge de l'app (jamais antidaté), avec la dernière Étape atteinte ; « Annuler » le supprime (§5.4, §6 ; ADR 0007, 0011). |

### 14.4 Temps et agrégats

| ID | Réponse |
|---|---|
| ST-40 | Fuseau détecté par le navigateur à l'inscription (`pending_signup`), valeurs en vigueur `(user_id, effective_from, value)` à partir du lendemain (§6, §7 ; ADR 0003). |
| ST-41 | Jour local stocké à l'écriture ; agrégats par `views`, chargés à la demande (§3, §5.2, §6). |
| ST-42 | Table des valeurs en vigueur, `settings.activityGoalOn` (§5.2, §6). |
| ST-43 | Calculé par `views` depuis l'historique des changements d'Étape (ST-33) (§5.2). |
| ST-44 | Fait « célébration du jour » enregistré côté serveur par jour local, porté par le résumé ; pas défait par « Annuler » (§5.4 ; implémentation). |
| ST-45 | `evaluateWinRule` dans `packages/domain`, exact et déterministe (§5.3 ; ADR 0001). |
| ST-46 | Calculé dans la SPA depuis le résumé par `contactAgenda` et `allySignal` (§3, §5.3). |
| ST-47 | `daily_pick` dans `views`, rempli à la première lecture du jour local, complété par « Un autre » et le remplacement ; « Plus tard » stocké par jour local (§5.2 ; implémentation). |
| ST-48 | `allySignal(ally, today, rhythm)` dans `packages/domain` (§5.3). |
| ST-49 | Entrées datées du jour local à l'écriture ; `settings.entryGoalForWeek`, écriture « à partir du lundi suivant » (§5.2, §6 ; ADR 0003). |

### 14.5 Préférences

| ID | Réponse |
|---|---|
| ST-50, ST-53, ST-54, ST-57, ST-58 | Préférences de l'Utilisateur en base, module `settings`, portées par le résumé (§5.2). |
| ST-51 | Valeur en vigueur historisée (ST-40) (§6). |
| ST-52 | Préférence d'appareil en `localStorage` ; fournisseur de thème maison qui suit `prefers-color-scheme` en direct (§3). |
| ST-55 | Préférence d'appareil en `localStorage` (§3). |
| ST-56 | `prefers-reduced-motion` seul, sans réglage (§3). |

### 14.6 Comportements côté interface

| ID | Réponse |
|---|---|
| ST-60 | API Clipboard ; message calculé localement, donc hors ligne aussi (§3). |
| ST-61 | Kanban et réordonnancement écrits sur GridList + `useDragAndDrop` de React Aria, glisser clavier compris ; pas de glisser tactile (§3). |
| ST-62 | Toast maison sur React Aria (10 s, pause au survol et au focus), `Ctrl Z` par tinykeys, `undoToken` et `POST /gestures/:id/undo` (§3, §5.4 ; ADR 0011). |
| ST-63 | Recherche en mémoire sur le résumé, sans aller-retour par frappe (§3). |
| ST-64 | Normalisation de `packages/domain` sur le résumé ; l'index unique tranche au serveur pour l'URL LinkedIn (§5.3, §6). |
| ST-65 | tinykeys, qui ignore les champs de saisie (§3). |
| ST-66 | Gestion du focus de React Aria ; panneau non modal écrit comme une région de la mise en page (§3). |
| ST-67 | Annonces de React Aria (toast, glisser-déposer), régions live au besoin (§3). |
| ST-68 | Jetons dans `packages/theme`, axe bloquant dans les deux thèmes (§2, §13). |
| ST-69 | Variantes `motion-reduce` de Tailwind (§3). |
| ST-70 | Panneau ouvert dans l'URL (paramètres typés), brouillon dans `sessionStorage` (§3). |

### 14.7 Qualité

| ID | Réponse |
|---|---|
| ST-80 | axe bloquant par écran et par thème, clavier testé en e2e et en composant, lecteur d'écran et zoom par `docs/a11y-checklist.md` (§13). |

## 15. À vérifier au début de l'implémentation

- `pnpm version` crée bien le tag préfixé `v` dans le workspace ([Déploiement](issues/10-deploiement.md)).
- Le kanban sur React Aria tient ST-61 et ST-62 ; sinon, repli shadcn base Base UI ([shadcn/ui face aux bibliothèques headless](issues/12-shadcn-et-bibliotheques.md)).
- ~~Oxlint propose nativement `no-restricted-properties` ; sinon, revue~~ : vérifié le 2026-10-09, il l'a ; `Date.now` et `Math.random` sont interdits par le lint ([Outillage du monorepo](issues/13-outillage-monorepo.md)).
- `hooks.before` force bien `trustDevice: false`, prouvé par un test ([Auth : bibliothèque, sessions et client extension](issues/08-auth.md)).
- Mémoire réelle des conteneurs après une semaine de `docker stats` ([Déploiement](issues/10-deploiement.md)).
- Au chantier extension : en-tête `Origin`, contournement de CORS et cookies dans un vrai Firefox ([Contrat d'API pour l'extension](issues/18-contrat-api-extension.md)).

## 16. Hors périmètre

- Montée en charge au-delà de quelques collègues ; écran d'administration.
- Conception de l'extension Firefox et de l'import de Contacts (seul le contrat d'API, §9, est fixé).
- Contenu de la landing page ; compte de démo.
- **Avant d'ouvrir `SIGNUPS_OPEN`**, un chantier à part : mentions légales de l'app (celles de la landing viennent avant, §4), politique de confidentialité, registre des traitements, suppression de compte, export des données, copie des sauvegardes hors du VPS et son chiffrement (les jetons de session sont en clair dans les dumps).

## 17. ADR de la stack

- [0008 TypeScript de bout en bout](../../docs/adr/0008-typescript-de-bout-en-bout.md)
- [0009 L'isolation repose aussi sur la RLS de Postgres](../../docs/adr/0009-isolation-aussi-par-la-rls.md)
- [0010 Better Auth sert de noyau, les parcours sensibles sont écrits autour](../../docs/adr/0010-better-auth-en-noyau-parcours-ecrits-autour.md)
- [0011 « Annuler » défait le geste côté serveur, sans trace comptée](../../docs/adr/0011-annuler-defait-le-geste-cote-serveur.md)
- [0012 Règles pures partagées, résumé de travail complet dans la SPA](../../docs/adr/0012-regles-pures-partagees-resume-complet-dans-la-spa.md)
- [0013 Livraison explicite par tag, hors Watchtower](../../docs/adr/0013-livraison-explicite-par-tag-hors-watchtower.md)
- [0014 TypeScript 7 et Oxlint, sans typescript-eslint](../../docs/adr/0014-typescript-7-et-oxlint-sans-typescript-eslint.md)
