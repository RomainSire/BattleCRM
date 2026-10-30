# Rédiger la spec de l'extension

Type: task
Status: resolved
Blocked by: 09, 10, 11

## Question

Écrire `.scratch/battlecrm-extension/spec.md`, sur le modèle des specs [UX](../../battlecrm-ux/spec.md) et [stack](../../battlecrm-stack/spec.md), à partir des décisions de la carte : surfaces, gestes, microcopie, lecture de LinkedIn, contrat d'API, stack, tests, livraison, avec ses exigences `ST-xx` (la première : le plugin `bearer`, décision de [Contrat d'API : présence et ajout](08-contrat-presence-et-ajout.md)). Ajouter au glossaire de `CONTEXT.md` tout terme nouveau. La spec doit être prête à découper en tickets d'implémentation.

AFK : l'agent rédige seul, Romain relit.

## Answer

Rédigée le 2026-10-30 : [spec.md](../spec.md), `Status: ready-for-agent`.

- 17 sections : vue d'ensemble, surfaces, sidebar, formulaire d'ajout, page LinkedIn, lecture, DOM changeant, contrat d'API, architecture, tests, livraison, recette suggérée, arbitrages, exigences, découpage, microcopie, hors périmètre.
- Exigences **ST-90 à ST-125**, en quatre groupes (API ; lecture de LinkedIn et page ; sidebar ; outillage, tests, livraison). ST-90 est le plugin `bearer`.
- **Découpage suggéré** en 10 tickets d'implémentation, avec leurs dépendances (§15).
- **Neuf arbitrages à relire** (§13) : tutoiement partout (09 et 11 vouvoyaient) ; message du `426` qui réunit 06 et 11 ; badge d'un profil par `presence` à une URL ; « Se déconnecter » dans le pied de la sidebar ; aucun réglage (thème du système) ; badge `!` sans session ; WCAG 2.2 AA et axe pour la sidebar ; `console.warn` en anglais ; libellés après l'ajout pour En prospection et Allié.
- **Glossaire** : aucun terme nouveau (`presence` et `linkedin-profile` nomment des endpoints, pas des notions du domaine). Pas d'ADR.

## Comments

- 2026-10-30 : rédigée par un agent seul (AFK), à relire par Romain, en particulier les arbitrages du §13. Pas de commit (Romain commite).
