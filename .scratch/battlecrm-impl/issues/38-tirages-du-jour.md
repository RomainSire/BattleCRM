# 38: Tirages du jour

**What to build:** sur Aujourd'hui, le bandeau Entrées (« Entrées cette semaine 2/5 ») propose 3 ou 4 Contacts du Vivier tirés au hasard avec « Faire entrer… », chacun remplacé par un nouveau tirage une fois entré ; la liste des Contacts sans prochaine action en montre 3 ou 4 tirés une fois par jour ; une Battle concluante propose Clôturer… ou Plus tard. Ces tirages restent les mêmes toute la journée sur tous les appareils. Sources : spec UX §5.1 ; spec stack §5.2 (`daily_pick`) ; ST-47, ST-49.

**Blocked by:** 37, 19

**Status:** ready-for-agent

- [ ] Table `daily_pick` du module `views`, par jour local : remplie à la première lecture du jour, complétée au remplacement d'un Contact entré et par « Un autre » (ticket 40)
- [ ] Bandeau : compteur des Entrées de la semaine du lundi face à l'Objectif d'entrées en vigueur (couleur de succès une fois atteint, « 6/5 » si dépassé, « 3 cette semaine » si désactivé) ; propositions (nom, Organisation, dernière Étape atteinte ou « jamais entré ») même une fois l'objectif atteint ; Vivier vide → « Ajouter un Contact » `N`
- [ ] Contacts sans prochaine action : 3 ou 4 tirés une fois par jour, non remplacés une fois traités ; actions « Utiliser un Positionnement » et « Planifier une Relance »
- [ ] Battles concluantes : Clôturer… (ticket 32), Plus tard masquée jusqu'au lendemain sur tous les appareils (stocké par jour local)
- [ ] Ordre de priorité de la spec UX §5.1 ; tests avec l'horloge pilotable au passage de minuit
