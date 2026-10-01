# Supprimer un Contact l'anonymise

Supprimer un Contact efface ce qui identifie la personne (nom, poste, coordonnées, note, notes de ses Interactions) mais garde ses Essais et ses Interactions, rattachés à « Contact supprimé ». Un Contact est un tiers : il peut demander l'effacement de ses données (RGPD), et un Contact saisi par erreur doit pouvoir disparaître. Clore ne répond à aucun des deux besoins. Effacer aussi l'historique aurait changé après coup les Battles (une Battle ouverte perdrait des points de donnée, le Verdict d'une Battle close ne se retrouverait plus), l'Activité passée et le Taux de passage. Détail : `.scratch/battlecrm-ux/issues/19-ecran-contacts-modifier-contact.md`.

## Conséquences

- La suppression est irréversible : elle passe par une fenêtre de confirmation, pas par « Annuler ».
- Son Essai en cours passe en annulé (motif « Contact supprimé ») : il ne pourrait plus être réglé. Sa Relance planifiée est annulée. Son URL LinkedIn redevient libre.
- Un Contact anonymisé n'apparaît plus dans Contacts, le Funnel ni la palette. Seuls les Essais d'une Battle le montrent, sous « Contact supprimé ».
- Le stockage doit pouvoir effacer ces champs pour de bon, y compris dans les copies locales de consultation et dans les sauvegardes, selon leur politique de rétention.
