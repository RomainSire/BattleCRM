# Stratégie de test

Type: grilling
Status: open
Blocked by: 09

## Question

Comment l'app est-elle testée, à quels niveaux et avec quels outils ?

À trancher :
- Niveaux et frontières : tests unitaires de `packages/domain` (Règle de victoire exacte, choix du Tirage, états du jour, jour local, normalisation) ; tests des gestes par leur endpoint contre un vrai Postgres (RLS forcée, `withUser`, index partiels, inverses d'« Annuler » de l'ADR 0011) ; tests de bout en bout du navigateur (lesquels, combien).
- Outils : lanceur (Vitest…), base de test (conteneur jetable, une base par fichier ou par transaction annulée), bout en bout (Playwright…), en local et en CI.
- Tests de sécurité exigés par « [Auth : bibliothèque, sessions et client extension](08-auth.md) » (`trustDevice` forcé à faux, liste blanche) et par l'ADR 0009 (un Utilisateur ne voit jamais les lignes d'un autre, même si le filtre est oublié).
- Contrôle automatique d'accessibilité (ST-80) : outil, écrans couverts, bloquant en CI ou non ; ce qui reste manuel (lecteur d'écran, zoom 400 %).
- Temps et hasard injectés (horloge, fuseau, `random`) pour tester valeurs en vigueur, Cadence et Tirage sans attendre.

- Outillage tranché par « [Outillage du monorepo](13-outillage-monorepo.md) » : TypeScript 7, Oxlint, scripts pnpm, `pnpm check` qui lance les tests, CI `ci` bloquante.

- E-mails (« [E-mails transactionnels traduits](14-e-mails.md) ») : aucun test n'envoie d'e-mail ; un faux `EmailTransport` enregistre les envois pour vérifier contenu, langue et liens (vérification, réinitialisation…).

Entrées : « [Architecture : où vivent les règles du domaine](09-architecture.md) », « [Base de données et accès aux données](07-donnees.md) ».
