# 16: Écran Contacts et fiche Contact en lecture

**What to build:** l'écran Contacts permet de chercher une personne et de lire sa fiche dans un panneau ancré à droite, ou en page avec sa propre adresse ; la fiche montre l'en-tête, les Coordonnées et le fil des Interactions. Sources : spec UX §5.3, §5.10, §3.1 (fil d'Ariane), §1 (étoile des Alliés) ; prototypes `prototype/19-ecran-contacts` (B) et `prototype/12-fiche-contact` (A et B), qui ne font pas foi sur les États ; ST-63, ST-66, ST-70.

**Blocked by:** 14, 15

**Status:** resolved

- [x] Liste : recherche instantanée (nom, Organisation, poste, e-mail) sur le résumé ; puces Tous (sans les Archivés, ligne « n archivés · Afficher »), Vivier, En prospection, Alliés, Archivés ; tri par dernière Interaction
- [x] Ligne selon l'État (spec UX §5.10) ; « Sans Organisation » à défaut ; étoile ★ avec le libellé accessible « Allié »
- [x] Panneau non modal ancré : changer de ligne remplace son contenu, focus géré (ST-66), panneau ouvert porté par l'URL ; « Ouvrir en page »
- [x] Page : en-tête (nom, Organisation, Cible, LinkedIn, pastilles Étape et État), deux colonnes (fil à gauche, Coordonnées à droite), fil d'Ariane « Contacts › … » ; mobile : page empilée
- [x] Fil chargé à la demande : Interactions de la plus récente à la plus ancienne, changements d'Étape et d'État discrets
- [x] États vides : « Aucun Contact pour l'instant » avec « Ajouter un Contact » `N` ; « Aucun Contact ne correspond »
- [x] axe sans erreur sur l'écran, dans les deux thèmes

## Comments

**2026-10-14, implémentation (agent).**

- **`packages/domain`** : `contactsMatching(saisie, contacts, organisations)` (nom, Organisation, poste, e-mail ; casse, accents et espaces à part, via `normalizeName`), testée.
- **API** : `GET /api/contacts/:id/record` dans `views`, lu à la demande : la note (absente du résumé) et le fil, de la plus récente Interaction à la plus ancienne, chacune avec le changement d'État qu'elle enregistre (`statusChange`, ou `null`). 404 `not_found` pour un Contact d'un autre Utilisateur, inconnu ou un id qui n'en est pas un ; ajouté au test d'accès croisé de `security.test.ts`, qui sait maintenant envoyer un GET. Aucune migration.
- **SPA** : écran Contacts (`contacts/contacts-screen.tsx`) avec recherche (`SearchField`, `useDeferredValue`), puces Tous (sans les Archivés, « n archivés · Afficher » qui passe sur Archivés), Vivier, En prospection, Alliés, Archivés ; lignes selon l'État, étoile ★ annoncée « Allié » (`contacts/contact-name.tsx`, réutilisable partout). Panneau ancré (`ContactPanel`, une `section` nommée par le Contact, onglets Fil / Détails, « Ouvrir en page », ✕ et `Échap` qui rendent le focus à la ligne) ; une ligne cliquée met le focus sur le titre du panneau ; le panneau ouvert est `?contact=<id>`. Page `/contacts/$contactId` (`ContactPage`) : fil d'Ariane « Contacts › … », en-tête (nom, Organisation · Cible, pastilles Étape avec le But et État, LinkedIn), fil à gauche et Coordonnées à droite ; empilée sur mobile, Coordonnées d'abord. Sur mobile, une ligne (ou une adresse `?contact=`) ouvre la page. État vide avec « Ajouter un Contact » `N` (contexte `AddContactContext` fourni par la coque).
- **Laissé aux tickets suivants** : le bloc Prochaine action, « Noter une Interaction » et les actions de la fiche (19, 21, 22) ; le motif d'un Archivé dans la ligne et les Coordonnées (19 : aucun geste n'en écrit encore ; le fil l'affiche déjà) ; le signal de prochaine action d'une ligne En prospection, qui dit pour l'instant « Sans prochaine action » (21, 28) ; les Jours sans contact d'un Allié (36) ; « Modifier » (17) ; le lien vers la page Organisation (18). La pastille d'Étape ne s'affiche qu'En prospection ; la dernière Étape d'un Contact du Vivier viendra avec son bloc (19).
