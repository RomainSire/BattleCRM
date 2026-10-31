# 02: URL LinkedIn normalisées en entier

**What to build:** une même URL de profil LinkedIn, écrite avec ses accents ou encodée en `%xx`, ou suivie de `/fr`, `/overlay/contact-info` ou `/details/…`, désigne le même Contact. Dans l'app, coller l'URL encodée d'un profil déjà présent signale le doublon. Les URL déjà en base sont re-normalisées. Sources : [spec extension](../../battlecrm-extension/spec.md) §6 ; ST-93 (complète ST-30) ; [Ce que l'extension lit sur LinkedIn](../../battlecrm-extension/issues/04-ce-que-l-extension-scrape.md), décision 7.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `normalizeLinkedInUrl` décode les `%xx`, passe en forme Unicode NFC, et coupe le chemin d'un profil à `/in/<slug>` ; les règles existantes (`https`, `www`, barre finale, paramètres, casse) restent
- [x] Tests du domaine : forme accentuée et forme encodée donnent la même valeur ; sous-pages ramenées au profil ; `%` invalide sans plantage
- [x] Migration qui re-normalise les `linkedin_url` des Contacts existants ; deux Contacts d'un Utilisateur qui tomberaient sur la même URL sont **signalés** (la migration le dit clairement) au lieu d'échouer en silence ou de perdre une donnée
- [x] Migration appliquée à la base de dev

## Comments

**2026-10-31, implémentation.**

- `normalizeLinkedInUrl` (`packages/domain/src/normalize.ts`) décode les `%xx` segment par segment, passe en minuscules puis en NFC, et coupe un profil à `/in/<slug>`. Un segment reste tel quel quand un `%` n'encode rien (ou pas de l'UTF-8) ou quand il encoderait `/`, `?`, `#`, `%`, un espace ou un caractère de contrôle : sinon la valeur normalisée, relue, deviendrait une autre adresse. Un test de propriété vérifie que normaliser deux fois ne change rien.
- Migration `0047_linkedin_url_renormalized` : les mêmes règles en plpgsql, appliquées aux URL écrites par l'ancienne version. Deux Contacts d'un Utilisateur qui tomberaient sur la même URL restent tels quels, et un `WARNING` nomme leurs id, l'Utilisateur et l'URL commune : à fusionner à la main. `runMigrations` affiche maintenant les warnings de Postgres (`pg` les taisait). Test : `apps/api/src/db/linkedin-url-renormalized.test.ts` rejoue la migration et la compare à `normalizeLinkedInUrl`.
- Appliquée à la base de dev : 1 URL, déjà normalisée, aucun doublon.
- Limites connues : `lower()` de Postgres et `toLowerCase()` divergent sur un İ ou un sigma final stockés encodés (jamais dans un slug LinkedIn). Pendant un déploiement, l'ancienne version de l'API normalise encore à l'ancienne : une URL encodée collée à ce moment-là peut passer à côté du doublon.
