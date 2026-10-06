# Carte : BattleCRM — Stack technique

Label: wayfinder:map

## Destination

Une **spec stack** (`.scratch/battlecrm-stack/spec.md`) et des ADR pour les choix difficiles à défaire : langages et frameworks, données, auth, architecture, test, déploiement. Chaque exigence `ST-xx` de la [spec UX](../battlecrm-ux/spec.md) y trouve sa réponse, assez pour découper directement en tickets d'implémentation.

## Notes

- Entrées : [spec UX](../battlecrm-ux/spec.md) §8 « Exigences pour la stack » (identifiants `ST-xx`), `CONTEXT.md` (vocabulaire, à utiliser strictement), `docs/adr/` (font foi, notamment 0003 valeurs en vigueur, 0004 hors-ligne en consultation seulement, 0006 anonymisation).
- Skills à consulter : `grilling` + `domain-modeling` par défaut ; `research` pour les tickets de ce type ; `codebase-design` pour l'architecture.
- **Planification uniquement** : on tranche, on ne construit pas. Des spikes jetables restent permis pour départager deux options, sur une branche à part.
- Critères de choix, dans l'ordre (cadrage du 2026-10-02) :
  1. **Lisible et écrit sans peine par des agents** (typage fort, conventions connues) ;
  2. **Maintenable en solo**, **robuste**, **peu de maintenance** ;
  3. **Léger sur le VPS** ;
  - plus : un **backend rapide**, pour une app très fluide.
  - Ce que Romain maîtrise déjà et l'envie d'apprendre n'entrent pas en jeu.
  - **C# / .NET écarté** (préférence de Romain, 2026-10-02) : le backend se choisit entre TypeScript (Hono, NestJS ou AdonisJS), Rust et Go.
  - **Écrire soi-même n'est pas un défaut en soi** : une dépendance en moins ; à peser contre le risque du code de sécurité écrit à la main.
