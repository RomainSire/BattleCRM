# 26: Cadence de relance

**What to build:** après l'utilisation d'un Positionnement, l'app planifie les Relances une à une selon sa Cadence : chaque Relance porte son rang et le message du rang à copier dans « Relancer… » ; une Interaction sortante décale la Relance planifiée, une Interaction entrante arrête la Cadence. Sources : CONTEXT (Cadence de relance, Relance, Délai de réponse) ; spec UX §6.3, §6.4, §6.5 ; ST-34 (écarts).

**Blocked by:** 25, 22

**Status:** ready-for-agent

- [ ] Relance de Cadence : rang, message lu depuis la dernière utilisation d'un Positionnement sur le Contact ; « Relancer… » montre ce qui a été envoyé et quand, le Canal, le message du rang et les pièces jointes, puis planifie la Relance suivante (ou annonce « puis le Délai de réponse »)
- [ ] Chaque intervalle se compte depuis la dernière Interaction sortante faite : « Noter une Interaction » décale la Relance planifiée, et le dit dans son récapitulatif
- [ ] Une Interaction entrante arrête la Cadence ; une Relance planifiée à la main ensuite, ou après le dernier rang, est hors Cadence et sans message
- [ ] « Modifier la Relance » garde son rang et son message
- [ ] Règles de planification testées comme fonctions pures si elles vivent dans `packages/domain`, et par geste dans l'API (nominal + Annuler)
