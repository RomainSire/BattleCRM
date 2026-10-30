# Contrat d'API : présence et ajout

Type: grilling
Status: open
Blocked by: 06, 07

## Question

Quels endpoints et quelles formes de données pour l'extension, dans le cadre de la spec stack §9 ?

- **Présence** : `POST /contacts/lookup-linkedin` (nom à fixer), taille des lots, champs renvoyés (selon ce que montrent le profil et la pastille), Contacts anonymisés (ADR 0006 : URL libérée), Contacts Archivés. Les URL envoyées et comparées passent par `normalizeLinkedInUrl` corrigée (décision de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) : `%xx`, NFC, `/in/<slug>`).
- **Ajout** : `POST /contacts` tel quel, ou un geste propre ? Création d'Organisation dans le même geste ?
- **Listes nécessaires au formulaire** : Organisations (pour le filtre à la frappe), Étapes non archivées : endpoints légers ou parties du résumé ?
- Activation du plugin `bearer` et tests de sécurité générés dans les deux modes : dans ce ticket, ou tâche à part ?
