# 09: Les données de test de la SPA sont construites depuis le contrat

**What to build:** chaque test de la SPA reconstruit à la main ses Contacts du résumé, avec une douzaine de champs, ses lignes modifiées et son bloc de Réglages et de fuseau. Le résumé par défaut du faux client API ne contient ni Positionnements ni Réglages : les valeurs de repli de la SPA servent autant aux tests qu'aux résumés gardés d'une version précédente. Ce ticket fournit des constructeurs typés depuis le contrat du ticket 08 et un résumé par défaut complet, puis fait migrer les tests de la SPA. Une donnée de test périmée ne compile plus. Sources : revue d'architecture du 2026-10-15 (piste 3).

**Blocked by:** 08

**Status:** resolved

- [x] Des constructeurs typés depuis le contrat produisent un Contact du résumé, une Organisation, un Positionnement, des lignes modifiées et un résumé complet ; un test ne précise que les champs qui le concernent
- [x] Le résumé par défaut du faux client API est complet et typé par le contrat
- [x] Les tests de la SPA utilisent ces constructeurs ; plus de constructeur local de lignes modifiées ni de bloc Réglages et fuseau recopié par fichier
- [x] Les valeurs de repli de la SPA pour un résumé d'une version précédente restent, chacune commentée comme telle, et un test couvre ce cas
- [x] `pnpm check` vert

## Comments

**2026-10-16, implémentation (agent).**

- **Constructeurs** (`apps/web/test/summary.ts`) : `contact`, `stage`, `organization`, `positioning`, `settings`, `summary` et `changes`.
  - Typés par le contrat (`satisfies`) et validés par ses schémas stricts (`.parse`) : une donnée périmée ne compile plus, une valeur invalide échoue au test.
  - Chaque champ a une valeur neutre ; les Réglages sont ceux d'un nouvel Utilisateur, tirés des mêmes `DEFAULT_*` que la SPA ; le fuseau par défaut est celui de l'appareil (`DEVICE_TIME_ZONE`).
  - Un id anonyme est tiré au-dessus de `0xf00000`, loin des ids écrits à la main.
- **Faux client API** : `GET /api/summary` répond `summary()`, complet.
  - Conséquence : le résumé porte `locale: 'fr'`, que la SPA applique. Les deux tests en anglais (`app-shell`, `connected-devices`) disent donc que l'Utilisateur parle anglais, dans le résumé.
- **Tests de la SPA** migrés : plus de constructeur local de lignes modifiées, plus de bloc Réglages et fuseau recopié. Un test ne donne que les Réglages qui le concernent.
  - Restent de minces enveloppes locales des constructeurs partagés, avec les défauts propres à leur fichier : `prospect`, `atCapgemini`, le `positioning` de l'atelier.
- **Valeurs de repli** pour un résumé d'une version précédente : chacune est commentée `Fallback:` : `positioningsOf`, `attachmentsOf`, `settingsOf`, et le fuseau.
  - Le fuseau était un repli implicite de `todayOf` (`Intl` sur `undefined`). Il devient `timeZoneOf`, partagé avec les Réglages par défaut.
  - `apps/web/src/summary.test.ts` couvre ces cas par l'app entière : le faux API répond un résumé sans Positionnements, sans Réglages ni fuseau, ou un Positionnement sans pièces jointes.
- **Remarque, hors ticket** : un test peut hériter du résumé que le test précédent a gardé sur l'appareil. L'écriture différée du persisteur peut survenir après le `del` du `beforeEach`. L'atelier abandonne alors un paramètre `positioning` absent de ce résumé. Le test des pièces jointes ouvre donc la fiche par un clic, et non par l'URL.
- Pas de migration. `pnpm check` vert (795 tests).
