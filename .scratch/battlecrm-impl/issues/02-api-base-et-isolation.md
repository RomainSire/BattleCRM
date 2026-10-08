# 02: API, base et isolation

**What to build:** une API Hono qui démarre contre un Postgres 18 local, migrée par son point d'entrée `migrate` sous le rôle propriétaire, et qui répond `GET /api/health`. Toute requête métier future passe par `withUser`, et la RLS est prouvée par un test. C'est aussi le harnais de test de toutes les tranches suivantes. Sources : spec stack §5, §6, §11, §13 ; ADR 0009, 0011.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Hono sous `/api`, Node 24 LTS ; config validée par Zod au démarrage (refus de démarrer si elle manque) ; `node --watch` en dev, bundle tsdown en prod (`main` et `migrate`)
- [ ] Racine de composition `createApp({ clock, random, email, hibp, config, alert })` : horloge pilotable et hasard scriptable en test
- [ ] Postgres 18 via un compose de dev ; script d'init qui crée le rôle propriétaire (`NOSUPERUSER`) et le rôle applicatif ; `migrate` applique les migrations Drizzle sous le propriétaire
- [ ] Module `db` : `withUser(userId, fn)` (transaction + `set_config('app.user_id', …, true)`) et `withoutIsolation` réservé à `auth` et `migrate` (lint) ; aucun `schema` passé à `drizzle()`
- [ ] Une table de démonstration (ou la première table métier réelle) prouve la RLS forcée : une requête sans filtre sous `withUser` ne voit que les lignes de son Utilisateur
- [ ] Harnais de test : une base par exécution migrée par le vrai `migrate`, connexion sous le rôle applicatif, test de garde qui refuse superutilisateur et `BYPASSRLS` ; `services: postgres` en CI ; dérive Drizzle bloquante et migrations rejouées depuis zéro
- [ ] `GET /api/health` public : `SELECT 1` et dernière migration de cette version appliquée ; 200 `{ status, version }` ou 503
- [ ] pino en JSON, une ligne par requête (méthode, route modèle, statut, durée, `userId`, `requestId`), `X-Request-Id` renvoyé ; `redact` avec un test qui prouve que mots de passe, jetons, cookies, `Authorization` et corps ne sortent jamais
- [ ] `X-App-Version` sur chaque réponse ; `secureHeaders` ; contrôle d'origine (`csrf()`) sur une liste d'origines unique dans la config ; `X-Forwarded-For` accepté seulement depuis le réseau Traefik
