# 15: Organisations et doublons à l'ajout

**What to build:** dans l'ajout rapide, l'Utilisateur choisit une Organisation dans une liste filtrée à la frappe ou la crée avec son type, saisit l'URL LinkedIn, et voit pendant la frappe si le Contact existe déjà : même URL LinkedIn → ajout bloqué avec « Ouvrir sa fiche » ; même nom, e-mail ou téléphone → simple information. « Plus de champs » déplie poste, e-mail, téléphone et note. Sources : spec UX §6.8 ; CONTEXT (Contact, Organisation, Cible) ; spec stack §5.3 ; ST-30, ST-63, ST-64.

**Blocked by:** 13

**Status:** resolved

- [x] Normalisation dans `packages/domain` (nom d'Organisation : casse, accents, espaces ; URL LinkedIn : `https`, `www`, barre finale, paramètres), testée par fast-check
- [x] Module `organizations` : nom, type (ESN ou client final), colonne normalisée sous index unique par Utilisateur ; Contact rattaché à 0 ou 1 Organisation, Cible déduite (ESN, client final, inconnue)
- [x] URL LinkedIn normalisée sous index unique par Utilisateur : l'index tranche au serveur
- [x] Vérification des doublons sur le résumé, sans aller-retour ni ralentissement de la saisie, jamais après `Entrée` ; message « Ce Contact existe déjà : Jean Dupont · Capgemini »
- [x] Le résumé porte les Organisations et les champs utiles à la recherche et aux doublons

## Comments

**2026-10-14, implémentation (agent).**

- **`packages/domain`** : `normalizeName` (casse, accents, espaces), `normalizeLinkedInUrl` (schéma, `www` et sous-domaine de pays, casse, barres finales, paramètres, fragment ; `null` hors de `linkedin.com`), `normalizeEmail`, `normalizePhone`, testées par fast-check ; `organizationsMatching`, `findDuplicates` (profil LinkedIn bloquant ; nom, la même Organisation d'abord, e-mail, téléphone informatifs ; jamais soi-même, pour le ticket 17) ; `targetOf`. fast-check en dépendance de dev ; les tests du paquet ont le droit d'importer `vitest` et `fast-check` (`.oxlintrc.json`).
- **Module `organizations`** : table `organization` (`name`, `normalized_name` sous index unique par Utilisateur, `type` `consultancy` ou `end_client`) ; exporte `createOrganization` (`null` si le nom est pris), `isOrganizationOf`, `deleteOrganization`. La Cible n'est pas stockée : elle se déduit du type de l'Organisation dans le résumé (`targetOf`), elle servira à l'affichage (ticket 16) et aux Essais.
- **Contact** : `organization_id`, `job_title`, `email`, `phone`, `linkedin_url` (stockée normalisée, index unique `(user_id, linkedin_url)`), `note`. Migrations `0015` (RLS de `contact` non forcée le temps de valider la clé étrangère, comme `0013`) et `0016` (accès, RLS), appliquées à la base de dev.
- **`POST /api/contacts`** accepte en plus `organizationId` ou `newOrganization { name, type }`, `linkedinUrl`, `jobTitle`, `email`, `phone`, `note` (blancs = absents). Refus : 400 `unknown_organization`, 409 `organization_taken`, 409 `linkedin_url_taken` avec le `contactId` (l'index tranche, la transaction est annulée, Organisation créée comprise). « Annuler » supprime l'Organisation créée par l'ajout, sauf si un autre Contact l'a rejointe entre-temps (ADR 0011). Un ancien client qui n'envoie que le nom fonctionne toujours.
- **Résumé** : les Contacts portent `organizationId`, `jobTitle`, `email`, `phone`, `linkedinUrl` (pas la note) ; le résumé et les réponses des gestes portent `organizations` et `removedOrganizationIds`.
- **SPA** : champ Organisation (`contacts/organization-field.tsx`, ComboBox de React Aria, réutilisable au ticket 17) ; un nom tapé en entier désigne l'Organisation existante ; sinon le type est demandé (obligatoire). Doublons vérifiés sur le résumé pendant la frappe (`useDeferredValue`) : profil LinkedIn bloquant avec « Ouvrir sa fiche », nom/e-mail/téléphone en note discrète. « Plus de champs ». En attendant la fiche (ticket 16), « Ouvrir sa fiche » mène à `/contacts?contact=<id>` et marque la ligne.
- **Laissé aux tickets suivants** : la fusion d'Organisations en double et leur page (ticket 18) ; l'affichage de l'Organisation et de la Cible dans la liste et la fiche (ticket 16).
