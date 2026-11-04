<p align="center">
  <img src="BattleCRM_logo.svg" alt="BattleCRM" width="120">
</p>

# BattleCRM

Un CRM pour les prestataires de services (développeurs freelance) qui prospectent des clients finaux et des ESN, et qui **A/B testent leurs façons de se présenter** pour trouver, avec peu de contacts, celle qui marche le mieux.

L'app est en ligne sur [app.battlecrm.romainsire.com](https://app.battlecrm.romainsire.com). Les inscriptions y sont fermées.

## L'idée

Un freelance prospecte peu de monde : quelques dizaines de contacts par mois. C'est trop peu pour un A/B test classique, assez pour une règle bayésienne. BattleCRM suit chaque Contact dans un **Funnel** d'Étapes que l'on configure (Approche, Qualif ESN, Qualif Client, Closing…), et à chaque Étape il fait s'affronter deux façons de se présenter :

- un **Positionnement** est une façon de se présenter et de relancer à une Étape donnée (« CV A », « mail d'accroche B ») : un canal, une description, des pièces jointes et une Cadence de relance ;
- une **Battle** oppose le **Champion** de l'Étape à un **Challenger**. Chaque Contact exposé à l'un des deux est un **Essai**, qui finit en succès, sans suite ou annulé ;
- la **Règle de victoire** déclare une Battle concluante quand un Positionnement a au moins 85 % de chances d'être meilleur que l'autre (après 10 Essais terminés chacun et 5 succès au total). C'est toujours l'Utilisateur qui clôt la Battle ; le vainqueur devient le Champion, le perdant est archivé.

Autour, le quotidien de la prospection :

- **Aujourd'hui** : les Contacts à traiter (Relance du jour ou en retard, Essai au délai dépassé) ;
- **Relances** planifiées une à une selon la Cadence du Positionnement, sans rien d'automatique ;
- **États** d'un Contact : au Vivier, En prospection, Allié ou Archivé. Le **Cercle d'alliés** regroupe les personnes avec qui l'on entretient la relation dans la durée, avec un Rythme de prise de nouvelles ;
- **Indicateurs** : Taux de passage du Funnel, Activité, Objectifs d'activité et d'entrées ;
- une **extension Firefox** qui, sur un profil LinkedIn, dit si la personne est déjà un Contact et permet de l'ajouter à la volée.

Le vocabulaire complet, avec les termes anglais utilisés dans le code, est dans [`CONTEXT.md`](CONTEXT.md).

## Architecture

```
app.battlecrm.romainsire.com
   ├─ /api/*  ──► api (Node, Hono) ──► Postgres 18
   └─ le reste ─► web (nginx) ── SPA React (PWA)
extension Firefox ──► /api/* en jeton bearer
```

TypeScript de bout en bout, en monorepo pnpm :

| Workspace           | Rôle                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web`          | SPA React 19 : TanStack Router et Query, Tailwind 4, composants shadcn (base React Aria) éjectés, PWA |
| `apps/api`          | API Hono, Drizzle sur Postgres, Better Auth, migrations                                               |
| `apps/extension`    | extension Firefox (WXT), distribuée en `.xpi` signé AMO non listé                                     |
| `e2e`               | tests de bout en bout Playwright, contre les images Docker                                            |
| `packages/domain`   | règles métier pures, sans E/S, partagées par l'API et la SPA                                          |
| `packages/contract` | schémas Zod et types de l'API                                                                         |
| `packages/i18n`     | messages Paraglide (français et anglais US)                                                           |
| `packages/theme`    | jetons Tailwind partagés                                                                              |
| `packages/ui`       | primitives d'interface partagées par la SPA et l'extension                                            |

Quelques choix structurants : l'isolation entre Utilisateurs passe aussi par la RLS de Postgres, « Annuler » défait le geste côté serveur, le hors-ligne est en consultation seulement. Chacun est expliqué dans un [ADR](docs/adr/).

## Développer

Prérequis : Node 24 (voir `.node-version`), pnpm (version épinglée dans `package.json`) et Docker avec Compose.

```sh
pnpm install
pnpm exec playwright install chromium firefox   # une fois par machine, pour les tests web et extension
pnpm dev
```

`pnpm dev` démarre le Postgres de développement (`compose.dev.yml`), puis l'API sur `http://localhost:3000` et la SPA sur `http://localhost:5173`, qui relaie `/api` vers l'API.

Avant le premier lancement, et après chaque nouvelle migration :

```sh
pnpm --filter @battlecrm/api db:migrate
```

La configuration de développement est dans `apps/api/.env.development`. Les e-mails (vérification de compte, mot de passe oublié) partent par un vrai compte Gmail : mettre `SMTP_USER` et `SMTP_PASSWORD` (un mot de passe d'application) dans `apps/api/.env.development.local`, ignoré par git.

Pour l'extension :

```sh
pnpm --filter @battlecrm/extension dev     # Firefox avec l'extension chargée
pnpm --filter @battlecrm/extension build
```

### Commandes

| Commande                                   | Effet                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `pnpm check`                               | format, lint, types et tests : à lancer avant de rendre la main (le hook `pre-push` la lance aussi) |
| `pnpm test`                                | tests Vitest (API contre le Postgres de dev ; web et extension dans Chromium et Firefox)            |
| `pnpm format`                              | Prettier                                                                                            |
| `pnpm --filter @battlecrm/api db:generate` | génère une migration depuis les tables Drizzle                                                      |
| `pnpm --filter @battlecrm/api db:drift`    | vérifie qu'aucune table n'est sans sa migration                                                     |
| `pnpm e2e:up`, `pnpm e2e`, `pnpm e2e:down` | construit les images, lance les tests de bout en bout, arrête tout                                  |

Les tests de l'API créent et migrent leur propre base : ils ont seulement besoin que le Postgres de dev tourne (`docker compose -f compose.dev.yml up -d`).

### Règles du dépôt

- Tout le code est en anglais (fichiers, identifiants, tables, endpoints, commentaires). Les termes du domaine prennent la ligne `_EN_` de [`CONTEXT.md`](CONTEXT.md) ; une notion sans terme au glossaire y est ajoutée d'abord.
- Une migration livrée ne se modifie plus, et chaque changement de migration ou d'endpoint reste compatible avec la version précédente (expand/contract). Le détail est dans [`CODING_STANDARDS.md`](CODING_STANDARDS.md).
- `drizzle-kit push` seulement sur une base jetable.

## Documentation

| Où                                                                             | Quoi                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [`CONTEXT.md`](CONTEXT.md)                                                     | le glossaire du domaine, qui fait foi                        |
| [`docs/adr/`](docs/adr/)                                                       | les décisions difficiles à défaire                           |
| [`.scratch/battlecrm-ux/spec.md`](.scratch/battlecrm-ux/spec.md)               | la spec UX : écrans, gestes, accessibilité                   |
| [`.scratch/battlecrm-stack/spec.md`](.scratch/battlecrm-stack/spec.md)         | la spec technique : stack, données, auth, déploiement, tests |
| [`.scratch/battlecrm-extension/spec.md`](.scratch/battlecrm-extension/spec.md) | la spec de l'extension Firefox                               |
| [`docs/ops/install.md`](docs/ops/install.md)                                   | installer sur le VPS et livrer une version                   |
| [`docs/ops/restore.md`](docs/ops/restore.md)                                   | restaurer une sauvegarde                                     |
| [`docs/a11y-checklist.md`](docs/a11y-checklist.md)                             | la liste de vérification d'accessibilité                     |

Les tickets et les specs vivent en markdown sous `.scratch/<feature>/` (voir [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)).

## Livrer

Sur `main` à jour :

```sh
pnpm version minor   # ou patch, major
git push --follow-tags
```

Le tag `v*` déclenche le workflow `release` : il rejoue la CI, fait signer l'extension par AMO, pousse les images sur GHCR, déploie sur le VPS (migrations, redémarrage, retour arrière automatique en cas d'échec) et crée la GitHub Release avec le `.xpi`. Le détail est dans [`docs/ops/install.md`](docs/ops/install.md#livrer-une-version).
