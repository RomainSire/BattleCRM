# Vocabulaire anglais de l'interface

Type: grilling
Status: resolved
Blocked by: 

## Question

L'interface est bilingue. Quels sont les équivalents anglais des termes du glossaire (Positionnement, Essai, Battle, Champion, Challenger, Verdict, Relance, Cadence de relance, Délai de réponse, Enseignement, Étape, État, Funnel, Activité, Objectif d'activité, etc.) et de leurs valeurs (issues, États, Verdicts) ?

Garde-fous : rester fidèle aux définitions de `CONTEXT.md`, éviter les termes que le glossaire proscrit en français quand leur équivalent anglais porte le même contresens (par ex. « lead », « pipeline »). La traduction retenue est consignée dans `CONTEXT.md`, à côté de chaque terme.

## Answer

Anglais **US**. Chaque terme du glossaire porte désormais une ligne `_EN_` dans `CONTEXT.md` (équivalent, valeurs, termes anglais à éviter) : c'est elle qui fait foi. Les choix qui ne relèvent pas du calque :

- Positionnement → **Positioning** (à éviter : pitch, template, variant) : seul terme qui garde « façon de se présenter » sans réduire le Positionnement au message.
- Essai → **Trial**, issue → **Outcome** : *In progress*, *Success*, **No result** (sans suite : neutre, fidèle au registre factuel du détachement), *Canceled*.
- Relance → **Follow-up** : le français proscrit « follow-up » comme anglicisme, mais en anglais c'est le mot juste. États *Scheduled*, *Done*, *Canceled*, signal *Overdue*. Cadence → *Follow-up cadence*.
- Délai de réponse → **Response window**, avec le signal **Window elapsed**, volontairement distinct du *Overdue* d'une Relance.
- Étape → **Stage** (« stage » n'est proscrit qu'en français).
- État → **Status** : *Active*, *Paused*, **Dropped**, *Won*. Pas *Closed*, qui signifie « affaire signée » en vente anglophone, soit le contresens exact de « clos » ; pas *Lost*.
- Cible → **Target** : *Consultancy* (ESN), *End client*, *Unknown*. Objectif d'activité → **Activity goal**, pour ne pas le confondre avec la Cible.
- Verdicts : *Challenger wins*, *Title defended*, **Draw** (cohérent avec l'univers du combat), *Not enough data*, *Abandoned*. Dans l'Historique des Champions, les vainqueurs sont marqués *Proven* ou *Designated*. Enseignement → **Takeaway**.
- Traductions directes : Contact, Organization, Funnel, Interaction, Battle, Champion, Challenger, Champion history, Verdict, Win rule, Confidence threshold, Horizon, Success criterion, Activity, Prospecting action, User.
