# 43: Hors ligne et nouvelle version

**What to build:** l'app s'installe sur l'écran d'accueil du téléphone ; hors connexion, Aujourd'hui et les fiches Contact restent lisibles et « Copier le message » marche, mais les actions sont désactivées avec un message qui le dit. Quand une nouvelle version est livrée, l'app propose « Nouvelle version disponible, recharger ». Sources : spec stack §3 ; ADR 0004 ; ST-01, ST-03, ST-04.

**Blocked by:** 37, 16

**Status:** resolved

- [x] vite-plugin-pwa : manifeste, service worker qui précache la coque et ne cache aucune réponse d'API
- [x] Hors ligne : lecture depuis le résumé persisté ; actions désactivées avec un message ; aucune mutation persistée ni rejouée
- [x] Copie locale purgée à la déconnexion et sur un 401 de session révoquée (vérifié de bout en bout)
- [x] `X-App-Version` différent → `registration.update()`, puis proposition de recharger (`updateSW(true)`), jamais forcée

## Comments

**2026-10-25, implémentation (agent).**
- **PWA** (`apps/web/vite.config.ts`) : vite-plugin-pwa 2.0, `registerType: 'prompt'`, manifeste (`start_url` `/today`, `standalone`, icônes 192/512 et masquable tirées du logo, `apple-touch-icon`). Le service worker précache la coque seule (`runtimeCaching: []`, repli de navigation sauf `/api/`) ; plafond de précache relevé à 4 Mio (le bundle fait 1,5 Mo : au-delà de 2 Mio, Workbox l'aurait écarté sans bruit). Vérifié dans Chromium sur `vite preview` : la coque s'ouvre hors ligne, `/api` échoue, aucun cache ne garde de réponse d'API.
- **En ligne ou non** (`src/online.ts`) : l'`onlineManager` de TanStack Query, posé depuis `navigator.onLine` au démarrage, est la seule source. Session et config sont demandées même hors ligne (`networkMode: 'always'`) : sans cela, l'app restait blanche.
- **Actions désactivées** : un bouton `type="submit"` l'est de lui-même (`Button`), un bouton qui enregistre sans formulaire porte `saves` ; Entrée au clavier passe par `submitIfOnline`. Couverts aussi : Reporter / Annuler la Relance, « Annuler » (bouton et Ctrl Z), Réglages (champs, sélecteurs, Étapes, glisser), pièces jointes, Positionnements, palette (langue et déconnexion retirées hors ligne). Les panneaux s'ouvrent toujours (on y lit et copie) ; leur pied dit « Hors ligne : consultation seulement. Les actions reviennent avec la connexion. », comme le bandeau en tête de l'app et des écrans d'authentification (gris, jamais rouge). Le fil d'une fiche, lu à la demande, dit « Le fil se charge avec la connexion. ».
- **« Copier le message » de « Relancer… » hors ligne** (tranché avec Romain le 2026-10-25) : le résumé porte `lastPositioningUse` (dernier Positionnement utilisé et jour d'envoi) sur chaque Contact ; ajout compatible (champ en plus), repli sur le fil pour un résumé gardé par une version antérieure.
- **Nouvelle version** (`src/app-update.tsx`) : chaque réponse d'API passe son `X-App-Version` ; un écart lance `registration.update()` une fois par version ; quand le nouveau service worker attend, « Nouvelle version disponible. [Recharger] » (`updateSW(true)` au clic seulement).
- **Purge** : déjà en place (déconnexion, 401 de session révoquée), désormais vérifiée jusqu'à IndexedDB.
- **Tests** : `offline.test.tsx` (app rouverte hors ligne depuis ce qu'elle a gardé : Aujourd'hui, fiche, copie du message, geste refusé et rien d'envoyé, retour en ligne), `device-data.test.tsx`, `app-update.test.tsx`, `views` (`use-positioning.test.ts`). Banc de test : chaque fichier a sa base IndexedDB et l'app du test précédent est démontée avant l'effacement (un résumé d'un autre test pouvait être restauré : échec intermittent d'`today-screen.test.tsx`).
- **À trancher** :
  - **Se déconnecter hors ligne** est désactivé (il faut le serveur pour fermer la session) : la copie locale ne peut donc pas être effacée hors ligne. On pourrait effacer d'abord la copie et fermer la session au retour.
  - **Appareil sans session, hors ligne** : le routeur ne peut pas savoir s'il y a une session ; l'app s'ouvre sur une coque vide (rien n'est gardé) plutôt que sur la connexion. Comportement antérieur, inchangé.
  - Le manifeste porte `lang: 'fr'` alors que l'app est bilingue.