- Contraintes fixées :
  - **VPS de Romain** : Docker, Traefik (réseau `traefik-public`, Let's Encrypt), Watchtower actif ; d'autres apps cloisonnées y tournent, **pas de base partagée**.
  - **GitHub + Actions + GHCR**, **monorepo**.
  - **Multi-utilisateur** avec isolation stricte, mais à petite échelle : Romain seul, puis quelques collègues. **Inscriptions ouvertes ou fermées par variable d'environnement**, sans écran d'administration.
  - **Rien de payant** : e-mails par le SMTP Gmail de Romain (mot de passe d'application) ; sauvegardes hebdomadaires de l'hébergeur pour l'instant.
  - **Extension Firefox LinkedIn imminente** : la stack ne lui ferme pas la porte (API et auth utilisables par un client extension), sans la concevoir ici.
- **Modèle en cours d'amendement** (2026-10-06) : la carte [Cercle d'alliés](../battlecrm-cercle/map.md) a refondu les États du Contact (Vivier, En prospection, Allié, Archivé ; ADR 0007), reportés dans la spec UX (§5.11, §6.11, §6.14, ST-39, ST-48, ST-49, ST-57, ST-58).
- La V1 (`../BattleCRM` : AdonisJS + React + Postgres, Docker/Traefik) n'est pas un acquis : on repart de zéro, l'infra exceptée.

## Decisions so far

<!-- une ligne par ticket résolu -->

- [shadcn/ui face aux bibliothèques headless](issues/12-shadcn-et-bibliotheques.md) : recherche, shadcn/ui accepte React Aria comme base officielle ; recommandé : shadcn en base `aria`, éjecté et possédé, toast maison sur React Aria (Sonner ne tient pas ST-62), panneau non modal et kanban à écrire, jetons de la spec sans rouge. Repli : shadcn base Base UI.
- [Rust, Go et TypeScript au banc d'essai](issues/11-rust-go-typescript.md) : recherche, 1er TypeScript + Node + Hono (moins de code d'auth, types partagés ; veille de sécurité lourde), 2e Go (le plus calme, tout à écrire), 3e Rust (meilleur compilateur, mais écosystème web en 0.x et en retard). « Compilateur strict = moins de bugs d'agents » non démontré ; un spike d'auth dans les trois langages serait la seule mesure directe.
- [Candidats backend](issues/01-candidats-backend.md) : recherche, 1er TypeScript sur Node LTS + Hono (un seul langage, RPC typé, Better Auth), 2e C# / .NET 10 + Identity, 3e Go. La rapidité tient aux allers-retours et à la copie locale, pas au langage ; la mémoire ne départage presque rien sur le VPS.
- [Auth : ce que couvrent les bibliothèques](issues/04-auth.md) : recherche, aucune bibliothèque ne couvre ST-10 à ST-23 (ST-17, ST-19, ST-21 toujours à écrire). Better Auth (TS, le moins de code mais une veille de sécurité lourde) et ASP.NET Core Identity (le plus stable, plus d'assemblage) ex æquo, puis Phoenix, puis Go. Sessions opaques en base ; l'extension s'authentifie par un jeton de session dédié, révocable.
- [Candidats front](issues/02-candidats-front.md) : recherche, SPA Vite + API séparée ; finalistes React + React Aria Components (puis Base UI, à départager par un spike kanban) avec TanStack Router/Query, Paraglide, vite-plugin-pwa, tinykeys ; Vue + Reka UI en troisième. Hors ligne : une seule copie dans IndexedDB, mutations jamais rejouées. Panneau ouvert dans l'URL (ST-70).
- [Base de données : SQLite ou Postgres](issues/03-base-de-donnees.md) : recherche, PostgreSQL 18 recommandé (majeure épinglée), SQLite défendable sous réglages stricts ; jour local stocké à l'écriture, normalisation dans le code sous index unique, index partiels pour les « au plus un », RLS en garde-fou, `pg_dump` quotidien et rétention bornée pour ST-38.
- [Forme de l'app et langages](issues/06-forme-app-langages.md) : monorepo TypeScript sous pnpm (ADR 0008) ; SPA React (TanStack Router + Query, Paraglide, vite-plugin-pwa, tinykeys, shadcn base `aria` éjecté, Tailwind 4), API Hono + Zod sur Node LTS avec Better Auth, landing page Astro statique (vitrine seule) ; adresses souhaitées `battlecrm.romainsire.com` et `app.battlecrm.romainsire.com/api`.
- [Relevé du VPS](issues/05-releve-vps.md) : tâche. Pas de swap et d'autres apps sur la machine (`mem_limit` par conteneur) ; Traefik v3 en `latest`, sans middleware global ; Watchtower met à jour tout conteneur non exclu par label ; accès SSH d'Actions à refaire ; aucun dump de base, seulement l'instantané hebdomadaire de l'hébergeur. Relevé détaillé hors du dépôt. La V1 sera supprimée et la V2 reprend son domaine.
- [Base de données et accès aux données](issues/07-donnees.md) : PostgreSQL 18 ; Drizzle 0.45 épinglé sur `pg`, style SQL seul (repli Kysely) ; migrations SQL générées et relues, lancées par un point d'entrée séparé sous le rôle propriétaire ; isolation par filtre applicatif + RLS forcée via `withUser` (ADR 0009) ; FK composites `(user_id, id)`, index uniques partiels, UUID v7, jours locaux en `date` ; anonymisation sur place ; Better Auth sur l'adaptateur Drizzle, hors RLS ; contrat Zod écrit à la main.

## Pas encore spécifié

- **Stratégie de test** : niveaux, outils, tests du domaine (Règle de victoire, Tirage, valeurs en vigueur), contrôle automatique d'accessibilité (ST-80) ; dépend de l'architecture.
- **E-mails transactionnels traduits** (ST-11, ST-12) : gabarits, envoi, file d'attente ou non, par le SMTP Gmail.
- **Observabilité** : journaux, erreurs, santé de l'app sur le VPS, sans service payant.
- **Sauvegardes et RGPD avant d'ouvrir les inscriptions** : sauvegardes plus sûres que l'instantané hebdomadaire de l'hébergeur, rétention compatible avec l'anonymisation (ST-38), suppression de compte (spec UX §14).
- **Contrat d'API pour l'extension** : ce que la stack doit garantir pour qu'elle se branche (authentification, versionnement), sans concevoir l'extension.

## Hors périmètre

- Montée en charge au-delà de quelques collègues.
- Écran d'administration (inscriptions pilotées par variable d'environnement).
- Conception de l'extension Firefox LinkedIn et de l'import de Contacts.
- Contenu de la landing page (sections, textes, captures, vidéo) : de l'UX, pour une session de grilling dédiée ; la carte n'en fixe que la stack. Compte de démo écarté pour l'instant (vitrine seule).
- L'implémentation elle-même, squelette compris : premier ticket après cette carte.
