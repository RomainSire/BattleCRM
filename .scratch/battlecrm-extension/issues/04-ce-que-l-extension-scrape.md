# Ce que l'extension lit sur LinkedIn

Type: grilling
Status: open
Blocked by: 03

## Question

Sur les pages de référence de `.private/linkedin/`, quels champs l'extension lit-elle, et avec quelle règle quand elle n'est pas sûre ?

- Profil : nom (et découpage ou non), poste (titre de l'expérience en cours ou headline ?), Organisation (expérience en cours, topcard, école ?), URL canonique. Faut-il aussi lire un indice de la Cible (ESN ou client final) ?
- Recherche : ce qui identifie chaque résultat, où se trouve son URL, et ce qui permet d'y accrocher une pastille.
- Règle d'incertitude (le POC : « jamais de mauvaise valeur, plutôt vide »).
- Ce qu'on garde des techniques du POC (`componentkey`, structure, Navigation API + MutationObserver, debounce) et ce qu'on change.
- Normalisation de l'URL : celle de `packages/domain` couvre-t-elle les URL lues (`/in/<slug>`, slugs encodés, URL `/in/ACoAA…` des résultats de recherche) ?
