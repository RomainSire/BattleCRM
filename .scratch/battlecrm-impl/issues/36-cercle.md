# 36: Cercle

**What to build:** la page Cercle montre le compteur « 7/10 » et les Alliés en trois paliers (À relancer, Bientôt, À jour) avec la jauge du Rythme et les Jours sans contact ; l'Utilisateur y prend des nouvelles d'un Allié (une Action de prospection), le relance si une Relance est due, et ajoute un Contact au Cercle. Sources : spec UX §5.11, §6.14, §5.3 (bloc Allié), §2 (couleurs « bientôt ») ; CONTEXT (Cercle d'alliés) ; prototype `prototype/03-page-cercle` (B) ; ST-48, ST-57, ST-58.

**Blocked by:** 22, 20

**Status:** resolved

- [x] `allySignal(ally, today, rhythm)` dans `packages/domain` : Jours sans contact depuis la dernière Interaction faite (ou l'entrée au Cercle), sans signal / bientôt (7 derniers jours) / à relancer, Relance planifiée qui prime ; tests au changement de jour et de fuseau
- [x] En tête : compteur, rangée de pastilles (Taille visée) ou « 7 Alliés » sans Taille visée, « Ajouter au Cercle… » (choix d'un Contact filtré à la frappe, sans les Alliés ; sans résultat, ajout rapide en Allié ; puis la fenêtre du ticket 19)
- [x] Par Allié : nom ★, Organisation, Cible, dernière Interaction, jauge du Rythme (trait du début de « bientôt »), Jours sans contact écrits, « Prendre des nouvelles… » (en gras pour À relancer) ; Relance à venir rangée dans À jour (« ⏰ Relance mer. 14 oct. »), due rangée dans À relancer avec « Relancer… »
- [x] Prendre des nouvelles… : Canal, date, note, récapitulatif « +1 à l'Activité · Jours sans contact remis à 0 · prochaines nouvelles d'ici le <date> », lien « Planifier une Relance… » ; Relance à venir : « Garder la Relance du <date> » (défaut) ou « L'annuler »
- [x] Sur la fiche d'un Allié : bloc « Allié · n j sans contact » avec la jauge, `I` et `F` selon la spec UX §3.3 ; « Noter une Interaction » remplacé par « Prendre des nouvelles… »
- [x] Jamais la couleur seule ; état vide de la spec UX §10 ; mobile en cartes, sous Plus
- [x] Geste testé (nominal + Annuler) ; axe sans erreur dans les deux thèmes

## Comments

**2026-10-23, implémentation (agent).**

- **Domaine** (`packages/domain/src/ally.ts`) : `allySignal(ally, today, rhythmDays)` → `{ signal: 'none' | 'soon' | 'time-to-check-in', daysSinceContact, dueOn, followUp: 'due' | 'upcoming' | null }`. Jours sans contact depuis la dernière Interaction faite, sinon l'entrée au Cercle ; « bientôt » dans les 7 derniers jours du Rythme (`CHECK_IN_SOON_DAYS`), « à relancer » dès son dernier jour ; une Relance planifiée prime (à venir : À jour ; due : À relancer). `nextCheckInOn`. Tests au passage de minuit local, entre deux fuseaux et au passage à l'heure d'hiver.
- **API** (`prospecting`) : `POST /contacts/:id/check-in` `{ channel, occurredOn, note?, cancelFollowUp? }`, geste `checked_in` annulable : Interaction `check_in` sortante, Action de prospection (`PROSPECTING_ACTION_KINDS`), datée du jour saisi ; la Relance planifiée est gardée, ou annulée sur demande. Refus : 409 `not_ally`, 400 `future_day`, 409 `no_follow_up`. Ajouté au test d'accès croisé.
- **Migration** `0040_check_in` (expand) : CHECK des genres d'Interaction et de geste élargis, `interaction.channel` accepte aussi `meeting` et `other`, et une nouvelle contrainte `interaction_channel_kind_check` remplace `interaction_reply_channel_check` (une réponse porte un Canal, jamais `meeting`/`other` ; une Prise de nouvelles porte sa manière). Appliquée à la base de dev.
- **Contrat** : `CHECK_IN_CHANNELS` (E-mail, LinkedIn, Téléphone, Rencontre, Autre, spec UX §6.14). **`CONTEXT.md`** : la Prise de nouvelles « passe par un Canal (e-mail, LinkedIn, téléphone), ou se fait en rencontre ou autrement » et ne consomme jamais la Relance.
- **SPA** :
  - `circle/circle-screen.tsx` (`/circle`, sous Plus sur mobile) : compteur « 4/10 » et pastilles (ou « 4 Alliés » sans Taille visée), trois paliers avec effectif, triés par Jours sans contact. Ligne entièrement cliquable comme celles des Battles et de Contacts (le nom est un lien étiré sur la ligne, un seul arrêt de tabulation, anneau de focus autour de la ligne, ligne ouverte marquée) : nom ★ (fiche en panneau, en page sur mobile), Organisation, Cible, dernière Interaction, « ⏰ Relance mer. 28 oct. », jauge du Rythme (`rhythm-gauge.tsx`, trait au début de « bientôt »), Jours sans contact écrits, « Prendre des nouvelles… » (en gras pour À relancer) ou « Relancer… » pour une Relance due. « Ajouter au Cercle… » : Contact choisi dans une liste filtrée à la frappe, sans les Alliés, puis la fenêtre « Ajouter au Cercle » (ticket 19) ; sans résultat, l'option « Ajouter « X » en Allié » ouvre l'ajout rapide pré-rempli (nom, État Allié). État vide de la spec §10.
  - `contacts/check-in.tsx` (`?interaction=check-in`) : Canal, date, note ; récapitulatif « +1 à l'Activité… » puis « Jours sans contact remis à 0 · prochaines nouvelles d'ici le … » ; Relance à venir : « Garder la Relance du … » (défaut) ou « L'annuler » ; « Planifier une Relance… » (case qui enchaîne après l'enregistrement, comme dans « A répondu… »), seulement sans Relance gardée. Notification « Nouvelles de … notées · prochaines d'ici le … » avec « Annuler ».
  - Fiche d'un Allié : « Allié · n j sans contact », la jauge et le palier écrit ; bouton plein « Prendre des nouvelles… », ou « Relancer… » si la Relance est due (« Prendre des nouvelles… » à côté) ; `I` prend des nouvelles, `F` relance si la Relance est due, sinon prend des nouvelles. Fil : « Nouvelles · Rencontre ».
  - Le récapitulatif « Ajouter au Cercle » compte désormais les prochaines nouvelles depuis la dernière Interaction faite, au plus tôt aujourd'hui.
- **Tests** : domaine `ally.test.ts` (6 cas), API `check-in.test.ts` (3 cas : nominal + Annuler, Relance annulée puis rendue, refus), SPA `circle-screen.test.tsx` (12 cas, axe dans les deux thèmes, mobile compris). Tests existants ajustés : `I` sur un Allié ouvre la Prise de nouvelles, la fiche d'un Allié écrit ses Jours sans contact.
- **Revue** (standards et spec) : corrigés « Planifier une Relance… » proposé alors qu'une Relance due restait, la date des prochaines nouvelles qui ignorait une Relance gardée plus tôt, la règle « dernière Interaction faite + Rythme » écrite trois fois (désormais `nextCheckInOn` dans le domaine), les libellés de canal rangés dans `channel.ts`, le nom de la contrainte.
- **À trancher** :
  - Rencontre et Autre ne sont pas des Canaux au sens du glossaire, mais la spec UX §6.14 les liste sous « Canal » : ils sont stockés dans `interaction.channel` et portés par `CHECK_IN_CHANNELS`. Un terme à part (« manière ») serait plus juste.
  - L'entrée au Cercle n'est pas lue dans le résumé : sans Interaction faite, la SPA prend la dernière Interaction de l'Allié, forcément le changement d'État qui l'y a mis.
  - Un Allié réintroduit dans le Cercle avec une vieille Interaction faite est tout de suite « à relancer » (glossaire, Jours sans contact).
  - Pas de barre collée en bas sur la fiche mobile (spec §5.3), comme pour les autres États.
