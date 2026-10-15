# 07: L'atelier des Positionnements et la page Organisation passent par ce module

**What to build:** l'atelier des Positionnements, pièces jointes comprises, et la page Organisation envoient leurs gestes par le module du ticket 06. Un geste d'Organisation, qui ne s'annule pas, n'affiche pas de toast Annuler. Il ne reste plus aucun traitement des refus recopié dans les écrans. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 2).

**Blocked by:** 04, 06

**Status:** resolved

- [x] Les gestes de l'atelier et des pièces jointes passent par le module ; la pièce jointe trop lourde reste un refus typé
- [x] Les gestes de la page Organisation passent par le module, sans toast Annuler
- [x] Plus aucune copie du traitement des refus ni du règlement d'un geste dans la SPA ; plus aucun code de refus relu comme une simple chaîne
- [x] Les tests existants de l'atelier et de la page Organisation restent verts sans modification de comportement
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Module** (`apps/web/src/gesture.ts`) : le jeton devient facultatif. Un geste fait sans jeton affiche son message par `notify`, sans « Annuler ». Un test de `gesture.test.ts` le vérifie, sur « Renommer » une Organisation.
- **Atelier** (`positioning-panel.tsx`, `positionings-screen.tsx`) : créer, copier, modifier, corriger le libellé, archiver, désarchiver et supprimer passent par `useSendGesture`. `sendPositioning`, `settlePositioning`, `PositioningAnswer` et le `refusalOf` local (qui relisait le code avec zod comme une chaîne) sont supprimés.
  - Les refus sont typés par `RefusalOf<route>`.
  - Le Positionnement enregistré est tiré des lignes renvoyées, dans le rappel du message.
  - Les trois gestes de la fiche ont un type de réponse explicite (`ActAnswer`), car TypeScript n'infère rien d'une union de routes.
- **Pièces jointes** (`attachments.tsx`) : joindre et retirer passent par le module. `too_large` (413) reste un refus typé.
- **Page Organisation** : renommer, changer de type, fusionner et supprimer passent par le module, sans toast Annuler. `useOrganizationGesture` et `refusalOf` sont supprimés. Tout refus affiche toujours « changée ailleurs ».
- **Comportement** : aucun test modifié. Écarts invisibles pour l'Utilisateur :
  - Sur une Organisation, un corps `invalid` (400) affichait « changée ailleurs ». Il lève maintenant une erreur de l'app, comme au ticket 06. La SPA vérifie le nom avant l'envoi.
  - Dans l'atelier, tout refus non nommé affiche « changé ailleurs ». Les routes concernées ne répondent pas les codes qui n'affichaient rien avant.
  - Fusionner et changer de type : le toast part avant la fermeture de la fenêtre. Les tests de la page restent verts ; à vérifier à la main pour le focus.
