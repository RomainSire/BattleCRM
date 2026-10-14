# 18: Page Organisation

**What to build:** une page légère par Organisation, avec ses Contacts ; l'Utilisateur la renomme, change son type (avec la fenêtre de conséquences sur la Cible), la fusionne avec une autre et la supprime quand elle n'a plus de Contact. Lecture seule sur mobile. Sources : spec UX §5.4 ; CONTEXT (Organisation, Cible) ; ST-30, ST-31.

**Blocked by:** 16

**Status:** resolved

- [x] Page : nom, type, Contacts (Étape, État, prochaine action quand elle existe) ; accès par clic sur le nom ; fil d'Ariane « Contacts › … »
- [x] Renommer (unicité normalisée) ; changer le type avec confirmation « 4 Contacts passent en Cible ESN. Les Essais déjà commencés gardent leur Cible. » (absente sans Contact)
- [x] Fusionner avec… : l'Organisation qui reste, rattachement des Contacts, une transaction, même fenêtre
- [x] Supprimer seulement sans Contact ; jamais de suppression automatique
- [x] Gestes avec confirmation (spec UX §1) testés ; mobile en lecture seule

## Comments

**2026-10-14, implémentation (agent).**

- **API** : quatre gestes dans `organizations`, une transaction chacun, qui renvoient les lignes du résumé changées : `POST /api/organizations/:id/rename` (409 `organization_taken`, tranché par l'index unique normalisé), `/change-type`, `/merge` (`{ intoId }` : l'Organisation qui reste ; ses Contacts y passent, l'autre est supprimée ; 400 `unknown_organization` pour elle-même ou une inconnue), `/delete` (409 `has_contacts`). 404 `not_found` pour une Organisation d'un autre Utilisateur ou inconnue (ajoutées au test d'accès croisé). Les Contacts s'écrivent dans `prospecting`, qui fournit `organizationMembers` (`any`, `move`) par la racine de composition : `prospecting` important déjà `organizations`, l'inverse aurait fait un cycle. `violates` passe dans `db` pour servir aux deux modules. Aucune migration.
- **Ni « Annuler » ni ligne `gesture`** : la table `gesture` porte un Contact, et la spec UX §1 range le changement de type parmi les confirmations. Renommer s'enregistre sans confirmation (on renomme de nouveau) ; changer le type avec Contacts, fusionner et supprimer passent par une fenêtre de confirmation. Spec stack §5.2 et §5.4 mises à jour.
- **SPA** : route `/organizations/$organizationId`, qui allume Contacts, avec le fil d'Ariane « Contacts › … » ; on y arrive par le nom de l'Organisation dans l'en-tête et les Coordonnées d'une fiche. Contacts triés par nom, avec Étape, État et « Sans prochaine action » pour un Contact En prospection. Renommer sur place (`Entrée`, `Échap` ; un nom déjà pris est refusé sur l'appareil, avant tout envoi) ; « Passer en ESN… » ouvre la fenêtre de conséquences, ou change tout de suite sans Contact ; « Fusionner avec… » choisit l'autre Organisation puis celle qui reste (celle choisie par défaut) et dit ce qui change ; « Supprimer… » n'apparaît que sans Contact. Sur mobile, aucune action. Une page fusionnée mène à celle qui reste.
- **Laissé aux tickets suivants** : l'accès par la palette (ticket 41) ; la prochaine action réelle (Relance, Essai) des tickets 21 et 28.
