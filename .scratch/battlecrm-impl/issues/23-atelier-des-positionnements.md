# 23: Atelier des Positionnements

**What to build:** l'écran Positionnements, un atelier à trois colonnes (Étapes, Positionnements en lignées, fiche sur place) où l'Utilisateur crée un Positionnement avec son Canal, son contenu et sa Cadence de relance, le modifie tant qu'il n'a servi à rien, en crée une copie modifiée ou le duplique, l'archive, le désarchive et supprime un Positionnement jamais utilisé. Sources : spec UX §5.6, §6.10 ; CONTEXT (Positionnement, Cadence de relance, Canal) ; prototype `prototype/13-gestion-positionnements` (C) ; ST-32.

**Blocked by:** 14

**Status:** resolved

- [x] Module `funnel` : Positionnement (Étape, libellé, Canal, contenu avec `{prénom}`, Cadence : intervalles, message facultatif par rang, Délai de réponse), lien « dérivé de »
- [x] Création préremplie depuis la Cadence par défaut (valeurs par défaut +3, +7, +14, 14 j si le ticket 20 n'est pas fait) ou depuis l'original ; « un autre canal, c'est un autre Positionnement »
- [x] Jamais utilisé : Modifier, Dupliquer… (copie modifiée), Supprimer (annulable) ; utilisé hors Battle : modifiable mais plus supprimable ; figé (au moins un Essai, à brancher au ticket 28) : « 🔒 Figé », Créer une copie modifiée…, Corriger le libellé
- [x] Archiver à la main (ni Champion ni dans une Battle ouverte, règles complétées aux tickets 27 et 32), Désarchiver ; « Afficher les archivés (n) » avec le motif
- [x] Lignées : une copie sous son original, décalée ; colonne des Étapes avec le nombre de Positionnements non archivés
- [x] Retours vers le parcours d'origine prévus dans le panneau (« Créer et revenir… », « Annuler et revenir »), branchés par les tickets 25 et 27
- [x] Mobile : empilé, sous Plus › Sur ordinateur ; gestes testés

## Comments

**2026-10-15, implémentation (agent).**

- **API** (`funnel`, `positionings.ts`) : table `positioning` (Étape, libellé, Canal, contenu facultatif, `follow_up_days` / `follow_up_messages` de même longueur, message `null` sans texte, `response_window_days`, `derived_from_id`, `archived_at`), clés composites vers l'Étape et l'original. Migrations `0024_positionings` (RLS de `stage` levée le temps des clés étrangères, comme `0021`) et `0025_positionings_access` (RLS forcée), appliquées à la base de dev. Six gestes, chacun avec son inverse : `POST /positionings` (création ou copie modifiée, à l'Étape de l'original ; 400 `unknown_stage` pour une Étape archivée, inconnue ou d'un autre, 400 `unknown_positioning`), `/:id/edit` (tout sauf l'Étape **et le Canal** : « un autre canal, c'est un autre Positionnement »), `/:id/relabel`, `/:id/archive` (409 `archived`), `/:id/unarchive` (409 `not_archived`), `/:id/delete` (ses copies perdent leur original ; « Annuler » rend les deux).
- **Annuler** : un geste porte désormais un Contact **ou** un Positionnement (`gesture.positioning_id`, sans clé étrangère, `CHECK` de cohérence avec le genre) ; refusé après un geste ultérieur sur le même Positionnement, après une copie faite d'une création, ou si l'original d'un Positionnement supprimé l'a été aussi. Spec stack §5.2 et §5.4 amendées.
- **Résumé** : `positionings` (archivés compris, par id), et chaque geste renvoie `positionings` / `removedPositioningIds`. `used: false` et `trialCount: 0` sont constants jusqu'aux tickets 25 et 28, qui les compteront et ajouteront les refus « figé » / « utilisé » (ST-32) dans la transaction des gestes ; la SPA gère déjà les trois états.
- **SPA** (`positionings/`) : atelier à trois colonnes (Étapes avec le nombre de non archivés, lignées décalées, fiche sur place), Étape, Positionnement et panneau dans l'adresse (ST-70), brouillon en `sessionStorage`. Panneau Nouveau / Modifier / Dupliquer… / Créer une copie modifiée… prérempli avec la Cadence par défaut ou l'original, « Insérer {prénom} » au curseur ; Corriger le libellé ; Archiver, Désarchiver, Supprimer, tous avec « Annuler ». `PositioningPanelReturn` (« Créer et revenir… », « Annuler et revenir ») prêt pour 25 et 27. Mobile : Plus › Sur ordinateur, empilé.
- **`CONTEXT.md`** : _EN_ de Positionnement complété (*frozen*, *lineage*). **`packages/contract`** : bornes du libellé, du contenu et d'un message de relance.
- **Revue** : Canal verrouillé à la modification ; refus tous rendus par la même table de statuts ; guillemets du texte « Copie modifiée de » passés en message ; Annuler dans « Corriger le libellé ».
- **À trancher** : le jeton du prénom dépend de la langue (`{prénom}` / `{first name}`), le ticket 25 devra remplacer les deux ; le motif d'archivage n'est pas stocké (« archivé à la main » affiché pour tous), le ticket 32 ajoutera « battu par … le … ».
- **Laissé aux tickets suivants** : pièces jointes (24) ; usage, Essais, figé, refus de suppression/modification (25, 28) ; Champion, Challenger, règles d'archivage liées aux Battles (27, 32) ; inverses d'édition à refuser une fois figé (28).
