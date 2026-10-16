# 26: Cadence de relance

**What to build:** après l'utilisation d'un Positionnement, l'app planifie les Relances une à une selon sa Cadence : chaque Relance porte son rang et le message du rang à copier dans « Relancer… » ; une Interaction sortante décale la Relance planifiée, une Interaction entrante arrête la Cadence. Sources : CONTEXT (Cadence de relance, Relance, Délai de réponse) ; spec UX §6.3, §6.4, §6.5 ; ST-34 (écarts).

**Blocked by:** 25, 22

**Status:** resolved

- [x] Relance de Cadence : rang, message lu depuis la dernière utilisation d'un Positionnement sur le Contact ; « Relancer… » montre ce qui a été envoyé et quand, le Canal, le message du rang et les pièces jointes, puis planifie la Relance suivante (ou annonce « puis le Délai de réponse »)
- [x] Chaque intervalle se compte depuis la dernière Interaction sortante faite : « Noter une Interaction » décale la Relance planifiée, et le dit dans son récapitulatif
- [x] Une Interaction entrante arrête la Cadence ; une Relance planifiée à la main ensuite, ou après le dernier rang, est hors Cadence et sans message
- [x] « Modifier la Relance » garde son rang et son message
- [x] Règles de planification testées comme fonctions pures si elles vivent dans `packages/domain`, et par geste dans l'API (nominal + Annuler)

## Comments

**2026-10-16, implémentation (agent).**

- **`packages/domain`** : `cadenceFollowUpOn(rank, lastOutboundOn, followUpDays)` (jour de la Relance d'un rang, son intervalle après la dernière Interaction sortante faite ; aucune après le dernier rang), `firstFollowUpOn` en devient le rang 1 ; `shiftedFollowUpOn` (une Interaction sortante repousse la Relance de Cadence, jamais ne l'avance : un jour repoussé à la main reste), testés.
- **API** (`prospecting`), sans migration ni changement d'endpoint (`follow_up.rank` existait depuis le 25) ; le message n'est pas stocké, il se lit dans le dernier Positionnement utilisé sur le Contact (`funnel` expose `cadenceOf`) :
  - Relancer… sur un rang de la Cadence planifie le rang suivant à `max(Interactions sortantes)` + son intervalle ; après le dernier rang, rien (le Délai de réponse). « Annuler » supprime la Relance suivante.
  - Noter une Interaction repousse la Relance de Cadence ; « Annuler » lui rend son jour.
  - A répondu… arrête la Cadence : la Relance gardée perd son rang (hors Cadence, sans message) ; « Annuler » le lui rend. Une Relance planifiée à la main ensuite est hors Cadence ; Modifier la Relance garde son rang.
  - Payloads retenus étendus en champs facultatifs (`nextFollowUpId`, `pushed`, `unranked`) : les gestes d'avant s'annulent toujours.
- **SPA** : Relancer… (rang de Cadence) montre « « CV B » envoyé le … · par LinkedIn », le message du rang avec le prénom et « Copier le message », les pièces jointes (`AttachmentLinks`, sorti de `use-positioning.tsx`), et au récapitulatif « Puis la Relance n le … » (« déjà en retard » si besoin) ou « Puis le Délai de réponse (14 j) » ; sans message, « Pas de message pour la Relance n ». Noter une Interaction : « La Relance n passe au … ». A répondu… : « Annuler la Relance n du … », et, gardée, « La Cadence s'arrête : … reste planifiée, hors Cadence ». `contacts/cadence.ts` lit la dernière utilisation et la dernière Interaction sortante dans le fil.
- **Revue** : repli `positioningsOf` pour un résumé d'une version précédente ; rang dans la case de A répondu… (§6.2).
- **Laissé aux tickets suivants** : écarts à la Cadence (sauter, ajouter, changer la date d'une Relance pendant un Essai) tracés sur l'Essai (28, ST-34) ; Délai de réponse et « délai dépassé » (29).
- **À trancher** : une Relance de Cadence avancée à la main peut être repoussée par une Interaction notée ensuite (intervalle compté depuis elle) ; le panneau Relancer… montre le contenu hors Cadence le temps que le fil se charge.
