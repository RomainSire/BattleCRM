# Organisations

Type: grilling
Status: resolved
Blocked by: 

## Question

L'Organisation d'un Contact a-t-elle un écran propre, ou reste-t-elle un simple attribut affiché sur la fiche et les cartes ? Et comment l'app repère-t-elle les doublons à la saisie d'un Contact (URL LinkedIn, même nom dans la même Organisation) sans ralentir l'ajout rapide, où seul le nom est obligatoire ?

Partir du vocabulaire de `CONTEXT.md` pour Organisation.

## Answer

**Une page Organisation légère, sans entrée de menu.** On l'ouvre en cliquant le nom de l'Organisation (en-tête et « Coordonnées » de la fiche Contact, carte du Funnel, vue table) ou depuis la palette. Elle affiche le nom, le type et la liste de ses Contacts avec leur Étape, leur État et leur prochaine action. C'est là qu'on renomme, qu'on change le type, qu'on fusionne et qu'on supprime. La vue « tous mes Contacts chez X » existe ainsi sans écran « Organisations » dans la navigation ; le filtre Organisation du Funnel reste.

**Changer le type** : une fenêtre de conséquences, dans le style de celles du Funnel (« 4 Contacts passent en Cible ESN. Les Essais déjà commencés gardent leur Cible. »), puis « Changer le type ». Pas de fenêtre si l'Organisation n'a aucun Contact.

**Doublons d'Organisation** : on choisit une Organisation dans une liste qui se filtre au fil de la frappe, sans tenir compte de la casse, des accents ni des espaces. Un nom identique une fois normalisé ne se crée pas une seconde fois : la liste propose l'Organisation existante. Les noms proches (« Capgemini » et « Capgemini Engineering ») ne sont pas détectés, parce qu'il peut s'agir de deux entités distinctes. Pour réparer après coup, **« Fusionner avec… »** sur la page Organisation : on choisit l'Organisation qui reste, et ses Contacts prennent son type, avec la même fenêtre de conséquences.

**Doublons de Contact** (dans l'ajout rapide et dans « Modifier le Contact ») :
- **Même URL LinkedIn** une fois normalisée (`https`, `www`, barre finale et paramètres ignorés) : c'est la même personne, la création est **bloquée**. Message « Ce Contact existe déjà : Jean Dupont · Capgemini », avec « Ouvrir sa fiche ». L'URL LinkedIn est donc unique parmi les Contacts d'un Utilisateur (règle ajoutée à `CONTEXT.md`).
- **Même nom** : une information discrète sous le champ, non bloquante. Elle se fait plus précise quand l'Organisation est la même : « Il y a déjà un Jean Dupont chez Capgemini ».
- La vérification se fait **pendant la frappe**, jamais dans une fenêtre après `Entrée` : l'ajout rapide n'est jamais ralenti.

**Un Contact change d'Organisation** : simple modification du champ, sans Interaction enregistrée (ce n'est pas un échange avec le Contact). Sa Cible change ; l'Essai en cours garde sa Cible de départ.

**Supprimer une Organisation** : seulement si aucun Contact n'y est rattaché ; sinon on fusionne, ou on change l'Organisation de chaque Contact. Une Organisation qui n'a plus de Contacts n'est pas supprimée automatiquement et reste proposée dans la liste.

**Mobile** : la page Organisation est consultable en lecture (on y arrive en touchant le nom sur la fiche Contact, et sa liste de Contacts est cliquable). Renommer, changer le type et fusionner se font sur ordinateur seulement.

**Exigences pour la stack** : unicité du nom d'Organisation (normalisé) et de l'URL LinkedIn (normalisée) par Utilisateur ; vérification des doublons pendant la frappe, sans ralentir la saisie ; fusion d'Organisations.
