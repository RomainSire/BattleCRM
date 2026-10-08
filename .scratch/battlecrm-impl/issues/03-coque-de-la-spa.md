# 03: Coque de la SPA

**What to build:** la SPA React s'ouvre en FR ou EN, dans le thème Système / Clair / Sombre, avec la navigation de bureau (barre latérale) et de mobile (onglets en bas) menant à des écrans vides pour chaque entrée. Les jetons de couleur et les composants de base sont en place pour toutes les tranches suivantes. Sources : spec UX §1, §2, §3.1, §3.2, §7 ; spec stack §3.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Vite + React 19, TanStack Router (paramètres de recherche typés par Zod), TanStack Query (rejeu des mutations désactivé), client `hc<AppType>` branché sur l'API
- [ ] `packages/i18n` : un projet Paraglide FR/EN ; `lang` de la page posé depuis la langue courante
- [ ] `packages/theme` : jetons de la spec UX §2 (accent, succès, retard, bientôt, neutre) dans les deux thèmes, base Zinc, aucun rouge ni `--destructive` ; focus par un utilitaire unique sur `data-focus-visible`
- [ ] Fournisseur de thème maison : Système / Clair / Sombre par appareil (`localStorage`, lu sans planter s'il est indisponible), suit `prefers-color-scheme` en direct
- [ ] Composants shadcn base `aria` éjectés (Dialog, Combobox, Table, champs) ; aucun paquet banni
- [ ] Bureau : barre latérale de la spec UX §3.1 (marque, Rechercher…, + Ajouter, groupes Prospection et Expérimentation, Réglages, Raccourcis, compte) ; mobile : onglets Aujourd'hui, Contacts, Funnel, Plus ; bascule par la largeur seule (ST-02)
- [ ] Lien « Aller au contenu », régions repères ; cibles 24 px / 44 px
- [ ] Logo recoloré en dégradé teal `#115e59` → `#0d9488`
- [ ] Tests web en mode navigateur avec axe bloquant sur la coque, dans les deux thèmes
