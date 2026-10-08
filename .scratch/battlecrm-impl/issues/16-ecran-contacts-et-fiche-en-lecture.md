# 16: Écran Contacts et fiche Contact en lecture

**What to build:** l'écran Contacts permet de chercher une personne et de lire sa fiche dans un panneau ancré à droite, ou en page avec sa propre adresse ; la fiche montre l'en-tête, les Coordonnées et le fil des Interactions. Sources : spec UX §5.3, §5.10, §3.1 (fil d'Ariane), §1 (étoile des Alliés) ; prototypes `prototype/19-ecran-contacts` (B) et `prototype/12-fiche-contact` (A et B), qui ne font pas foi sur les États ; ST-63, ST-66, ST-70.

**Blocked by:** 14, 15

**Status:** ready-for-agent

- [ ] Liste : recherche instantanée (nom, Organisation, poste, e-mail) sur le résumé ; puces Tous (sans les Archivés, ligne « n archivés · Afficher »), Vivier, En prospection, Alliés, Archivés ; tri par dernière Interaction
- [ ] Ligne selon l'État (spec UX §5.10) ; « Sans Organisation » à défaut ; étoile ★ avec le libellé accessible « Allié »
- [ ] Panneau non modal ancré : changer de ligne remplace son contenu, focus géré (ST-66), panneau ouvert porté par l'URL ; « Ouvrir en page »
- [ ] Page : en-tête (nom, Organisation, Cible, LinkedIn, pastilles Étape et État), deux colonnes (fil à gauche, Coordonnées à droite), fil d'Ariane « Contacts › … » ; mobile : page empilée
- [ ] Fil chargé à la demande : Interactions de la plus récente à la plus ancienne, changements d'Étape et d'État discrets
- [ ] États vides : « Aucun Contact pour l'instant » avec « Ajouter un Contact » `N` ; « Aucun Contact ne correspond »
- [ ] axe sans erreur sur l'écran, dans les deux thèmes
