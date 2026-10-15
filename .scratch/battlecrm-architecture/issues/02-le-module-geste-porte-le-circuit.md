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

**Status:** ready-for-agent

- [ ] Le module Geste expose un circuit commun : un geste y déclare son sujet, ses préconditions, ses écritures, ce qu'il retient et son inverse ; tout le reste (identifiant, transaction, verrou, chargement ou 404, enregistrement, lignes modifiées, jeton, réponse) est fait par le circuit
- [ ] Le sujet d'un geste est un paramètre du circuit, sans union ni branche propre au Contact ou au Positionnement
- [ ] Une seule forme de refus (code et statut HTTP), utilisable par tous les modules ; les codes sont typés jusqu'au client hc
- [ ] Les lignes touchées par un geste se décrivent d'une seule façon, sans champ facultatif « laissé de côté par les gestes sur un Contact »
- [ ] L'inverse d'un geste est déclaré avec lui, et il est testable sans passer par HTTP (au moins un test le prouve)
- [ ] « Planifier une Relance » passe par le circuit commun ; ses réponses, ses refus et Annuler sont inchangés, et ses tests existants restent verts
- [ ] L'ancien circuit fonctionne toujours pour les autres gestes : aucun autre test ne change
- [ ] Aucune migration ; la forme des réponses reste compatible avec la version précédente de la SPA
- [ ] `pnpm check` vert
