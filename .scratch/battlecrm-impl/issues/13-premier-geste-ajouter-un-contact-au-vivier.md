# 13: Premier geste : ajouter un Contact au Vivier, avec Annuler

**What to build:** la balle traçante du domaine. L'Utilisateur appuie sur `N`, tape un nom, valide : le Contact est ajouté au Vivier, une notification « Annuler » s'affiche, et `Ctrl Z` ou le bouton le défait côté serveur. Le Contact apparaît dans une liste minimale de l'écran Contacts, qui se lit depuis le résumé de travail persisté sur l'appareil. Toute l'infrastructure des gestes suivants naît ici. Sources : spec UX §1, §6.8 ; spec stack §3, §5.4 ; ADR 0011, 0012 ; ST-62, ST-65.

**Blocked by:** 06

**Status:** resolved

- [x] Module `prospecting` : table des Contacts (seul le nom obligatoire, État Vivier) et des Interactions ; l'ajout est enregistré comme une Interaction ni sortante ni entrante, horodatée par l'horloge de l'app, jour local calculé à l'écriture par `settings.localDateOf`
- [x] Garanties de la base posées pour toutes les tables suivantes : `user_id` + RLS forcée, FK composites `(user_id, id)`, `NOT NULL` par défaut, `CHECK` sur les énumérations, UUID v7 par la base, aucun `DEFAULT now()` pour un horodatage du domaine
- [x] Un endpoint par geste, une transaction, réponse = lignes du résumé changées + `undoToken`
- [x] Table `gesture` et `POST /gestures/:id/undo` : défait le geste dans une transaction, accepté 15 min, refusé si un geste ultérieur a touché le même Contact ; chaque module enregistre l'inverse de ses gestes
- [x] Module `views` : `GET /api/summary` (Contacts avec leur État et leurs dernières dates d'Interaction ; extensible) ; côté SPA, chargé par TanStack Query, persisté dans IndexedDB, mis à jour par les lignes renvoyées ; purgé à la déconnexion
- [x] Toast maison sur React Aria : au moins 10 s, pause au survol et au focus, annoncé dans une région live polie ; `Ctrl Z` hors des champs de saisie (tinykeys)
- [x] Raccourci `N` (jamais dans un champ de saisie) et entrée « + Ajouter » de la navigation ouvrent l'ajout rapide (nom seul pour l'instant)
- [x] Écran Contacts minimal : liste triée par dernière Interaction, état vide « Aucun Contact pour l'instant »
- [x] Modèle de test établi : un test nominal et un test d'« Annuler » (refus compris) par geste ; tests de sécurité générés étendus à la nouvelle table (catalogue RLS, filtre oublié, accès croisé 404 sans effet)

## Comments

**2026-10-13, implémentation (agent).**

- **Tables** (`0011`, accès et RLS forcée en `0012`) : `contact` (nom, `status` sous `CHECK`, `created_at`), `interaction` (`kind`, `direction` `outbound | inbound | none`, `occurred_at`, `local_date`, `recorded_at`), `gesture` (`kind`, `contact_id`, `payload` jsonb, `performed_at`). Chacune porte `(user_id, id)` unique ; les FK entre tables métier sont composites.
- **Trois modules** : `prospecting` (`POST /api/contacts`, 201 `{ changes, undoToken }`), `gestures` (`recordGesture`, `POST /api/gestures/:id/undo`), `views` (`GET /api/summary`, `summaryChanges`). `gestures` est un module à part, absent de la spec stack §5.2 : ligne ajoutée. `createApp` passe à `gestures` l'inverse de chaque module et à `prospecting` la lecture des lignes changées, ce qui évite un import circulaire avec `views`.
- **Forme des réponses** : `changes = { contacts: [...], removedContactIds: [...] }` ; une ligne de Contact porte `id`, `name`, `status`, `lastInteractionAt` (instant, pour le tri) et `lastInteractionOn` (jour local, pour l'affichage). L'`undoToken` est l'id du geste.
- **« Annuler »** : 404 `not_found` (inconnu, déjà annulé, autre Utilisateur), 409 `expired` au-delà de 15 min, 409 `superseded` si un geste ultérieur a touché le même Contact. Le geste annulé est supprimé de `gesture`. Un verrou consultatif par Contact (`pg_advisory_xact_lock`) empêche un geste et une annulation de se croiser.
- **Pas de tâche de purge** : sous RLS forcée, une tâche planifiée ne voit aucune ligne. Chaque geste efface au passage les gestes de son Utilisateur vieux de plus de 15 min.
- **`settings.localDateOf(tx, userId, instant)`** : le `userId` en plus de la signature de la spec, pour le filtre applicatif (spec stack §5.2 amendée).
- **Tests de sécurité générés** (`apps/api/src/security.test.ts`) : catalogue (seules les tables d'auth hors RLS, politique `user_isolation` forcée partout ailleurs, FK composites, aucun défaut tiré de l'horloge de la base), filtre oublié sur chaque table métier, accès croisé sur chaque route à `:id`. Une nouvelle table ou une nouvelle route à `:id` les fait échouer tant qu'elle n'y est pas couverte. Fabrique `addContact(harness, user)`.
- **SPA** : résumé chargé par la coque (`summary.ts`), persisté seul dans IndexedDB (`device-data.ts`, `idb-keyval`, invalidé à chaque version de l'app), mis à jour par `applySummaryChanges`. Purgé à la déconnexion, à la connexion, au clic de vérification et quand la garde de l'app trouve la session terminée.
- **Toast** (`components/ui/toast.tsx`) sur `UNSTABLE_Toast` : 10 s, région `role="status"`. React Aria ne met en pause qu'à l'entrée du pointeur ou du focus dans la région : un toast qui apparaît alors qu'ils y sont déjà est mis en pause à la main. `undo.tsx` porte « Annuler » (bouton et `Ctrl Z`, `$mod+z` de tinykeys) ; un refus s'affiche en toast d'erreur et relit le résumé. Ajout hors ticket : le toast « Annulé. » après une annulation réussie.
- **Raccourcis** (`shortcuts.ts`, `useShortcuts`) : tinykeys 4 ignore de lui-même les champs de saisie. `N` ne s'ouvre pas par-dessus une fenêtre modale.
- **Laissé aux tickets suivants** : sur mobile, rien n'ouvre encore l'ajout rapide (bouton flottant, ticket 40) et il reste une fenêtre centrée, pas une feuille plein écran ; l'état vide n'a pas son bouton « Ajouter un Contact » (ticket 16) ; `gesture.contact_id` est obligatoire, le premier geste sur une Battle seule demandera une migration.
