# 02: Le module Geste porte tout le circuit d'un geste, prouvé sur « Planifier une Relance »

**What to build:** aujourd'hui, chaque geste annulable réécrit les mêmes étapes, 16 fois :
- lire et valider l'identifiant, sinon 404 ;
- ouvrir la transaction ;
- verrouiller le sujet ;
- le charger, sinon 404 ;
- vérifier les préconditions et les refus ;
- faire les écritures ;
- enregistrer le geste ;
- noter les lignes touchées et relire les lignes modifiées du résumé ;
- renvoyer le jeton d'annulation.

Les refus prennent trois formes selon le module, et le module Geste code en dur deux sujets, le Contact et le Positionnement.

Ce ticket pose, **à côté de l'ancien**, un circuit commun porté par le module Geste. Un geste n'y déclare que ce qui varie : son sujet, ses préconditions et refus, ses écritures, ce qu'il retient pour être défait, et son inverse, écrit à côté de lui (ADR 0011). Le sujet est un paramètre du circuit : un nouveau sujet comme la Battle s'y ajoute sans branche propre à lui. Les refus ont une seule forme, un code et un statut HTTP, partagée par tous les modules. « Planifier une Relance » est le premier geste migré, et il sert de preuve. Les autres gestes restent sur l'ancien circuit jusqu'aux tickets 03 et 04. Sources : revue d'architecture du 2026-10-15 (piste 1) ; ADR 0011.

**Blocked by:** 01

**Status:** resolved

- [x] Le module Geste expose un circuit commun : un geste y déclare son sujet, ses préconditions, ses écritures, ce qu'il retient et son inverse ; tout le reste (identifiant, transaction, verrou, chargement ou 404, enregistrement, lignes modifiées, jeton, réponse) est fait par le circuit
- [x] Le sujet d'un geste est un paramètre du circuit, sans union ni branche propre au Contact ou au Positionnement
- [x] Une seule forme de refus (code et statut HTTP), utilisable par tous les modules ; les codes sont typés jusqu'au client hc
- [x] Les lignes touchées par un geste se décrivent d'une seule façon, sans champ facultatif « laissé de côté par les gestes sur un Contact »
- [x] L'inverse d'un geste est déclaré avec lui, et il est testable sans passer par HTTP (au moins un test le prouve)
- [x] « Planifier une Relance » passe par le circuit commun ; ses réponses, ses refus et Annuler sont inchangés, et ses tests existants restent verts
- [x] L'ancien circuit fonctionne toujours pour les autres gestes : aucun autre test ne change
- [x] Aucune migration ; la forme des réponses reste compatible avec la version précédente de la SPA
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Circuit commun** (`gestures/index.ts`, `createCircuit`) : un geste se déclare comme un `Gesture` : `kind`, `subject`, `refuse` (préconditions, avant toute écriture), `write` (écritures, plus ce qu'il retient et les lignes touchées), `retained` (schéma zod de ce qu'il retient) et `inverse`. `perform(c, geste, entrée)` fait le reste : `:id` ou 404, transaction, verrou, chargement ou 404, enregistrement dans `gesture`, lignes du résumé, jeton, réponse 200.
  - Un refus renvoyé par `write` annule la transaction : il couvre les refus décidés par la base, comme `linkedin_url_taken` et `organization_taken` au ticket 03. Aucun geste migré ne s'en sert encore, ce chemin n'a donc pas encore de test.
- **Sujet** (`GestureSubject`) : la colonne de `gesture` qui le nomme, et une fonction `load`. Le Contact est déclaré dans `prospecting/contact-subject.ts`. Le circuit n'a aucune branche par sujet. Il reste deux unions fermées dans le module Geste, `SubjectColumn` et les sortes de gestes : le ticket 05 les supprime.
- **Annuler** : la route cherche d'abord la sorte de geste parmi les gestes du circuit, puis se rabat sur les inverses de l'ancien circuit. `createGestures` reçoit `gestures` et n'exige l'ancien inverse que pour les autres sortes : une sorte sans inverse ne compile pas.
- **Refus** (`apps/api/src/refusals.ts`) : une seule table `REFUSAL_STATUS` (code → statut), `refusal(code)` et `answerRefusal(c, refus)`. Le client hc reçoit une réponse typée par code, et donc les codes possibles pour chaque statut. Annuler utilise déjà cette forme. La forme ne porte qu'un code : `linkedin_url_taken` renvoie aussi un `contactId`, il faudra l'étendre au ticket 03.
- **Lignes touchées** : `Touched` n'a plus de champ facultatif. `touched({...})` remplit les listes vides, et remplace `touching` (Organisations) ainsi que les littéraux écrits à la main dans Prospection et l'atelier.
- **« Planifier une Relance »** : déclarée dans `prospecting/follow-ups.ts`, avec `scheduledFollowUp`. La sorte `follow_up_scheduled` et la forme de ce que le geste retient ne changent pas, donc les gestes enregistrés par la version précédente s'annulent toujours, et inversement.
- **Test sans HTTP** : `prospecting/follow-ups.test.ts` appelle l'inverse directement dans une transaction.
- `SignedInEnv` est exporté par `auth` pour typer le contexte reçu par le circuit.
