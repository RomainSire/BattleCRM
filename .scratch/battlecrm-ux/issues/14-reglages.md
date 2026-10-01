# Réglages

Type: grilling
Status: resolved
Blocked by: 

## Question

Que contiennent les Réglages et comment s'édite le Funnel, avec ses garde-fous ?

À trancher :
- **Édition du Funnel** : ajout, renommage, réordonnancement, archivage et restauration d'Étapes. Les garde-fous : une Étape qui porte des Contacts, une Battle ouverte, des Positionnements ; l'effet d'un réordonnancement sur le Taux de passage (calculé sur l'ordre du Funnel en vigueur à chaque changement d'Étape).
- Les autres réglages : Objectif d'activité, interrupteur « Célébrer l'Objectif atteint », Cadence par défaut, langue, thème (Système / Clair / Sombre).
- Le découpage de l'écran (sections, un seul écran ou plusieurs) ; sur mobile, seuls les réglages simples (langue, thème, célébration) sont présents (ticket « Parcours mobile »).

## Answer

**Découpage.** Un seul écran « Réglages », avec une colonne d'ancres à gauche et quatre sections : **Funnel**, **Prospection** (Objectif d'activité, célébration, Cadence par défaut), **Préférences** (langue, thème, fuseau horaire) et **Compte**. Le Funnel ne s'édite qu'ici. Dans la vue Funnel, le menu d'en-tête d'une colonne propose seulement « Renommer » et « Gérer les Étapes… », qui ouvre la section Funnel.

**Enregistrement.** Automatique, champ par champ, avec un toast et « Annuler ». Seule exception : la Cadence par défaut, qui s'édite comme un bloc et s'enregistre par un bouton « Enregistrer », pour ne pas sauvegarder une suite à moitié saisie.

**Éditeur de Funnel.**
- Une liste ordonnée. Chaque ligne porte une poignée de glissement (et `Alt+↑/↓` au clavier), le **nom** et le **But** (facultatif, voir `CONTEXT.md`), tous deux modifiables sur place, des compteurs discrets (Contacts actifs ou en pause, Positionnements, Battle ouverte) et un menu « … ».
- « + Ajouter une Étape » en bas ; insertion entre deux lignes au survol.
- Les Étapes archivées sont repliées sous « Étapes archivées (n) », avec « Restaurer ». Une Étape restaurée reprend sa place d'avant, juste après l'Étape qui la précédait si celle-ci est encore dans le Funnel, sinon en fin de Funnel. On peut la déplacer ensuite.
- **Archiver** est grisé tant que l'Étape a des Contacts actifs ou en pause, ou une Battle ouverte. La raison s'affiche avec un lien : « 3 Contacts actifs : voir dans le Funnel » ou « Battle ouverte : voir la Battle ». Il n'y a **pas de déplacement en masse**, qui fausserait l'historique et le Taux de passage et obligerait à régler les Essais. Quand l'archivage est possible, une confirmation récapitule ses effets : l'Étape sort du Funnel ; ses Positionnements, ses Battles et son Historique des Champions restent consultables ; les Contacts clos ou gagnés la gardent comme dernière Étape atteinte.
- **Supprimer** remplace « Archiver » quand l'Étape n'a jamais servi (aucun Contact passé par elle, aucun Positionnement, aucune Battle). Pas de confirmation, seulement « Annuler » dans le toast.
- **Réordonner** ne demande pas de confirmation. Une phrase permanente sous la liste rappelle : « Réordonner ne déplace aucun Contact ; l'historique garde l'ordre d'alors. »

**But de l'Étape.** C'est un champ facultatif, distinct du nom : ce qui fait franchir l'Étape. On a écarté « Objectif », réservé à l'Objectif d'activité. Il s'affiche en sous-titre sous le nom de la colonne du kanban et à côté de l'Étape sur la fiche Contact (« Qualif ESN · entretien ESN à obtenir »). À l'ouverture d'une Battle, il pré-remplit le Critère de succès quand l'Étape n'a pas encore eu de Battle (sinon, on reprend le Critère de la Battle précédente, comme tranché dans « Écran Battle et Historique des Champions »). Le Critère reste modifiable, puis figé : modifier le But ne touche aucune Battle.

**Étapes types.** Elles sont créées une fois, à l'inscription, dans la langue choisie, puis ne sont jamais traduites : changer de langue ne renomme pas les Étapes.

| FR | But | EN | Aim |
|---|---|---|---|
| Vivier | à contacter | Pool | to reach out |
| Approche | CV à envoyer | Outreach | get asked for a CV |
| Qualif ESN | entretien ESN à obtenir | Agency screening | get the agency interview |
| Qualif Client | entretien client à obtenir | Client screening | get the client interview |
| Closing | contrat à signer | Closing | sign the contract |

On a retenu « Vivier » plutôt que « Prospect », un terme à éviter dans le glossaire (il désignerait un Contact). Le Vivier n'a pas de Positionnement : le premier message se teste à l'Approche, le CV à la Qualif ESN, l'entretien ESN à la Qualif Client, l'entretien client (et les éventuels tests techniques) au Closing.

**Étape sans Positionnement.** Un Contact actif dans une Étape qui n'a **aucun Positionnement** ne compte pas comme « sans prochaine action » : il n'apparaît pas dans « Aujourd'hui », et le kanban le range dans « En attente », sans signal. La règle se déduit des données et s'arrête d'elle-même dès qu'on crée un Positionnement à cette Étape. Elle évite qu'un Vivier de dizaines de Contacts noie le bloc. Cela précise les tickets « Écran Aujourd'hui » et « Vue Funnel : kanban et table ».

**Prospection.**
- **Objectif d'activité** : champ numérique (1 par défaut) et interrupteur pour le désactiver ; sous le champ, « S'applique à partir de demain. »
- **Célébrer l'Objectif atteint** : juste en dessous, indépendant, grisé (pas masqué) quand l'Objectif est désactivé.
- **Cadence par défaut** : les intervalles et le Délai de réponse (+3, +7, +14 j, puis 14 j par défaut), avec la même ligne par rang que le formulaire Positionnement, **sans messages**. Elle ne sert qu'à pré-remplir un nouveau Positionnement qui n'est dérivé d'aucun autre ; la section rappelle que la modifier ne touche aucun Positionnement existant.

**Préférences.**
- Langue : par Utilisateur.
- Fuseau horaire : par Utilisateur. Il est détecté à l'inscription et modifiable, et un changement s'applique à partir du lendemain, sans recompter les jours passés.
- Thème (Système / Clair / Sombre) : par appareil.
- « Réduire les animations » : pas de réglage dans l'app, on suit celui du système.

**Compte.** L'e-mail, le changement de mot de passe et la déconnexion. Le détail relève du ticket « Parcours d'authentification ». Pas d'export de données ni de suppression de compte en V1.

**Mobile.** Sous « Plus » : langue, thème, célébration et Compte (avec la déconnexion). Funnel, Objectif, Cadence par défaut et fuseau horaire restent sur ordinateur.

**Glossaire.** Ajout de **But** (EN *Aim*) et de **Cadence par défaut** ; l'entrée Étape précise ce que veut dire « a servi ».

**Exigences pour la stack** :
- conserver le thème par appareil ;
- conserver la langue et le fuseau horaire par Utilisateur, et le fuseau en vigueur de chaque jour pour l'Activité ;
- créer les Étapes types dans la langue de l'inscription ;
- savoir si une Étape a servi ;
- annuler juste après coup un enregistrement automatique ou une suppression d'Étape.
