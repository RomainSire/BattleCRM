# 05: Présence sur un profil : badge et élément après le nom

**What to build:** en naviguant sur LinkedIn, l'icône de l'extension porte `✓` sur le profil d'un Contact, `+` sur un autre profil, `!` sans session ou en cas d'erreur d'API, et rien hors d'un profil, y compris après une navigation interne de LinkedIn. Juste après le nom du profil, un élément montre le logo et l'État du Contact (★ pour un Allié), « + Ajouter à BattleCRM » sinon, ou « BattleCRM : se connecter ». Sources : [spec extension](../../battlecrm-extension/spec.md) §2, §5, §6, §8, §13 (A3, A6) ; ST-94, ST-100 (nom et garde-fou), ST-104, ST-105, ST-107.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] `POST /contacts/presence` (module `views`) : `{ linkedinUrls }`, 50 au plus (`400` au-delà), URL normalisées par le serveur, invalides ignorées, réponse `{ matches: [{ linkedinUrl, contactId, status }] }` clé = l'URL envoyée ; Archivé trouvé, anonymisé jamais ; tests contre Postgres (isolation comprise)
- [ ] Lecture du nom sur un `Document` et l'URL : titre de la page (sans « (3) ») confirmé par un `h2` au texte exact ; garde-fou : une `componentkey` se termine par le slug de l'URL ; tests Firefox sur les fixtures anonymisées et leurs cas limites (`h2` retiré, slug changé, compteur dans le titre)
- [ ] Content script sur LinkedIn : changements d'URL repérés (Navigation API), badge de l'onglet recalculé à chaque changement, `pushState` compris (appel `presence` à une URL)
- [ ] Élément posé dans une racine d'ombre, DOM natif, CSS à la main, couleurs selon le fond mesuré, SVG en ligne ; posé une seule fois, seulement quand le nom du bon profil est affiché (10 s au plus), jamais si le `h2` manque ; libellé lisible, jamais la couleur seule ; il n'est pas un bouton
- [ ] Repères textuels de LinkedIn (français) regroupés en un seul endroit
