# Attribution quand plusieurs Battles touchent un même Contact

Type: grilling
Status: resolved
Blocked by:

## Question

Un Contact peut traverser plusieurs Étapes, et donc participer à plusieurs Battles (par ex. exposé au mail d'accroche B, puis au CV A). Que vaut un résultat de Battle aval, et le modèle doit-il faire quelque chose de cette dépendance ?

À trancher :
- Le Positionnement d'une Étape amont influence-t-il le succès en aval (un bon mail d'accroche amène des Contacts plus chauds au CV) ? Faut-il seulement le **retenir** (l'Essai aval connaît le Positionnement amont utilisé) ou aussi le **montrer / stratifier** ?
- Biais de sélection : en aval, seuls les Contacts qui ont passé l'Étape amont sont testés. Est-ce acceptable (on mesure « le meilleur CV pour ceux qui l'atteignent ») ? Faut-il le dire dans le Verdict ?
- Un changement de Champion en amont pendant une Battle aval ouverte : la Battle aval continue-t-elle, est-elle signalée ?
- Faut-il une règle, ou est-ce une limite assumée, écrite une fois (peut-être ADR) ?

## Answer

Tranché en grilling avec Romain (2026-09-27). **Limite assumée, pas de règle dans le modèle.** Définition de **Battle** précisée dans `CONTEXT.md`.

Argument central : le tirage aléatoire équilibré de la Battle aval répartit en moyenne le même mélange de Contacts « réchauffés en amont » entre les deux bras. L'influence amont ne fausse donc pas la comparaison A contre B (validité interne) ; elle ne fait que borner la portée du résultat à la population qui atteint l'Étape.

- **Positionnement amont** : pas de champ sur l'Essai aval. L'information reste reconstituable à partir de l'historique, puisque chaque utilisation d'un Positionnement est une Interaction datée du Contact.
- **Montrer / stratifier** : ni stratification du tirage ni ventilation par Positionnement amont. À 10-25 Essais par bras, ce serait du bruit. Une ventilation indicative pourra être ajoutée plus tard sans toucher au modèle.
- **Biais de sélection** : accepté, c'est même la bonne question (« le meilleur CV pour ceux qui atteignent le CV »). Il n'est pas rappelé dans chaque Verdict : la définition de Battle le dit une fois.
- **Nouveau Champion en amont pendant une Battle aval ouverte** : la Battle aval continue, sans aucun signal. Le changement touche les deux bras de la même façon ; l'Historique des Champions date ces changements pour qui veut les recouper.
- **ADR** : non, car la décision se renverse facilement.
