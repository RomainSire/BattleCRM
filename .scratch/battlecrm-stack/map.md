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
- Contraintes fixées :
  - **VPS de Romain** : Docker, Traefik (réseau `traefik-public`, Let's Encrypt), Watchtower actif ; d'autres apps cloisonnées y tournent, **pas de base partagée**.
  - **GitHub + Actions + GHCR**, **monorepo**.
  - **Multi-utilisateur** avec isolation stricte, mais à petite échelle : Romain seul, puis quelques collègues. **Inscriptions ouvertes ou fermées par variable d'environnement**, sans écran d'administration.
  - **Rien de payant** : e-mails par le SMTP Gmail de Romain (mot de passe d'application) ; sauvegardes hebdomadaires de l'hébergeur pour l'instant.
  - **Extension Firefox LinkedIn imminente** : la stack ne lui ferme pas la porte (API et auth utilisables par un client extension), sans la concevoir ici.
- La V1 (`../BattleCRM` : AdonisJS + React + Postgres, Docker/Traefik) n'est pas un acquis : on repart de zéro, l'infra exceptée.

## Decisions so far

<!-- une ligne par ticket résolu -->

- [Auth : ce que couvrent les bibliothèques](issues/04-auth.md) : recherche, aucune bibliothèque ne couvre ST-10 à ST-23 (ST-17, ST-19, ST-21 toujours à écrire). Better Auth (TS, le moins de code mais une veille de sécurité lourde) et ASP.NET Core Identity (le plus stable, plus d'assemblage) ex æquo, puis Phoenix, puis Go. Sessions opaques en base ; l'extension s'authentifie par un jeton de session dédié, révocable.
- [Candidats front](issues/02-candidats-front.md) : recherche, SPA Vite + API séparée ; finalistes React + React Aria Components (puis Base UI, à départager par un spike kanban) avec TanStack Router/Query, Paraglide, vite-plugin-pwa, tinykeys ; Vue + Reka UI en troisième. Hors ligne : une seule copie dans IndexedDB, mutations jamais rejouées. Panneau ouvert dans l'URL (ST-70).
- [Base de données : SQLite ou Postgres](issues/03-base-de-donnees.md) : recherche, PostgreSQL 18 recommandé (majeure épinglée), SQLite défendable sous réglages stricts ; jour local stocké à l'écriture, normalisation dans le code sous index unique, index partiels pour les « au plus un », RLS en garde-fou, `pg_dump` quotidien et rétention bornée pour ST-38.

## Pas encore spécifié

- **Stratégie de test** : niveaux, outils, tests du domaine (Règle de victoire, Tirage, valeurs en vigueur), contrôle automatique d'accessibilité (ST-80) ; dépend de l'architecture.
- **Outillage du monorepo** : gestionnaire de paquets, lint, format, typage partagé entre front, back et extension ; dépend des langages.
- **E-mails transactionnels traduits** (ST-11, ST-12) : gabarits, envoi, file d'attente ou non, par le SMTP Gmail.
- **Observabilité** : journaux, erreurs, santé de l'app sur le VPS, sans service payant.
- **Sauvegardes et RGPD avant d'ouvrir les inscriptions** : sauvegardes plus sûres que l'instantané hebdomadaire de l'hébergeur, rétention compatible avec l'anonymisation (ST-38), suppression de compte (spec UX §14).
- **Contrat d'API pour l'extension** : ce que la stack doit garantir pour qu'elle se branche (authentification, versionnement), sans concevoir l'extension.

## Hors périmètre

- Montée en charge au-delà de quelques collègues.
- Écran d'administration (inscriptions pilotées par variable d'environnement).
- Conception de l'extension Firefox LinkedIn et de l'import de Contacts.
- L'implémentation elle-même, squelette compris : premier ticket après cette carte.
