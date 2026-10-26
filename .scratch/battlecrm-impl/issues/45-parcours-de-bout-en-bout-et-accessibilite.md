# 45: Parcours de bout en bout et contrôle d'accessibilité

**What to build:** les parcours principaux tournent en Playwright contre les images construites, dans Firefox et Chromium, et la conformité WCAG 2.2 AA est vérifiée écran par écran, y compris ce qu'un outil automatique ne voit pas. Sources : spec stack §13 ; spec UX §7 ; ST-80.

**Blocked by:** 04, 11, 41, 43

**Status:** ready-for-human

- [x] Parcours e2e : 2FA ; Contact → Battle → Interaction → Annuler ; kanban à la souris et au clavier ; hors ligne ; changement de `X-App-Version` ; Aujourd'hui
- [x] axe bloquant sur chaque écran, dans les deux thèmes (complète ce que chaque ticket a posé)
- [ ] `docs/a11y-checklist.md` : lecteur d'écran, zoom 400 % (reflow, kanban et tableaux qui défilent), focus jamais masqué, cibles ; passée une fois sur chaque écran, écarts corrigés ou consignés dans la spec UX §1 avec leur motif

## Comments

**2026-10-26, implémentation (agent).**
- **Parcours** (`e2e/tests/`, Chromium et Firefox, contre `compose.e2e.yml`) : `two-factor.spec.ts` (activée dans les Réglages, code TOTP calculé par `support/totp.ts`, puis demandée à la connexion) ; `trial.spec.ts` (Battle ouverte à Approche, Contact ajouté par `N` et `Ctrl Entrée`, Positionnement tiré au sort envoyé, Essai commencé, puis « Annuler ») ; `kanban.spec.ts` (carte glissée à la souris ; puis au clavier seul : lien d'évitement, Tab, flèches, « Déplacer », fenêtre validée par `Ctrl Entrée`, `Ctrl Z`) ; `offline.spec.ts` (service worker installé, rechargement hors ligne, Aujourd'hui et fiche lus depuis l'appareil, actions désactivées) ; `app-update.spec.ts` (nouvelle version proposée, jamais imposée, « Recharger » charge la nouvelle build, y compris à la toute première visite) ; `today.spec.ts` (Entrées : un Contact du Vivier entre, un autre le remplace ; Relance en retard reportée de 3 j, puis « Annuler »).
- **Utilisateurs** : un par test, par la vraie inscription (`POST /api/signup`), dont le jeton du lien est remplacé en base par un jeton connu avant `POST /api/signup/verify` (`support/fixtures.ts`). Écart avec le ticket 15 de la stack (« Utilisateur de départ semé en base par un `globalSetup` ») : les tests tournent en parallèle sans se partager de données, comme ceux de l'API, et le compte a tout ce qu'une vraie inscription crée (Étapes types, Réglages). D'où le Postgres exposé sur `127.0.0.1:5433`. `smtp.gmail.com` pointe sur le conteneur lui-même : aucun e-mail ne sort. Le reste des données de départ passe par les endpoints (`seed`).
- **Nouvelle version** : un second conteneur `web-next` (la même image construite avec `VERSION=e2e-next`) que Traefik sert aux requêtes portant le cookie `e2e-release=next`. Le service worker y trouve un vrai nouveau `sw.js` : Playwright n'intercepte pas la vérification de mise à jour d'un service worker. `X-App-Version` est réécrit par le test. La route enlève `If-None-Match` et `If-Modified-Since` : deux builds du même instant ont le même ETag nginx.
- **Bug corrigé** (`apps/web/src/main.tsx`) : à la toute première visite, la page n'est pas encore sous le service worker. Le nouveau s'active donc tout de suite, et « Recharger » ne faisait rien. Il recharge maintenant la page.
- **axe** (`accessibility.spec.ts`) : chaque écran, avec ou sans session, sur bureau et en largeur de téléphone, dans les deux thèmes et les deux navigateurs. Aucune violation.
- **Liste** : `docs/a11y-checklist.md`, passée sur chaque écran : zoom à 400 %, focus jamais masqué et cibles sans écart. Les cases du graphe d'Activité relèvent de l'exception « contrôle équivalent » (« Voir en tableau »). Rien à consigner dans la spec UX §1.
- **Reste, d'où `ready-for-human`** : l'écoute au lecteur d'écran (Orca ou NVDA), écran par écran. La 3ᵉ case reste décochée jusque-là.
- **Limites de Playwright sous Firefox** : une page chargée hors ligne n'entend pas `online` (le retour en ligne reste aux tests de composant), et le thème système émulé se perd à la navigation (réappliqué après chaque `goto`). En local, `forgetRateLimits` vide les compteurs par adresse avant le parcours 2FA : tous les tests viennent de l'adresse de Traefik.
- **Hors ticket, constaté** : 3 tests de l'API échouent sur `main` (`add-contact.test.ts`, `delete-contact.test.ts`). Ils viennent du ticket 44, dont les tests n'avaient pas tourné.

