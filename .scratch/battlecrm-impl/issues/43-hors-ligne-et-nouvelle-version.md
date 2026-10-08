# 43: Hors ligne et nouvelle version

**What to build:** l'app s'installe sur l'écran d'accueil du téléphone ; hors connexion, Aujourd'hui et les fiches Contact restent lisibles et « Copier le message » marche, mais les actions sont désactivées avec un message qui le dit. Quand une nouvelle version est livrée, l'app propose « Nouvelle version disponible, recharger ». Sources : spec stack §3 ; ADR 0004 ; ST-01, ST-03, ST-04.

**Blocked by:** 37, 16

**Status:** ready-for-agent

- [ ] vite-plugin-pwa : manifeste, service worker qui précache la coque et ne cache aucune réponse d'API
- [ ] Hors ligne : lecture depuis le résumé persisté ; actions désactivées avec un message ; aucune mutation persistée ni rejouée
- [ ] Copie locale purgée à la déconnexion et sur un 401 de session révoquée (vérifié de bout en bout)
- [ ] `X-App-Version` différent → `registration.update()`, puis proposition de recharger (`updateSW(true)`), jamais forcée
