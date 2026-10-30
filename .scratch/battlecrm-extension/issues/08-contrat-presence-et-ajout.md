# Contrat d'API : présence et ajout

Type: grilling
Status: open
Blocked by: 06, 07

## Question

Quels endpoints et quelles formes de données pour l'extension, dans le cadre de la spec stack §9 ?

- **Présence** : `POST /contacts/lookup-linkedin` (nom à fixer), taille des lots, champs renvoyés (selon ce que montrent le profil et la pastille), Contacts anonymisés (ADR 0006 : URL libérée), Contacts Archivés. Les URL envoyées et comparées passent par `normalizeLinkedInUrl` corrigée (décision de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) : `%xx`, NFC, `/in/<slug>`).
- **Ajout** : `POST /contacts` tel quel, ou un geste propre ? Création d'Organisation dans le même geste ?
- **Ce qu'exige le formulaire** ([Formulaire d'ajout depuis LinkedIn](07-formulaire-d-ajout.md)) : les Contacts du même nom (`normalizeName`) dans la réponse de présence d'un profil qui n'est pas un Contact, `newOrganization` dans l'ajout, `undoToken` en retour, et le cas `linkedin_taken` (renvoyer le Contact existant ?).
- **Listes nécessaires au formulaire** : Organisations avec leur type (rapprochement par nom normalisé et filtre à la frappe), Étapes non archivées : endpoints légers ou parties du résumé ?
- Activation du plugin `bearer` et tests de sécurité générés dans les deux modes : dans ce ticket, ou tâche à part ?
