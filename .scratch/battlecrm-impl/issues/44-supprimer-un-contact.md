# 44: Supprimer un Contact

**What to build:** sous `⋯` de la fiche, « Supprimer le Contact… » ouvre une confirmation irréversible (qui propose d'archiver à la place) ; le Contact est anonymisé : ses champs identifiants et les notes de ses Interactions sont effacés, ses Essais et Interactions restent sous « Contact supprimé », son Essai en cours est annulé et sa Relance planifiée annulée. Sources : spec UX §6.13, §10 ; CONTEXT (Contact) ; ADR 0006 ; spec stack §6 (anonymisation) ; ST-38.

**Blocked by:** 29

**Status:** ready-for-agent

- [ ] Anonymisation sur place dans une transaction : nom, poste, coordonnées, URL LinkedIn (libérée), note et notes d'Interactions effacés ; marqueur `anonymized_at` ; `CHECK` qu'un Contact anonymisé n'a plus de champ identifiant
- [ ] Essai en cours annulé (motif « Contact supprimé »), Relance planifiée annulée, Tirage réservé tombé ; Battles, Activité et Taux de passage inchangés
- [ ] Confirmation « Supprimer <Contact> ? Ses coordonnées et ses notes sont effacées définitivement. Ses n Essais restent dans les Battles, sans son nom. » avec Archiver à la place ; pas d'« Annuler »
- [ ] Le Contact disparaît de Contacts, du Funnel et de la palette ; la copie locale est rafraîchie par les lignes renvoyées ; seuls les Essais d'une Battle le montrent sous « Contact supprimé »
- [ ] Tests : champs effacés en base, Battle inchangée
