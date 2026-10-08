# 45: Parcours de bout en bout et contrôle d'accessibilité

**What to build:** les parcours principaux tournent en Playwright contre les images construites, dans Firefox et Chromium, et la conformité WCAG 2.2 AA est vérifiée écran par écran, y compris ce qu'un outil automatique ne voit pas. Sources : spec stack §13 ; spec UX §7 ; ST-80.

**Blocked by:** 04, 11, 41, 43

**Status:** ready-for-agent

- [ ] Parcours e2e : 2FA ; Contact → Battle → Interaction → Annuler ; kanban à la souris et au clavier ; hors ligne ; changement de `X-App-Version` ; Aujourd'hui
- [ ] axe bloquant sur chaque écran, dans les deux thèmes (complète ce que chaque ticket a posé)
- [ ] `docs/a11y-checklist.md` : lecteur d'écran, zoom 400 % (reflow, kanban et tableaux qui défilent), focus jamais masqué, cibles ; passée une fois sur chaque écran, écarts corrigés ou consignés dans la spec UX §1 avec leur motif
