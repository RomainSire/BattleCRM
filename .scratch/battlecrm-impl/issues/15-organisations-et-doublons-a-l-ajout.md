# 15: Organisations et doublons à l'ajout

**What to build:** dans l'ajout rapide, l'Utilisateur choisit une Organisation dans une liste filtrée à la frappe ou la crée avec son type, saisit l'URL LinkedIn, et voit pendant la frappe si le Contact existe déjà : même URL LinkedIn → ajout bloqué avec « Ouvrir sa fiche » ; même nom, e-mail ou téléphone → simple information. « Plus de champs » déplie poste, e-mail, téléphone et note. Sources : spec UX §6.8 ; CONTEXT (Contact, Organisation, Cible) ; spec stack §5.3 ; ST-30, ST-63, ST-64.

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] Normalisation dans `packages/domain` (nom d'Organisation : casse, accents, espaces ; URL LinkedIn : `https`, `www`, barre finale, paramètres), testée par fast-check
- [ ] Module `organizations` : nom, type (ESN ou client final), colonne normalisée sous index unique par Utilisateur ; Contact rattaché à 0 ou 1 Organisation, Cible déduite (ESN, client final, inconnue)
- [ ] URL LinkedIn normalisée sous index unique par Utilisateur : l'index tranche au serveur
- [ ] Vérification des doublons sur le résumé, sans aller-retour ni ralentissement de la saisie, jamais après `Entrée` ; message « Ce Contact existe déjà : Jean Dupont · Capgemini »
- [ ] Le résumé porte les Organisations et les champs utiles à la recherche et aux doublons
