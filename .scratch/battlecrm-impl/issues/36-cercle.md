# 36: Cercle

**What to build:** la page Cercle montre le compteur « 7/10 » et les Alliés en trois paliers (À relancer, Bientôt, À jour) avec la jauge du Rythme et les Jours sans contact ; l'Utilisateur y prend des nouvelles d'un Allié (une Action de prospection), le relance si une Relance est due, et ajoute un Contact au Cercle. Sources : spec UX §5.11, §6.14, §5.3 (bloc Allié), §2 (couleurs « bientôt ») ; CONTEXT (Cercle d'alliés) ; prototype `prototype/03-page-cercle` (B) ; ST-48, ST-57, ST-58.

**Blocked by:** 22, 20

**Status:** ready-for-agent

- [ ] `allySignal(ally, today, rhythm)` dans `packages/domain` : Jours sans contact depuis la dernière Interaction faite (ou l'entrée au Cercle), sans signal / bientôt (7 derniers jours) / à relancer, Relance planifiée qui prime ; tests au changement de jour et de fuseau
- [ ] En tête : compteur, rangée de pastilles (Taille visée) ou « 7 Alliés » sans Taille visée, « Ajouter au Cercle… » (choix d'un Contact filtré à la frappe, sans les Alliés ; sans résultat, ajout rapide en Allié ; puis la fenêtre du ticket 19)
- [ ] Par Allié : nom ★, Organisation, Cible, dernière Interaction, jauge du Rythme (trait du début de « bientôt »), Jours sans contact écrits, « Prendre des nouvelles… » (en gras pour À relancer) ; Relance à venir rangée dans À jour (« ⏰ Relance mer. 14 oct. »), due rangée dans À relancer avec « Relancer… »
- [ ] Prendre des nouvelles… : Canal, date, note, récapitulatif « +1 à l'Activité · Jours sans contact remis à 0 · prochaines nouvelles d'ici le <date> », lien « Planifier une Relance… » ; Relance à venir : « Garder la Relance du <date> » (défaut) ou « L'annuler »
- [ ] Sur la fiche d'un Allié : bloc « Allié · n j sans contact » avec la jauge, `I` et `F` selon la spec UX §3.3 ; « Noter une Interaction » remplacé par « Prendre des nouvelles… »
- [ ] Jamais la couleur seule ; état vide de la spec UX §10 ; mobile en cartes, sous Plus
- [ ] Geste testé (nominal + Annuler) ; axe sans erreur dans les deux thèmes
