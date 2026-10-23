# 35: Réglages : Funnel

**What to build:** dans Réglages, la section Funnel, seul endroit où il s'édite : l'Utilisateur réordonne les Étapes (poignée ou `Alt+↑/↓`), renomme, modifie le But, ajoute une Étape, archive une Étape qui a servi (quand rien ne l'en empêche), supprime une Étape qui n'a jamais servi, et restaure une Étape archivée à sa place d'avant. Sources : spec UX §5.8 (Funnel) ; CONTEXT (Funnel, Étape) ; ADR 0003 ; ST-32, ST-61.

**Blocked by:** 27, 20

**Status:** resolved

- [x] Liste ordonnée avec compteurs (Contacts En prospection, Positionnements, Battle ouverte) ; nom et But modifiables sur place ; « + Ajouter une Étape » et insertion au survol
- [x] Réordonner (GridList + `useDragAndDrop`, clavier) sans confirmation, phrase permanente « Réordonner ne déplace aucun Contact ; l'historique garde l'ordre d'alors. »
- [x] Faits lus en base au moment du geste : Archiver grisé avec la raison et un lien tant que l'Étape a des Contacts En prospection ou une Battle ouverte, sinon confirmation qui récapitule les effets ; Supprimer pour une Étape qui n'a jamais servi, sans confirmation, avec « Annuler »
- [x] Toujours au moins une Étape non archivée ; Restaurer (sous « Étapes archivées (n) ») juste après l'Étape qui la précédait si elle est encore dans le Funnel, sinon en fin
- [x] Le menu d'en-tête du kanban « Renommer » et « Gérer les Étapes… » mène ici
- [x] Gestes testés (nominal + Annuler, refus d'archivage)

## Comments

**2026-10-23, implémentation (agent).**

- **API** (`apps/api/src/funnel/stages.ts`) : six gestes par le circuit commun, chacun annulable (ADR 0011) et qui répond avec tout le Funnel : `POST /stages` (`afterId` absent : en fin ; `null` : en tête), `/stages/:id/edit` (nom ou But, l'un ou l'autre), `/move`, `/archive`, `/restore`, `/delete`. Faits lus dans la transaction (ST-32), injectés par `prospecting` (`stageContacts`) et `battles` (`stageBattles`). Refus : `has_contacts`, `battle_open`, `last_stage` (archiver) ; `served`, `last_stage` (supprimer) ; `unknown_stage`, `archived`, `not_archived`.
  - Verrous : chaque geste verrouille toutes les Étapes de l'Utilisateur par ordre d'id ; `stageOrder` les partage dans le même ordre (une entrée dans le Funnel attend un archivage, et le voit), la création d'un Positionnement partage son Étape.
  - Restaurer : juste après `preceded_by_id` (l'Étape qui la précédait à l'archivage), en fin si elle n'est plus dans le Funnel, en tête si elle était première.
  - « Annuler » d'une suppression de Positionnement refusé une fois son Étape supprimée.
- **Contrat** : `SummaryStage.served` ; `SummaryChanges.stages` (tout le Funnel, ou `null`). Le SPA a un repli pour un résumé gardé sur l'appareil.
- **Migration** `0039_stage_gestures` (expand) : `stage.preceded_by_id`, `gesture.stage_id` et ses CHECK. Appliquée à la base de dev.
- **SPA** (`apps/web/src/settings/funnel-settings.tsx`) : section Funnel en tête de Réglages (bureau). GridList + `useDragAndDrop` (poignée, glisser clavier, ligne d'insertion), `Alt+↑/↓`, nom et But sur place (Entrée ou sortie du champ, Échap revient), compteurs, Archiver grisé avec la raison et un lien (Funnel, Battle) ou confirmation récapitulative, Supprimer sans confirmation, « Étapes archivées (n) » et Restaurer, « + » au survol pour insérer, « Ajouter une Étape » (nommée « Nouvelle Étape », son nom prend le focus). Le menu du kanban mène à `/settings#funnel`, « Renommer » avec `?stage=` qui met le focus sur son nom.
- **Glossaire** : `_EN_` de l'Étape complété (« a Stage that served »).
- **Tests** : API `stages.test.ts` (14 cas : nominal + Annuler par geste, refus d'archivage, dernière Étape, restauration, suppression refusée, historique inchangé après réordonnancement) et `security.test.ts` ; SPA `funnel-settings.test.tsx` (11 cas, axe compris).
- **Revue** (standards et spec) : corrigés le `edit` vide (500), le double envoi Entrée puis sortie du champ, l'ordre des verrous (par id plutôt que par position), le repli « en fin » écrit deux fois, les noms `Facts`.
- **À trancher** :
  - l'archivage a à la fois une confirmation et « Annuler » (§1 réserve la confirmation à ce qu'on n'annule pas simplement) ;
  - l'édition du Funnel n'est pas atteignable en largeur étroite, alors que §3.2 la range sous « Sur ordinateur » dans Plus ;
  - un refus du serveur dit toujours « Le Funnel a changé sur un autre appareil », sans la raison précise ;
  - le compteur de Positionnements ne compte que les non archivés ;
  - « a servi » est calculé à deux endroits côté API (le résumé et le geste).
