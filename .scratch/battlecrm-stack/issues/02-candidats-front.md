# Candidats front

Type: research
Status: resolved
Blocked by:

## Question

Quels frameworks front (et bibliothèques associées) couvrent le mieux les exigences d'interface de la spec UX, au regard des critères de la carte ?

À couvrir :
- Candidats : React, Vue, Svelte/SvelteKit, Solid, Angular ; SPA pure ou rendu serveur (et ce que chacun change pour une app derrière connexion).
- Composants accessibles headless (WCAG 2.2 AA) : piège et retour du focus, panneau non modal (ST-66), régions live (ST-67), palette de commandes, glisser-déposer souris avec alternative clavier (ST-61), raccourcis en séquence hors champs de saisie (ST-65), « Annuler » temporisé (ST-62).
- i18n FR/EN dès le départ, attribut `lang` (ST-05) ; thème par jetons clair/sombre (ST-52, ST-68) ; réduire les animations (ST-69).
- PWA installable (ST-01) et **hors-ligne en consultation seulement** (ST-03, ST-04, ADR 0004) : service worker, copie locale, effacement à la déconnexion ; conservation de l'état d'un panneau au retour dans l'app (ST-70).
- Fluidité : recherche instantanée pendant la frappe (ST-63, ST-64), cache et mises à jour optimistes ou non.
- Lisibilité par les agents et stabilité de l'écosystème.

Livrable : `.scratch/battlecrm-stack/research/02-candidats-front.md`, avec sources primaires et un classement argumenté (3 finalistes au plus).

## Comments

- Recherche disponible sur la branche `research/02-candidats-front`, fichier `.scratch/battlecrm-stack/research/02-candidats-front.md` (`git show research/02-candidats-front:.scratch/battlecrm-stack/research/02-candidats-front.md`).

## Answer

Détail et sources : la recherche ci-dessus (versions relevées le 2026-10-02). Faits établis, sur lesquels s'appuiera « Forme de l'app et langages » :

- **Forme : SPA Vite + API séparée.** Le rendu serveur n'apporte rien derrière connexion, ajoute un runtime, gêne la coque hors ligne (et les React Server Components ont eu une RCE critique en décembre 2025). La même API sert l'extension Firefox.
- **Finaliste 1 : React 19.3 + React Aria Components** (palette via Autocomplete, glisser-déposer avec parcours clavier, modaux, toasts navigables), TanStack Router + TanStack Query, Paraglide (messages typés), vite-plugin-pwa, tinykeys. Meilleur outillage pour agents (`llms.txt`, MCP).
- **Finaliste 2 : le même squelette avec Base UI** (stable, défaut de shadcn/ui) : Toast stable, mais pas de glisser-déposer. Un spike jetable sur le kanban (glisser-déposer, « Annuler », palette) peut départager 1 et 2.
- **Finaliste 3 : Vue 3.5 + Reka UI** : solide, corpus moindre et pollué par Vue 2, URL moins typées.
- **Écartés** : SvelteKit 3 (sorti la veille, ruptures, PWA et Toast manquants), Angular 22 (verbeux, Angular Aria incomplet), Solid (2.0 en RC), Next.js et Nuxt (rendu serveur) ; Radix, cmdk, dnd-kit/core supplantés ou peu maintenus.
- **Hors ligne (ADR 0004)** : coque précachée par le service worker, une seule copie des données dans IndexedDB via le persisteur de TanStack Query ; le SW ne cache aucune réponse d'API, pour une seule copie à purger (déconnexion, 401 de session révoquée, ST-04). **Piège** : TanStack Query rejoue par défaut les mutations lancées hors ligne, soit la file d'écritures que l'ADR interdit ; désactiver les actions hors ligne et ne jamais persister les mutations.
- **ST-70** : une page cachée peut être jetée par le navigateur mobile ; panneau ouvert dans l'URL (paramètres typés), brouillon dans `sessionStorage`.
- **ST-62** : Toast React Aria encore `UNSTABLE_`, réglé à 10 s, pause intégrée ; `Ctrl Z` et séquences `G` + lettre par tinykeys, qui ignore les champs de saisie (ST-65).
- **ST-61** : l'alternative clavier est déjà prévue par la spec (`E`, `⋯`, palette) ; le glisser clavier de la bibliothèque est un plus. **ST-63** : recherche en mémoire sur le cache, sans aller-retour par frappe.
