# 13: Premier geste : ajouter un Contact au Vivier, avec Annuler

**What to build:** la balle traçante du domaine. L'Utilisateur appuie sur `N`, tape un nom, valide : le Contact est ajouté au Vivier, une notification « Annuler » s'affiche, et `Ctrl Z` ou le bouton le défait côté serveur. Le Contact apparaît dans une liste minimale de l'écran Contacts, qui se lit depuis le résumé de travail persisté sur l'appareil. Toute l'infrastructure des gestes suivants naît ici. Sources : spec UX §1, §6.8 ; spec stack §3, §5.4 ; ADR 0011, 0012 ; ST-62, ST-65.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Module `prospecting` : table des Contacts (seul le nom obligatoire, État Vivier) et des Interactions ; l'ajout est enregistré comme une Interaction ni sortante ni entrante, horodatée par l'horloge de l'app, jour local calculé à l'écriture par `settings.localDateOf`
- [ ] Garanties de la base posées pour toutes les tables suivantes : `user_id` + RLS forcée, FK composites `(user_id, id)`, `NOT NULL` par défaut, `CHECK` sur les énumérations, UUID v7 par la base, aucun `DEFAULT now()` pour un horodatage du domaine
- [ ] Un endpoint par geste, une transaction, réponse = lignes du résumé changées + `undoToken`
- [ ] Table `gesture` et `POST /gestures/:id/undo` : défait le geste dans une transaction, accepté 15 min, refusé si un geste ultérieur a touché le même Contact ; chaque module enregistre l'inverse de ses gestes
- [ ] Module `views` : `GET /api/summary` (Contacts avec leur État et leurs dernières dates d'Interaction ; extensible) ; côté SPA, chargé par TanStack Query, persisté dans IndexedDB, mis à jour par les lignes renvoyées ; purgé à la déconnexion
- [ ] Toast maison sur React Aria : au moins 10 s, pause au survol et au focus, annoncé dans une région live polie ; `Ctrl Z` hors des champs de saisie (tinykeys)
- [ ] Raccourci `N` (jamais dans un champ de saisie) et entrée « + Ajouter » de la navigation ouvrent l'ajout rapide (nom seul pour l'instant)
- [ ] Écran Contacts minimal : liste triée par dernière Interaction, état vide « Aucun Contact pour l'instant »
- [ ] Modèle de test établi : un test nominal et un test d'« Annuler » (refus compris) par geste ; tests de sécurité générés étendus à la nouvelle table (catalogue RLS, filtre oublié, accès croisé 404 sans effet)
