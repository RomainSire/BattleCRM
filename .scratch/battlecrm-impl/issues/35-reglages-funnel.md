# 35: Réglages : Funnel

**What to build:** dans Réglages, la section Funnel, seul endroit où il s'édite : l'Utilisateur réordonne les Étapes (poignée ou `Alt+↑/↓`), renomme, modifie le But, ajoute une Étape, archive une Étape qui a servi (quand rien ne l'en empêche), supprime une Étape qui n'a jamais servi, et restaure une Étape archivée à sa place d'avant. Sources : spec UX §5.8 (Funnel) ; CONTEXT (Funnel, Étape) ; ADR 0003 ; ST-32, ST-61.

**Blocked by:** 27, 20

**Status:** ready-for-agent

- [ ] Liste ordonnée avec compteurs (Contacts En prospection, Positionnements, Battle ouverte) ; nom et But modifiables sur place ; « + Ajouter une Étape » et insertion au survol
- [ ] Réordonner (GridList + `useDragAndDrop`, clavier) sans confirmation, phrase permanente « Réordonner ne déplace aucun Contact ; l'historique garde l'ordre d'alors. »
- [ ] Faits lus en base au moment du geste : Archiver grisé avec la raison et un lien tant que l'Étape a des Contacts En prospection ou une Battle ouverte, sinon confirmation qui récapitule les effets ; Supprimer pour une Étape qui n'a jamais servi, sans confirmation, avec « Annuler »
- [ ] Toujours au moins une Étape non archivée ; Restaurer (sous « Étapes archivées (n) ») juste après l'Étape qui la précédait si elle est encore dans le Funnel, sinon en fin
- [ ] Le menu d'en-tête du kanban « Renommer » et « Gérer les Étapes… » mène ici
- [ ] Gestes testés (nominal + Annuler, refus d'archivage)
