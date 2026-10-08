# 04: Livraison sur le VPS

**What to build:** poser un tag `v*` sur `main` livre l'API et la SPA sur `app.battlecrm.romainsire.com` : CI rejouée, images poussées, migrations passées, santé attendue, retour automatique au tag précédent en cas d'échec. Les sauvegardes quotidiennes tournent et la restauration est documentée et essayée. La V1 est retirée. Sources : spec stack §10, §12 ; ADR 0013.

**Blocked by:** 02, 03

**Status:** ready-for-human

L'écriture des fichiers (images, compose, scripts, workflows, docs) est à la portée d'un agent ; l'installation sur le VPS, les secrets, le DNS, la bascule V1 et l'essai de restauration demandent Romain. Les notes d'infrastructure de `.private/` ne sont jamais copiées dans un fichier suivi.

- [ ] Images `api` (node:24-alpine, multi-étapes, `pnpm deploy --prod`, points d'entrée `main` et `migrate`) et `web` (nginx non privilégié, en-têtes de la spec stack §10.2 ; l'hôte de la landing répond sans contenu tant que la landing n'existe pas), `linux/amd64`, publiques sur GHCR
- [ ] Compose de prod (`web`, `api`, `postgres`, `migrate`) : exclus de Watchtower, limites mémoire, journaux en rotation, Postgres sur le seul réseau interne, `postgresql.conf` versionné, un `.env.example` par service
- [ ] `deploy.sh <tag>` : tag validé, `migrate` (échec = arrêt), `up -d`, attente de `/api/health`, retour automatique au `deployed_tag` ; dépose `ops/backup.sh`
- [ ] Workflow `release` : refuse un tag hors de `main`, rejoue la CI, pousse `1.2.3` et `sha-<court>`, lance `deploy.sh` en SSH (commande forcée, utilisateur `battlecrm-deploy`), crée la GitHub Release ; retour arrière par `workflow_dispatch`
- [ ] Vérifié : `pnpm version` crée bien le tag préfixé `v` dans le workspace (spec stack §15)
- [ ] `ops/backup.sh` : `pg_dump -Fc` à 3 h, rétention 30 jours, ping d'un moniteur push distinct ; `docs/ops/restore.md` écrit et restauration essayée une fois à la main
- [ ] Harnais e2e : compose e2e contre les images construites, Playwright Firefox et Chromium, un test de fumée sur `/api/health` et la coque, job CI parallèle
- [ ] Sur le VPS (Romain) : V1 supprimée sans dump, ancienne clé retirée, DNS `app.battlecrm.romainsire.com`, secrets écrits en 600, moniteurs uptime-kuma créés, première release livrée
