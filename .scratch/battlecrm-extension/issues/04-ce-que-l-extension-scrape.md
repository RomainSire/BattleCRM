# Ce que l'extension lit sur LinkedIn

Type: grilling
Status: resolved
Blocked by: 03

## Question

Sur les pages de référence de `.private/linkedin/`, quels champs l'extension lit-elle, et avec quelle règle quand elle n'est pas sûre ?

- Profil : nom (et découpage ou non), poste (titre de l'expérience en cours ou headline ?), Organisation (expérience en cours, topcard, école ?), URL canonique. Faut-il aussi lire un indice de la Cible (ESN ou client final) ?
- Recherche : ce qui identifie chaque résultat, où se trouve son URL, et ce qui permet d'y accrocher une pastille.
- Règle d'incertitude (le POC : « jamais de mauvaise valeur, plutôt vide »).
- Ce qu'on garde des techniques du POC (`componentkey`, structure, Navigation API + MutationObserver, debounce) et ce qu'on change.
- Normalisation de l'URL : celle de `packages/domain` couvre-t-elle les URL lues (`/in/<slug>`, slugs encodés, URL `/in/ACoAA…` des résultats de recherche) ?

## Answer

Tranché avec Romain le 2026-10-30, à partir des copies de l'inspecteur de `.private/linkedin/` (aucun contenu de ces pages ici).

### Ce que montrent les pages de référence

- Les clés `componentkey` du POC existent toujours, mais sur des `div`, plus des `section` : les sélecteurs `section[componentkey*=…]` du POC ne trouvent plus rien. Le haut du profil porte `profileCardsAboveActivityTopcardOnly<slug>`, l'expérience `Profile_Top_Level_ExperienceTopLevelSection<slug>` : **le slug du profil est dans la clé**, écrit avec ses accents.
- Haut du profil : le nom dans un `h2`, puis le degré (`· 1er`, `· 2e`, `· 3e`), le titre (headline), une ligne « Organisation · école », le lieu, « Coordonnées », puis des boutons « Organisation » et « école ». Profil sans expérience : ni la ligne ni les boutons.
- Expérience : des éléments `entity-collection-item-…`, le premier est le poste en cours (dates « … - aujourd’hui »). Un seul poste dans une Organisation : titre, puis « Organisation · CDI ». Plusieurs postes dans la même Organisation : l'Organisation d'abord, puis les postes. Le lien `/company/<id>/` de l'élément porte l'Organisation.
- Fenêtre « Coordonnées » ouverte : e-mail en lien `mailto:`, téléphone en texte avec son type (« … (Mobile) »), plus adresse, anniversaire et date de connexion.
- Recherche : chaque résultat est un `role="listitem"` ; ses premiers liens `/in/` pointent tous vers le résultat, celui qui a du texte est le nom ; les liens `/in/` suivants sont des relations en commun. `SearchResultssnippet_ACoAA…` n'est que la ligne « Poste actuel : … », pas la carte. Liens `/in/` lisibles, parfois encodés en `%xx`.
- `normalizeLinkedInUrl` de `packages/domain` (vérifié à l'exécution) : la forme encodée et la forme accentuée d'un même profil donnent deux valeurs différentes, et `/in/<slug>/fr`, `/in/<slug>/overlay/contact-info`, `/in/<slug>/details/…` ne sont pas ramenés au profil.

### Décisions

1. **Nom** : le `h2` du haut du profil, tel quel, sans découpage (le Contact n'a qu'un `name`). « Faïza B. » reste « Faïza B. ».
2. **Poste** (`jobTitle`) : le titre de l'expérience en cours ; à défaut d'expérience en cours, le headline.
3. **Organisation** : le nom porté par le lien `/company/` du premier élément d'Expérience, **seulement s'il est en cours**, sans le type de contrat (« · CDI », « · Stage »…). Sinon vide. Jamais l'école, jamais la ligne ni les boutons du haut du profil.
4. **Coordonnées** : e-mail et téléphone lus **seulement si la fenêtre « Coordonnées » est déjà ouverte** ; l'extension ne l'ouvre jamais et ne charge pas `…/overlay/contact-info/`. Téléphone sans son type ; ni adresse ni anniversaire.
5. **Pas d'indice de Cible** : le type de l'Organisation se demande à sa création (formulaire d'ajout).
6. **Règle d'incertitude** : « jamais de mauvaise valeur, plutôt vide », champ par champ. Garde-fou : le haut du profil n'est lu que si le slug de sa clé `componentkey` est celui de l'URL (comparés après normalisation) ; sinon le DOM est peut-être celui du profil précédent pendant une navigation interne, et rien n'est pré-rempli.
7. **Normalisation de l'URL, corrigée dans `packages/domain`** : décoder les `%xx`, forme Unicode NFC, et pour un profil couper le chemin à `/in/<slug>`. Une migration re-normalise les `contact.linkedin_url` existants et signale les Contacts qui tomberaient sur la même URL au lieu d'échouer en silence. ST-30 se complète d'autant. C'est une exigence de la spec de l'extension (travail d'implémentation, pas fait ici).
8. **Recherche** : un résultat est identifié par son URL `/in/` normalisée (pas par l'identifiant `ACoAA…`, que l'API ne connaît pas) ; la pastille s'accroche au lien du nom ; ni titre ni « Poste actuel » ne sont lus (pas d'ajout depuis la recherche).
9. **Techniques** : gardées : `componentkey` par sous-chaîne sur n'importe quel élément, la structure en secours, Navigation API + MutationObserver avec debounce pour la recherche, lecture du profil à la demande (à l'ouverture de la surface), jamais en continu. Abandonnées : les secours « ancien LinkedIn » (classes `.text-body-medium`, `h1`, `aria-label` « Inviter… »).
10. **Langue** : LinkedIn en français seulement ; les repères textuels (« aujourd’hui », « Coordonnées », types de contrat) sont regroupés en un seul endroit. Dans une autre langue, les champs qui en dépendent restent vides (règle 6).
