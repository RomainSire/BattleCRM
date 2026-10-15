# 03: Les gestes de Prospection passent par le module Geste

**What to build:** les 7 autres gestes annulables sur un Contact passent par le circuit commun posé au ticket 02 :
- ajouter un Contact ;
- modifier le Contact ;
- changer d'État ;
- noter une Interaction ;
- A répondu… ;
- Relancer… ;
- annuler la Relance.

Pour l'Utilisateur, rien ne change : mêmes réponses, mêmes refus, même Annuler. Le module Prospection ne garde que ce qui varie d'un geste à l'autre. Sources : revue d'architecture du 2026-10-15 (piste 1) ; ADR 0011.

**Blocked by:** 02

**Status:** resolved

- [x] Chacun des 7 gestes passe par le circuit commun, son inverse déclaré à côté de lui
- [x] Les refus de Prospection prennent la forme commune ; la classe de refus propre à Prospection, et ses `catch` répétés, ne sont plus utilisés par aucun geste
- [x] L'enregistrement d'une Interaction et sa vérification ne sont plus répétés geste par geste
- [x] Les tests existants de Prospection et d'Annuler restent verts sans modification de comportement
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Les 7 gestes** passent par le circuit commun, chacun déclaré avec son inverse. « Ajouter un Contact », « modifier le Contact », « changer d'État », « noter une Interaction » et « A répondu… » sont dans `prospecting/index.ts`. « Annuler la Relance » et « Relancer… » rejoignent « Planifier une Relance » dans `prospecting/follow-ups.ts`. Les routes ne font plus que valider le corps et appeler le circuit.
- **Geste qui crée son sujet** : « ajouter un Contact » n'a pas de `:id`. Le circuit gagne `Creation` et `create` (réponse 201), à côté de `Gesture` et `perform`. Les deux partagent la fin du circuit (`run`) : transaction, refus des écritures annulé, enregistrement, lignes du résumé, jeton. Les déclarations communes (sorte, colonne du sujet, ce qu'il retient, inverse) forment `Undoable`. Le ticket 04 s'en servira pour « créer un Positionnement ».
- **Sujet « Coordonnées »** : « modifier le Contact » déclare son propre sujet (`contactCoordinates`), qui charge les Coordonnées au lieu de l'État. Le circuit n'a pas eu à changer.
- **Refus** : `REFUSAL_STATUS` reçoit les codes de Prospection, avec leurs statuts inchangés. Un code peut porter des détails typés (`RefusalDetails`). Ainsi `refusal('linkedin_url_taken', { contactId })` renvoie toujours le Contact qui a le profil, et le client hc le voit. La classe `Refusal` de Prospection, `onContact` et leurs `catch` sont supprimés. Les assistants (`chosenOrganization`, `writeStatusChange`, `dayEntered`) renvoient un refus au lieu de le lancer. Un refus survenu après des écritures (une organisation déjà prise, un profil déjà pris, un changement d'État refusé dans « A répondu… ») passe par le chemin de `write`, qui annule la transaction : ce chemin est désormais couvert par les tests.
- **Interactions** : `prospecting/interactions.ts` regroupe `recordInteraction` (insérer et vérifier), `recordInteractionNow` (ni sortante ni entrante, datée maintenant), `removeInteraction` et `dayEntered`.
- **Compatibilité** : sortes de gestes, colonnes et formes retenues inchangées. Les gestes enregistrés par la version précédente s'annulent toujours, et inversement. Aucun test modifié, aucune migration.
- `lockContact` n'avait plus d'appelant : supprimé. `app.ts` passe `inverses: {}`. La moitié Contact de l'ancien circuit (`Inverse`, `Inverses`, la branche Contact de `oldInverse` et de `recordGesture`) n'a plus d'utilisateur : elle sera supprimée au ticket 05.
