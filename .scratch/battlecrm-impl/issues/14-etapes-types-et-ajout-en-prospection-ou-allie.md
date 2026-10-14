# 14: Étapes types et ajout En prospection ou Allié

**What to build:** un nouveau compte a les quatre Étapes types dans sa langue d'inscription ; l'ajout rapide propose l'État Vivier · En prospection · Allié, et un Contact ajouté En prospection entre dans le Funnel à l'Étape choisie, ce qui compte comme une Entrée dans le Funnel. Sources : spec UX §5.8 (Étapes types), §6.8 ; CONTEXT (État, Entrée dans le Funnel, Funnel) ; ADR 0003, 0007 ; ST-37, ST-39, ST-49.

**Blocked by:** 13

**Status:** resolved

- [x] Module `funnel` : table des Étapes (nom, But, ordre, archivage) ; `stageOrder(tx)` exporté
- [x] À la création du compte (ticket 06) : Approche, Qualif ESN, Qualif Client, Closing avec leur But, en FR ou EN selon la langue de la tentative, textes Paraglide, jamais traduits ensuite
- [x] Ajout rapide : commande segmentée Vivier · En prospection · Allié, Vivier par défaut, jamais retenue ; Étape visible pour En prospection seulement, la première non archivée par défaut
- [x] Historique des changements d'État (État de départ et d'arrivée, motif, dernière Étape atteinte, date de saisie depuis l'horloge, jamais antidaté), enregistré comme Interaction ; la dernière Étape atteinte est conservée sur le Contact
- [x] Entrée dans le Funnel datée du jour local de son enregistrement ; « Annuler » ne laisse aucune Entrée
- [x] Le résumé porte l'État et l'Étape de chaque Contact, et les Étapes

## Comments

**2026-10-14, implémentation (agent).**

- **Module `funnel`** : table `stage` (`name`, `aim` facultatif, `position`, `archived_at`) ; exporte `stageOrder(tx, userId)` (Étapes non archivées, dans l'ordre), `FUNNEL_ORDER` (l'ordre, que `views` reprend) et `initializeFunnel`, branché sur `onAccountCreated`. Spec stack §5.2 amendée pour le `userId`. Nouveau terme **Étapes types** (_EN_ Standard stages) dans `CONTEXT.md`.
- **Contact** : colonne `stage_id`, l'Étape où il est En prospection, sinon la dernière atteinte ; `CHECK` qu'un Contact En prospection en a une.
- **Historique des changements d'État** : table `status_change` (`from_status`, `to_status`, `stage_id`, `reason`), une ligne par Interaction (unique). Elle n'a pas de date propre : chaque changement écrit sa propre Interaction depuis l'horloge, sans date choisie par l'Utilisateur. Le premier État d'un Contact, Vivier compris, s'enregistre comme un changement depuis aucun : une Entrée dans le Funnel est un `to_status = 'prospecting'`, l'entrée au Cercle un `to_status = 'ally'`, datés du jour local de l'Interaction.
- **`POST /api/contacts`** accepte en plus `status` (`pool` par défaut, `prospecting`, `ally`) et `stageId` (pour `prospecting` seulement) ; une Étape inconnue, archivée ou d'un autre Utilisateur répond 400 `unknown_stage`. Un ancien client qui n'envoie que le nom ajoute toujours au Vivier. « Annuler » supprime aussi le changement d'État : aucune Entrée ne reste.
- **Résumé** : chaque Contact porte `stageId`, le résumé porte `stages` (toutes, archivées comprises avec `archived`, dans l'ordre du Funnel).
- **Migrations** : `0013`, où la RLS de `contact` et `interaction` cesse d'être forcée le temps de valider les clés étrangères (le propriétaire, sous RLS forcée, ne voit aucune ligne sans `app.user_id`), puis est forcée de nouveau ; `0014` (accès, RLS) donne aux comptes existants les Étapes types dans la langue de leurs réglages (les textes de Paraglide recopiés en SQL, tels qu'aujourd'hui) et le premier État de leurs Contacts. Appliquées à la base de dev.
- **SPA** : commande segmentée (`components/ui/segmented-control.tsx`, `RadioGroup` de React Aria) Vivier · En prospection · Allié, Vivier à chaque ouverture ; champ Étape (`select` natif, comme le choix de langue) pour En prospection, la première non archivée par défaut. Notifications « <Contact> entre dans le Funnel à <Étape> », « <Contact> entre au Cercle ». Une Étape partie du Funnel entre-temps : message sur place et relecture du résumé. La liste Contacts affiche « En prospection · <Étape> ».
- **Laissé aux tickets suivants** : les compteurs des notifications (« Entrées 3/5 », ticket 20 et 38 ; « 8/10 », ticket 36) ; `Ctrl Entrée` qui enchaîne sur le geste central (ticket 25) ; Organisation, URL LinkedIn et « Plus de champs » (tickets 15, 17).

