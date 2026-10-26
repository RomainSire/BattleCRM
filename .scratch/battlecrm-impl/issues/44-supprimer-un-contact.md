# 44: Supprimer un Contact

**What to build:** sous `⋯` de la fiche, « Supprimer le Contact… » ouvre une confirmation irréversible (qui propose d'archiver à la place) ; le Contact est anonymisé : ses champs identifiants et les notes de ses Interactions sont effacés, ses Essais et Interactions restent sous « Contact supprimé », son Essai en cours est annulé et sa Relance planifiée annulée. Sources : spec UX §6.13, §10 ; CONTEXT (Contact) ; ADR 0006 ; spec stack §6 (anonymisation) ; ST-38.

**Blocked by:** 29

**Status:** resolved

- [x] Anonymisation sur place dans une transaction : nom, poste, coordonnées, URL LinkedIn (libérée), note et notes d'Interactions effacés ; marqueur `anonymized_at` ; `CHECK` qu'un Contact anonymisé n'a plus de champ identifiant
- [x] Essai en cours annulé (motif « Contact supprimé »), Relance planifiée annulée, Tirage réservé tombé ; Battles, Activité et Taux de passage inchangés
- [x] Confirmation « Supprimer <Contact> ? Ses coordonnées et ses notes sont effacées définitivement. Ses n Essais restent dans les Battles, sans son nom. » avec Archiver à la place ; pas d'« Annuler »
- [x] Le Contact disparaît de Contacts, du Funnel et de la palette ; la copie locale est rafraîchie par les lignes renvoyées ; seuls les Essais d'une Battle le montrent sous « Contact supprimé »
- [x] Tests : champs effacés en base, Battle inchangée

## Comments

**2026-10-26, implémentation (agent).**
- **API** : `POST /api/contacts/:id/delete` (`prospecting/delete-contact.ts`), une transaction sous le verrou du Contact, sans ligne `gesture` ni jeton : confirmé avant, jamais annulé. Il annule l'Essai en cours (motif « Contact supprimé » dans la langue de l'Utilisateur) et la Relance planifiée, fait tomber le Tirage, efface nom, poste, e-mail, téléphone, URL LinkedIn (libérée), note et Organisation, ainsi que les notes des Interactions et des Relances, les motifs des changements d'État et les motifs de Dérogation. Il pose `anonymized_at` et passe la ligne en Archivé, ce qui la sort de toute lecture par État (Tirages du jour, Étape avec des Contacts en prospection). Les gestes du Contact sont oubliés : leur charge gardait des Coordonnées, et leurs jetons répondent désormais 404. Un Contact supprimé répond 404 à tout geste et à sa fiche.
- **Base** (migration 0046, en expand seulement) : `name` devient nullable, `contact_name_required_check` (un nom tant que le Contact n'est pas supprimé), `contact_anonymized_check` (supprimé : aucun champ identifiant, aucune Organisation).
- **Résumé** : les Contacts supprimés en sont exclus (Contacts, Funnel, palette, page Organisation, Aujourd'hui). Il porte `deletedContactDays`, les jours d'Entrée et d'Action de prospection de tous les Contacts supprimés réunis, sans identifiant : l'Activité du jour et les Entrées de la semaine, comptées sur l'appareil, ne changent pas après coup (`countedContacts`, `apps/web/src/summary.ts`). La réponse de suppression le renvoie, et le replie sur un résumé gardé par une version antérieure. La fiche du Contact est retirée du cache de l'appareil.
- **Battles** : `GET /battles/:id/trials` porte `contactDeleted` ; le panneau affiche « Contact supprimé » et l'issue en texte, sans menu. Toutes les Battles où le Contact a un Essai sont renvoyées, pour rafraîchir leurs Essais.
- **SPA** : « Supprimer le Contact… » en dernier sous `⋯` de la fiche (panneau et page). Fenêtre « Supprimer <Contact> ? » avec le texte de la spec (la phrase sur les Essais omise à 0, au singulier à 1, le nombre lu par la fiche qui porte `trialCount`), « Archiver à la place » qui ouvre la fenêtre Archiver (absent sur un Archivé), Annuler et Supprimer ; notification « Contact supprimé : <nom> » sans « Annuler ». La page revient à Contacts, le panneau se ferme.
- **Tests** : `apps/api/src/prospecting/delete-contact.test.ts` (champs effacés en base, Essai réglé toujours compté, Battle inchangée hors Essai en cours, jours toujours comptés, URL libérée, jetons et gestes refusés), `security.test.ts` (accès croisé), `delete-contact.test.tsx` et `battle-follow.test.tsx` côté web.
- **À vérifier** : les tests de l'API n'ont pas pu tourner dans le bac à sable de l'agent (Postgres injoignable), ni la migration être appliquée à la base de dev.
- **À trancher** :
  - « Battle inchangée » : l'Essai en cours annulé n'est plus compté (ADR 0006 l'exige) ; une Battle ouverte perd donc ce point en cours. Les Essais réglés restent comptés.
  - Les motifs d'annulation écrits par l'Utilisateur sur ses Essais sont gardés (affichés dans la Battle) ; ils peuvent nommer la personne.
  - Un retour à la version précédente de l'API montrerait les Contacts supprimés comme Archivés sans nom (son résumé ne filtre pas `anonymized_at`).

