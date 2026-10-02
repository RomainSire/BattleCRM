# shadcn/ui face aux bibliothèques headless

Type: research
Status: resolved
Blocked by:

## Question

Pour l'interface React de BattleCRM, faut-il partir de **shadcn/ui** (composants copiés dans le dépôt, stylés Tailwind, sur Base UI par défaut), d'une couche équivalente sur **React Aria Components**, ou d'une bibliothèque headless (React Aria ou Base UI) **stylée à la main** ? « Candidats front » n'a cité shadcn/ui que comme source d'exemples au-dessus de Base UI, sans la comparer.

À couvrir :
- **shadcn/ui aujourd'hui** : modèle (CLI, registre, composants possédés), base Base UI ou Radix, Tailwind 4, thèmes par variables CSS ; maintenance des composants copiés (mises à jour, dérive), qualité d'accessibilité réelle des composants (et non de la seule primitive), composants disponibles pour nos besoins : palette (Command), Toast/Sonner (ST-62 : 10 s, pause au survol et au focus), panneau latéral non modal (Sheet, ST-66), feuille plein écran mobile (Drawer), tableau, kanban et glisser-déposer (ST-61).
- **Couches équivalentes sur React Aria** : starters Tailwind d'Adobe, JollyUI, Intent UI ou autres ; maturité, maintenance, couverture des mêmes composants.
- **Stylé à la main** : coût pour un agent de partir des primitives nues.
- **Direction visuelle** (spec UX §2) : sobre et dense, gris-zinc, accent teal, succès en vert franc, retards en ambre, jamais de rouge ; couleurs en jetons (ST-68), contraste AA dans les deux thèmes, thème qui suit le système (ST-52) ; ce que chaque option impose ou facilite.
- **Agents** : volume d'exemples, documentation lisible par les LLM (`llms.txt`, MCP, registre shadcn), risque de mélanger les conventions.
- Mélanges possibles (shadcn pour la plupart des composants, React Aria pour le glisser-déposer) et leur coût.

Livrable : `.scratch/battlecrm-stack/research/12-shadcn-et-bibliotheques.md`, avec sources primaires et une recommandation.

## Comments

- Recherche disponible sur la branche `research/12-shadcn-et-bibliotheques`, fichier `.scratch/battlecrm-stack/research/12-shadcn-et-bibliotheques.md` (`git show research/12-shadcn-et-bibliotheques:.scratch/battlecrm-stack/research/12-shadcn-et-bibliotheques.md`).

## Answer

Détail et sources : la recherche ci-dessus. Faits établis, sur lesquels s'appuiera « Forme de l'app et langages » :

- **Le dilemme disparaît** : depuis le 2026-07-17, shadcn/ui propose **React Aria comme base officielle** (`init --base aria`), à côté de Base UI (par défaut) et de Radix.
- **Recommandation : shadcn en base `aria`, puis `shadcn eject`** : un point de départ que l'on possède et taille, pas une dépendance que l'on suit. Gardés : palette (Autocomplete à focus virtuel), Table, Dialog, Combobox, champs. En base Base UI, la Command repose sur cmdk, sans version depuis mars 2025.
- **Remplacés** : le toast (Sonner ne met pas en pause son minuteur au focus clavier, vérifié dans le code : ST-62 non tenu) par un toast maison d'environ 100 lignes sur `UNSTABLE_Toast` de React Aria ; le Drawer (qui importe Base UI) par le Sheet React Aria plein écran par le bas, pour une seule bibliothèque de primitives.
- **À écrire** : le panneau non modal (une région de la mise en page, ST-66), le kanban et le réordonnancement des Étapes depuis l'exemple Kanban d'Adobe (GridList + useDragAndDrop, ST-61), un fournisseur de thème qui suit le système en direct (ST-52).
- **Thème** : jetons de la spec UX §2, base Zinc, suppression de `--destructive` et des variantes rouges ; focus par un utilitaire unique sur `data-focus-visible` (défauts ouverts chez shadcn sur focus, contraste, libellés) ; libellés anglais codés en dur à traduire.
- **Agents** : convention la plus répandue, la Skill shadcn connaît la base `aria`. Règle à poser : une seule base ; `@base-ui/react`, radix, cmdk, vaul, sonner, next-themes interdits.
- **Deuxième choix** : le kit Tailwind d'Adobe (mêmes primitives, moins d'exemples). **Écartés** : mélange Base UI + React Aria, JollyUI (inactif), Intent UI (une personne, Sonner), primitives nues.
- **Coût** : ~146 kB gzip de JS en base `aria` contre ~105 kB pour Base UI, côté client. **Repli** si un spike échoue : shadcn base Base UI, Toast tel quel, sans glisser-déposer au clavier.
