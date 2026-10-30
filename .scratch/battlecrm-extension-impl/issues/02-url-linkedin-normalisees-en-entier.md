# 02: URL LinkedIn normalisées en entier

**What to build:** une même URL de profil LinkedIn, écrite avec ses accents ou encodée en `%xx`, ou suivie de `/fr`, `/overlay/contact-info` ou `/details/…`, désigne le même Contact. Dans l'app, coller l'URL encodée d'un profil déjà présent signale le doublon. Les URL déjà en base sont re-normalisées. Sources : [spec extension](../../battlecrm-extension/spec.md) §6 ; ST-93 (complète ST-30) ; [Ce que l'extension lit sur LinkedIn](../../battlecrm-extension/issues/04-ce-que-l-extension-scrape.md), décision 7.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `normalizeLinkedInUrl` décode les `%xx`, passe en forme Unicode NFC, et coupe le chemin d'un profil à `/in/<slug>` ; les règles existantes (`https`, `www`, barre finale, paramètres, casse) restent
- [ ] Tests du domaine : forme accentuée et forme encodée donnent la même valeur ; sous-pages ramenées au profil ; `%` invalide sans plantage
- [ ] Migration qui re-normalise les `linkedin_url` des Contacts existants ; deux Contacts d'un Utilisateur qui tomberaient sur la même URL sont **signalés** (la migration le dit clairement) au lieu d'échouer en silence ou de perdre une donnée
- [ ] Migration appliquée à la base de dev
