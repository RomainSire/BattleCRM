# Contrat d'API : présence et ajout

Type: grilling
Status: resolved
Blocked by: 06, 07

## Question

Quels endpoints et quelles formes de données pour l'extension, dans le cadre de la spec stack §9 ?

- **Présence** : `POST /contacts/lookup-linkedin` (nom à fixer), taille des lots, champs renvoyés (selon ce que montrent le profil et la pastille), Contacts anonymisés (ADR 0006 : URL libérée), Contacts Archivés. Les URL envoyées et comparées passent par `normalizeLinkedInUrl` corrigée (décision de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) : `%xx`, NFC, `/in/<slug>`).
- **Ajout** : `POST /contacts` tel quel, ou un geste propre ? Création d'Organisation dans le même geste ?
- **Ce qu'exige le formulaire** ([Formulaire d'ajout depuis LinkedIn](07-formulaire-d-ajout.md)) : les Contacts du même nom (`normalizeName`) dans la réponse de présence d'un profil qui n'est pas un Contact, `newOrganization` dans l'ajout, `undoToken` en retour, et le cas `linkedin_taken` (renvoyer le Contact existant ?).
- **Listes nécessaires au formulaire** : Organisations avec leur type (rapprochement par nom normalisé et filtre à la frappe), Étapes non archivées : endpoints légers ou parties du résumé ?
- Activation du plugin `bearer` et tests de sécurité générés dans les deux modes : dans ce ticket, ou tâche à part ?

## Answer

Tranché avec Romain le 2026-10-30. Faits relevés dans le code : `POST /contacts` prend déjà `newOrganization`, renvoie l'`undoToken` et refuse `linkedin_url_taken` avec le `contactId` du Contact existant ; `normalizeName` n'existe que pour les Organisations (pas de colonne normalisée sur `contact`) ; un Contact anonymisé n'a plus d'URL (ADR 0006).

1. **Deux lectures, dans le module `views`** :
   - `POST /contacts/presence` (recherche) : corps `{ linkedinUrls: string[] }`, réponse `{ matches: [{ linkedinUrl, contactId, status }] }`, clé = l'URL telle qu'envoyée.
   - `GET /contacts/linkedin-profile?url=…&name=…` (profil) : la carte, ou ce qu'il faut au formulaire (point 4).
   - Le serveur normalise lui-même chaque URL (`normalizeLinkedInUrl` corrigée), sans se fier à l'extension ; une URL invalide est ignorée, pas refusée.
2. **Lots** : 50 URL au plus par appel (`400` au-delà) ; un appel par lecture de la page de recherche, après le debounce.
3. **Archivé** : trouvé comme les autres (badge `✓`, pastille « Archivé », carte avec son État). **Anonymisé** : sans URL, jamais trouvé ; le profil montre `+`.
4. **Réponse du profil, un seul appel à l'ouverture de la sidebar** :
   - Contact trouvé : `{ contact: { id, name, status, stageName, organizationName, jobTitle, lastDoneInteractionOn } }`, noms résolus côté serveur (l'extension ne charge jamais le résumé).
   - Pas un Contact : `{ contact: null, sameName: [{ id, name, organizationName }], organizations: [{ id, name, type }], stages: [{ id, name }] }`, Étapes non archivées dans l'ordre du Funnel. Pas d'endpoint de liste à part.
5. **Date de la carte** : `lastDoneInteractionOn` (dernier échange fait, sortant ou entrant), affichée « Dernier échange : 12 sept. » ou « Aucun échange ». La date de l'ajout ne compte pas.
6. **Contacts du même nom** : `normalizeName(name)` comparé, dans l'API, aux noms des Contacts non anonymisés de l'Utilisateur (Archivés compris), sans nouvelle colonne ; 5 au plus, la dernière Interaction la plus récente d'abord. Sans nom lu (garde-fou du slug), pas de `sameName`.
7. **Ajout** : `POST /contacts` tel quel, aucun geste propre à l'extension, aucun changement de contrat. Après l'ajout ou sur `linkedin_url_taken`, l'extension relit le profil pour montrer la carte. « Annuler » : `POST /gestures/:id/undo` tel quel.
8. **Plugin `bearer`** : première étape de l'implémentation, écrite comme exigence `ST-xx` de la spec (activation, tests de sécurité générés dans les deux modes, points 🔎 de research/18 vérifiés dans Firefox), comme la spec stack §15. Pas de ticket sur la carte.

`X-Client` et `426` (spec stack §9) s'appliquent à ces endpoints comme aux autres.

## Comments

- 2026-10-30 : résolu en une séance de questions avec Romain ; toutes les recommandations acceptées.
