# 23: Atelier des Positionnements

**What to build:** l'écran Positionnements, un atelier à trois colonnes (Étapes, Positionnements en lignées, fiche sur place) où l'Utilisateur crée un Positionnement avec son Canal, son contenu et sa Cadence de relance, le modifie tant qu'il n'a servi à rien, en crée une copie modifiée ou le duplique, l'archive, le désarchive et supprime un Positionnement jamais utilisé. Sources : spec UX §5.6, §6.10 ; CONTEXT (Positionnement, Cadence de relance, Canal) ; prototype `prototype/13-gestion-positionnements` (C) ; ST-32.

**Blocked by:** 14

**Status:** ready-for-agent

- [ ] Module `funnel` : Positionnement (Étape, libellé, Canal, contenu avec `{prénom}`, Cadence : intervalles, message facultatif par rang, Délai de réponse), lien « dérivé de »
- [ ] Création préremplie depuis la Cadence par défaut (valeurs par défaut +3, +7, +14, 14 j si le ticket 20 n'est pas fait) ou depuis l'original ; « un autre canal, c'est un autre Positionnement »
- [ ] Jamais utilisé : Modifier, Dupliquer… (copie modifiée), Supprimer (annulable) ; utilisé hors Battle : modifiable mais plus supprimable ; figé (au moins un Essai, à brancher au ticket 28) : « 🔒 Figé », Créer une copie modifiée…, Corriger le libellé
- [ ] Archiver à la main (ni Champion ni dans une Battle ouverte, règles complétées aux tickets 27 et 32), Désarchiver ; « Afficher les archivés (n) » avec le motif
- [ ] Lignées : une copie sous son original, décalée ; colonne des Étapes avec le nombre de Positionnements non archivés
- [ ] Retours vers le parcours d'origine prévus dans le panneau (« Créer et revenir… », « Annuler et revenir »), branchés par les tickets 25 et 27
- [ ] Mobile : empilé, sous Plus › Sur ordinateur ; gestes testés
