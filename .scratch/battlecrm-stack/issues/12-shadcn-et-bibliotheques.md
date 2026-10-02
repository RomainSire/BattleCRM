# shadcn/ui face aux bibliothèques headless

Type: research
Status: open
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
