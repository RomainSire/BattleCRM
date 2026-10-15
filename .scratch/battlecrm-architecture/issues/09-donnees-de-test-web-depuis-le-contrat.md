# 09: Les données de test de la SPA sont construites depuis le contrat

**What to build:** chaque test de la SPA reconstruit à la main ses Contacts du résumé, avec une douzaine de champs, ses lignes modifiées et son bloc de Réglages et de fuseau. Le résumé par défaut du faux client API ne contient ni Positionnements ni Réglages : les valeurs de repli de la SPA servent autant aux tests qu'aux résumés gardés d'une version précédente. Ce ticket fournit des constructeurs typés depuis le contrat du ticket 08 et un résumé par défaut complet, puis fait migrer les tests de la SPA. Une donnée de test périmée ne compile plus. Sources : revue d'architecture du 2026-10-15 (piste 3).

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Des constructeurs typés depuis le contrat produisent un Contact du résumé, une Organisation, un Positionnement, des lignes modifiées et un résumé complet ; un test ne précise que les champs qui le concernent
- [ ] Le résumé par défaut du faux client API est complet et typé par le contrat
- [ ] Les tests de la SPA utilisent ces constructeurs ; plus de constructeur local de lignes modifiées ni de bloc Réglages et fuseau recopié par fichier
- [ ] Les valeurs de repli de la SPA pour un résumé d'une version précédente restent, chacune commentée comme telle, et un test couvre ce cas
- [ ] `pnpm check` vert
