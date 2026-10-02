# Candidats front

Type: research
Status: open
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
