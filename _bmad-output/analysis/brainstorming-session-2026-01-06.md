---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'Features et architecture de tiny-crm - CRM data-driven pour freelance'
session_goals: 'A/B Testing & Data-Driven, Funnel de conversion, KPI & Monitoring, Visualisation dashboard, Efficacité workflow, Intégrations & Extensibilité, Exploration aspects non-anticipés'
selected_approach: 'AI-Recommended Techniques'
techniques_used: ['SCAMPER Method']
techniques_in_progress: 'SCAMPER - Letter A (ADAPT) completed, moving to M (MODIFY)'
ideas_generated: []
context_file: ''
session_continued: true
continuation_date: '2026-01-08'
scamper_progress: 'S-SUBSTITUTE: ✅ | C-COMBINE: ✅ | A-ADAPT: ✅ | M-MODIFY: ✅ | P-PUT TO OTHER USES: ✅ | E-ELIMINATE: ✅ | R-REVERSE: ✅ | SCAMPER COMPLET ✅'
---

# Brainstorming Session Results

**Facilitator:** Romain
**Date:** 2026-01-06

## Session Overview

**Topic:** Features et architecture de tiny-crm - CRM data-driven pour freelance

**Goals:**
- 📊 A/B Testing & Data-Driven: Mécanismes de test, comparaison des variantes (CV, pitchs, approches)
- 🎯 Funnel de conversion: Définir les étapes du parcours prospect (appel ESN → mission signée)
- 📈 KPI & Monitoring: Identifier les métriques clés à suivre
- 🖥️ Visualisation: Dashboard ergonomique, graphes comparatifs, affichage intuitif
- ⚡ Efficacité: Interface qui fait gagner du temps, workflow optimisé
- 🔌 Intégrations & Extensibilité: Webhooks, APIs, connexion avec outils (n8n, Waalaxy)
- 💡 Exploration: Identifier les aspects non anticipés, opportunités manquées

### Session Setup

Cette session de brainstorming vise à explorer en profondeur l'architecture fonctionnelle et les features de tiny-crm, un CRM spécialisé pour l'activité freelance avec un focus particulier sur l'approche data-driven et l'optimisation continue via A/B testing.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Features et architecture de tiny-crm avec focus sur A/B Testing, Funnel, KPI, Visualisation, Efficacité, et Intégrations

**Recommended Techniques:**

- **SCAMPER Method (Structured):** Exploration systématique des 7 dimensions (Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse) pour identifier toutes les features possibles sans rien oublier
- **Cross-Pollination (Creative):** Transfert de solutions d'autres industries (analytics, automation, marketing) pour générer des innovations inattendues
- **Reverse Brainstorming (Creative):** Identification des aspects critiques en imaginant les échecs possibles puis en inversant pour trouver les solutions essentielles

**AI Rationale:** Séquence conçue pour combiner exploration méthodique (SCAMPER), innovation par transfert (Cross-Pollination), et révélation des manques (Reverse) - parfaite pour un projet technique nécessitant une couverture complète et des solutions innovantes.

## Technique Execution: SCAMPER Method

### S - SUBSTITUTE (Substituer)

**Exploration:** Remplacer les interfaces traditionnelles de type tableau/Excel par quelque chose de plus ergonomique

**Idées Générées:**

1. **Vues Contextuelles Adaptatives**
   - Remplacer tableaux statiques par des vues intelligentes qui s'adaptent au workflow
   - Auto-détection du mode optimal (post-appel ESN, prep entretien, analyse, etc.)
   - Contrôle manuel conservé: switcher rapide entre modes (icônes ou CMD+K)
   - Formulaires intelligents verticaux avec auto-complétion et suggestions basées sur historique

2. **Vues Spécifiques Identifiées:**
   - **Vue "Post-Appel ESN":** Champs essentiels (société, interlocuteur, besoin, TJM, timing, prochaine étape), indicateur temps de remplissage
   - **Vue "Entretien Technique - Replay & Analysis":** Upload enregistrement OBS (ou lien privé) + analyse IA

3. **Analyse IA des Entretiens - Coach Impitoyable**
   - **Discovery Quality Analysis:** Métrique "temps pour identifier le vrai besoin", checklist adaptive (budget, timing, stack, pain points, décideurs)
   - **Gestion des Objections:** Détection objections + analyse réponse (reformulation? creusage du pourquoi? alternative proposée?)
   - **Argumentaire & Positionnement:** Ratio pitch vs découverte, pattern recognition ("dans tes 5 derniers succès, tu as mentionné X dans les 3 premières min")
   - **A/B Testing des Scripts:** "Réponse type A aux objections budget: 40% conversion vs type B: 65%"
   - **Analyse Critique Performance:** Scoring confiance vocale, clarté, questions posées, ratio écoute/parole, mots-clés techniques, signaux d'intérêt

4. **Dashboard "Coaching Insights"**
   - Agrégation: "Tes 3 faiblesses récurrentes ce mois", "Ton meilleur argument (data-backed)", "Objection gérée le moins bien"
   - Comparaison performances entretiens pour continuous improvement

**Insight Clé:** Transformer le CRM en système de continuous improvement pour skills de prospection - chaque interaction devient data pour s'améliorer (growth hacking appliqué à soi-même)

**Principe Directeur:** Priorité au contrôle utilisateur vs "magie" - transparence sur ce qui est capturé et comment

### C - COMBINE (Combiner)

**Exploration:** Comment combiner intelligemment les 3 tables (prospects/interactions/positionnements) dans les vues adaptatives sans perdre en clarté et simplicité?

**Idées Générées:**

1. **Architecture UX Hybride: Smart Pivots + Contextual Layering**
   - **Structure principale:** 3 vues pivots séparées (Prospects | Positionnements | Interactions)
   - **Navigation:** Top navbar (meilleur responsive)
   - **Drill-down avec context:** Quand on clique sur un élément, les données liées apparaissent inline

2. **Clarification Modèle de Données:**
   - **Prospect = Personne** (Ingé chargé d'affaires ESN): nom, prénom, mail, tel
   - **ESN = Simple champ texte** (pas de table entreprise, pas de sur-architecture)
   - 2 collègues même ESN = 2 prospects distincts (aucun regroupement nécessaire)

3. **Vue "Prospects" Détaillée:**
   - **Liste:** Tableau compact (nom prospect, ESN, mission, statut funnel, dernière interaction)
   - **Détail prospect (drill-down):**
     - Info prospect principale
     - **Interactions inline (cards expandables):**
       - Compactes par défaut: "15/12 - Appel ESN - ✅ Intéressé - CV v2"
       - Expand au clic: notes complètes, durée, lien enregistrement, résumé IA
       - **Use case:** Tout visible sans quitter page = parfait quand prospect au téléphone
     - Métriques rapides: "3 interactions, 12 jours dans funnel, CV v2 utilisé"

4. **Vue "Positionnements" (A/B Testing Central):**
   - **Liste:** Stats par variante "CV v1 (8 prospects, 25% conversion)" | "CV v2 (12 prospects, 42%)"
   - **Détail positionnement (drill-down):**
     - Stats globales (conversion, temps moyen, best performance)
     - Liste prospects ayant reçu cette variante (avec statut actuel)
     - Interactions liées (tous les moments où variante utilisée)
     - Insights IA: "CV v2 performe mieux avec ESN mid-size"

5. **Vue "Interactions":**
   - **Liste chronologique:** Toutes interactions (filtrable par type, prospect, positionnement)
   - **Détail interaction (drill-down):**
     - Info interaction (date, type, outcome)
     - Prospect lié (badge cliquable)
     - Positionnement utilisé (badge cliquable)
     - Si enregistrement: lien + analyse IA

6. **CMD+K - Recherche Globale Universelle:**
   - Depuis n'importe où dans l'app
   - Recherche fuzzy cross-entity:
     - "marie techcorp" → trouve prospect Marie chez TechCorp
     - "cv v2" → trouve positionnement + tous prospects l'ayant reçu
     - "appel 15/12" → trouve interaction
   - Navigation instantanée au résultat
   - **Feature power user** pour gain de temps

**Combinaisons Puissantes Explorées:**

7. **Funnel + KPI en Temps Réel:**
   - Dashboard sticky dans vue Prospects
   - Affichage temps réel: "12 prospects phase Appel ESN, 5 en Test, 2 en Entretien"
   - Taux conversion entre chaque étape
   - Insights automatiques: "Ton taux Appel→Test a chuté de 15% cette semaine"

8. **Webhooks + Automatisation Workflow:**
   - Statut interaction → webhook automatique vers n8n
   - Exemple: Prospect "Intéressé" → déclenche n8n (email suivi + ajout Waalaxy pour LinkedIn)
   - Combo: CRM détecte signal, automation exécute action

9. **Analytics Positionnement + Recommandation IA Contextuelle:**
   - IA analyse données historiques: "ESN >100 personnes: CV v2 + Pitch B = 73% conversion"
   - Recommandation dans fiche prospect lors prep entretien: "Basé sur profil, utilise CV v2"

**Insight Clé:** Architecture hybride permet clarté de navigation (je sais dans quelle dimension je suis) + richesse contextuelle (liens visibles sans perdre contexte)

10. **Workflow Automatisé LinkedIn/Waalaxy + A/B Testing Industriel:**
   - **Flow complet:**
     1. Recherche prospects pertinents via LinkedIn Premium
     2. Import/Ajout dans CRM (création fiche prospect)
     3. Campagne Waalaxy automatisée pilotée depuis CRM:
        - 20 prospects/jour depuis CRM
        - Split A/B automatique: 10 messages variante A, 10 messages variante B
        - Variantes de messages stockées dans CRM (positionnements)
     4. Analyse performance dans CRM après 1 semaine
     5. Identification message gagnant basée sur data
   - **Challenge technique:** Disponibilité APIs LinkedIn/Waalaxy pour intégration complète
   - **Enjeu:** Automatisation complète du cycle prospection → test → analyse → optimisation
   - **Approche retenue:** Semi-automatique (export LinkedIn manuel + automation CRM/Waalaxy via API)
     - LinkedIn → Export CSV → Import CRM
     - CRM assigne variantes A/B automatiquement
     - CRM → Waalaxy API (lancement campagnes)
     - Waalaxy webhooks → CRM (tracking interactions)
   - **Data model pour LinkedIn:**
     - Table Positionnements: Type "Message LinkedIn", Variante A/B/C, Contenu texte, Métriques
     - Table Interactions: "Message envoyé - Variante A", "Connexion acceptée", "Réponse reçue", "Appel planifié"

**KPI Principal Retenu:**
- **Taux de passage à la prochaine étape du funnel** (métrique simple et actionable)
- Focus sur conversion entre étapes plutôt que métriques multiples

**Définition du Funnel de Conversion:**

**Ébauche initiale:**
1. Aucun contact
2. Message envoyé
3. Réponse message
4. Entretien ESN
5. Entretien client final
6. Contrat signé

**Challenge identifié:** Gérer les étapes avec instances multiples
- Exemple: "Entretien client final" peut inclure Lead Dev + RH
- Question: Comment modéliser quand une étape a plusieurs occurrences?

**Funnel Final Validé:**

1. **Lead qualifié** (dans CRM, pas encore contacté)
2. **Premier contact** (message LinkedIn envoyé)
3. **Connexion établie** (acceptation connexion LinkedIn) - *peut avoir instances multiples (relances)*
4. **Réponse positive** (prospect intéressé, échange entamé)
5. **Qualification ESN** (appel avec chargé d'affaires - comprendre besoin)
6. **Candidature envoyée** (CV + profil envoyé, variante trackée)
7. **Entretien(s) ESN** - *peut avoir instances multiples*
8. **Entretien(s) client final** (Lead Dev, RH, etc.) - *peut avoir instances multiples*
9. **Proposition reçue** (contrat/TJM proposé)
10. **Contrat signé** ✅

**Étapes avec instances multiples:**
- **Connexion établie:** Relances possibles
- **Entretien ESN:** Plusieurs entretiens possibles
- **Entretien client final:** Lead Dev, RH, CTO, etc.

**Test technique:** ❌ Pas une étape funnel séparée
- **Modélisation:** Sous-type d'interaction dans "Entretien ESN" ou "Entretien client final"
- **Exemples interactions:**
  - "Entretien ESN - Test technique React"
  - "Entretien ESN - Discussion profil"
  - "Entretien client final - Test technique algo"
  - "Entretien client final - Entretien RH fit culturel"

**Modèle de données Interactions - Structure:**
- **Type principal:** Correspond à l'étape funnel (ex: "Entretien ESN")
- **Sous-type:** Précise la nature (ex: "Test technique", "Discussion profil", "Entretien RH")
- **Statut:** Outcome (✅ Positif, ⏳ En attente, ❌ Négatif)
- **Métadonnées:** Date, durée, interlocuteur, notes, lien enregistrement, variante positionnement utilisée

**Logique de progression funnel:**
- Prospect reste dans étape actuelle tant que toutes instances critiques non complétées
- Exemple: Statut "Entretien client final" avec interactions:
  - "Entretien Lead Dev ✅"
  - "Test technique ✅"
  - "Entretien RH ⏳ Planifié"
  → Prospect reste en "Entretien client final" jusqu'à ce que RH soit fait

**Insight Clé Combine:** Flexibilité du modèle - funnel macro simple pour analytics + granularité interactions pour amélioration continue

### A - ADAPT (Adapter)

**Exploration:** Quelles solutions ou patterns d'autres domaines pourraient être adaptés à votre CRM data-driven?

**Domaines explorés pour adaptation:**

1. **Marketing Analytics (Mixpanel, Amplitude):**
   - Concept "Funnels + Cohorts" - grouper prospects par cohorte (ex: "contactés sem. 2 jan avec Message A")
   - Retention curves - combien de prospects "survivent" à chaque étape après X jours
   - Dashboard "Cohorte Analysis" pour comparer performances

2. **Growth Hacking:**
   - "North Star Metric" - LA métrique qui compte (ex: TJM moyen missions signées, Temps Lead→Signature)
   - Vue principale affichant North Star + ses drivers

3. **DevOps/Observability (Datadog, Grafana):**
   - Alertes intelligentes sur dérives métriques
   - Anomaly detection automatique
   - ❌ **REJETÉ par utilisateur:** Alertes type "performance a baissé" = anxiogène et contre-productif

4. **Science Expérimentale:** ✅ **DOMAINE PRÉFÉRÉ**
   - **Taille d'échantillon pour A/B test:** App indique "Il te faut encore 15 prospects sur variante B pour résultat statistiquement significatif"
   - **p-value et confidence intervals:** Savoir si différence A vs B est réelle ou juste du bruit
   - **Feature validateur statistique:** Intégré dans A/B tests pour éviter conclusions hâtives

5. **Trading/Finance:**
   - Heatmaps de performance (calendrier avec couleurs)
   - Moving averages (tendances lissées 7/30 jours)
   - Visualisations temporelles sophistiquées

**Direction retenue:** Adaptation patterns science expérimentale pour rigueur statistique dans A/B testing

**Principe utilisateur:** Pas d'alertes anxiogènes - l'utilisateur consulte les data quand il veut, pas de notifications push stressantes

---

### A - ADAPT: Science Expérimentale - Exploration Complète (Session Continuation 2026-01-08)

**Contexte rappel:** Contexte freelance missions longues (1-2 missions/an signées) = faible volume mais haute qualité. Philosophie utilisateur : **"Quelques KPI très significatifs > 50 KPI mesurant tout"** - Pas d'usine à gaz, priorité ergonomie et gain de temps.

#### Principes de Simplicité Scientifique Validés

**Philosophie utilisateur confirmée:**
- Science expérimentale ≠ complexité
- Rigueur = isoler ce qui compte vraiment
- CRM = laboratoire d'optimisation personnelle, pas CRM de volume

#### 1. Indicateur Statistique Essentiel : Feu Tricolore Fiabilité ✅

**Pattern adapté :** Sample Confidence visuel universel

**Implémentation :**
- 🔴 **< 20 essais** : "Trop tôt pour conclure"
- 🟡 **20-50 essais** : "Tendance émergente (prendre avec précaution)"
- 🟢 **50+ essais** : "Résultat fiable"

**Statut :** Nice to have (pas obligation absolue)

**Exemple d'affichage dans vue Positionnements :**
```
CV v1: 🟡 32 prospects | 25% conversion
CV v2: 🟢 58 prospects | 42% conversion ✅ GAGNANT CONFIRMÉ
CV v3: 🔴 12 prospects | 33% conversion (trop tôt)
```

#### 2. KPI Universels : Rejet de la Proposition Initiale ❌

**Proposition initiale (3 KPI) :**
- ❌ TJM moyen missions signées : Rejeté - pas pertinent pour missions longues (1-2/an)
- ❌ Temps Lead→Signature : Rejeté - peu de valeur pour l'utilisateur
- ❌ Conversion globale : Bonus mais pas essentiel

**KPI réellement crucial identifié :**
- ✅ **Taux de conversion par étape du funnel, variante par variante**
- ✅ **Performance par variante pour passer à l'étape suivante**

**Insight clé :** Le cœur du CRM data-driven = optimiser chaque transition du funnel par variante, pas des métriques globales.

#### 3. Vue Centrale : Performance Matrix Variante × Étape Funnel ✅ **CŒUR DU CRM**

**Pattern adapté :** Matrice de performance contextuelle

**Structure :**
```
Performance Variantes par Étape Funnel

┌─────────────────┬──────────────┬──────────────┬──────────────┐
│                 │   CV v1      │   CV v2      │   CV v3      │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Lead Qualifié   │   42 envoyés │   58 envoyés │   12 envoyés │
│ → Premier       │   38% 🟢     │   52% 🟢 ✅  │   42% 🔴     │
│ Contact         │   (16 succès)│   (30 succès)│   (5 succès) │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Premier Contact │   16 base    │   30 base    │   5 base     │
│ → Réponse       │   62% 🟡     │   73% 🟢 ✅  │   60% 🔴     │
│ Positive        │   (10 succès)│   (22 succès)│   (3 succès) │
└─────────────────┴──────────────┴──────────────┴──────────────┘

✅ = Meilleure performance pour cette étape
Feu tricolore = Fiabilité statistique
```

**Fonctionnalités :**
- Drill-down par cellule : voir prospects ayant utilisé cette variante à cette étape
- Détail interactions, timing, contexte
- Vue centrale et principale du CRM

**Statut :** **CORE FEATURE - Vue centrale dont l'utilisateur rêve**

#### 4. Pattern Bayesian Updating pour Faible Volume ✅

**Problème identifié :** Avec 1-2 missions/an signées, attendre 50+ essais = 25-50 ans pour conclusions statistiques !

**Solution pattern Bayesian Thinking adaptée :**

**Principe en français simple :**
- "Utilise toute ta data même avec peu de volume"
- Compare chaque variante à ta baseline historique
- Au lieu de "pas assez de data donc je sais rien" → "voici ce que je sais avec data actuelle + niveau confiance"

**Exemple d'implémentation :**
```
CV v2 : 12 essais → 58% conversion

🔴 Statistiquement insuffisant MAIS...

📊 Comparaison au "Prior" (baseline) :
   • Moyenne historique toutes variantes : 42%
   • CV v2 = +16 points vs moyenne
   • Magnitude : significative même avec peu de data

💡 Décision intelligente :
   "Échantillon faible MAIS écart important"
   → Continuer à utiliser CV v2
   → Monitorer les 10 prochains essais
```

**Affichage type :**
"🔴 Volume faible (12 essais) MAIS +16 points vs baseline → Continuer à monitorer"

**Statut :** **VALIDÉ - Pattern essentiel pour contexte low-volume**

#### 5. Pattern Cohort Comparison Qualitatif ❌ REJETÉ

**Proposition :** Analyse qualitative par cohorte (ESN mid-size, type mission, profil interlocuteur)

**Exemple proposé :**
```
CV v2 - Analyse qualitative :
✅ Performe avec ESN mid-size (50-200p) : 78%
✅ Missions React/TypeScript : 68%
❌ Grandes ESN (500+) : 32%
```

**Rejet utilisateur :**
- Analyse trop détaillée/granulaire
- Cible toujours mêmes profils en vue de compétences
- Cohorte sera toujours similaire
- Cohérent avec philosophie "pas d'usine à gaz"

**Statut :** ❌ Trop granulaire pour usage réel

#### 6. Dashboard Général "North Star" - Bonus Non Essentiel

**Proposition :** Dashboard minimaliste "cockpit" avec vue pilote

**Statut utilisateur :** Bonus cool mais pas ultra obligatoire

**Priorité :** Performance Matrix >> Dashboard général

---

### Récapitulatif ADAPT - Science Expérimentale : Patterns Validés

**✅ CORE FEATURES (Must Have) :**
1. **Performance Matrix Variante × Étape Funnel** - Vue centrale du CRM
2. **Bayesian Updating** - Utiliser data même avec faible volume + baseline comparaison
3. **Taux conversion par étape/variante** - KPI vraiment crucial

**✅ NICE TO HAVE :**
1. **Feu tricolore fiabilité** - Indicateur visuel confiance statistique
2. **Dashboard général North Star** - Vue d'ensemble

**❌ REJETÉS (Over-engineering) :**
1. KPI TJM moyen - Pas pertinent missions longues
2. KPI Temps Lead→Signature - Peu de valeur
3. Cohort Analysis détaillée - Trop granulaire
4. Multiples indicateurs statistiques (p-value, effect size, power) - Usine à gaz

**Principe Directeur :** Simplicité scientifique - rigueur sans complexité, ergonomie avant tout

---

### M - MODIFY (Modifier / Magnifier / Miniaturiser) - Exploration Complète

**Objectif MODIFY :** Explorer ce qui pourrait être modifié, agrandi, réduit, ou transformé dans le workflow et l'architecture du CRM.

#### Contexte Crucial Révélé : "Machine de Guerre en Hibernation"

**Réalité utilisateur identifiée :**

**Situation actuelle :**
- Mission longue en cours (2 ans avec même client)
- Volume prospection minimal : ~1 entretien tous les 3 mois
- Tout dans la tête, zéro tracking, zéro process formalisé
- Utilisation actuelle : Notion + Airtable de manière non-cadrée
- CV customisé manuellement pour chaque interlocuteur

**Besoin futur (si mission s'arrête) :**
- **Objectif : Trouver nouvelle mission longue en 30-45 jours**
- Passage de mode "hibernation" à mode "guerre" en 24h
- Prospection massive avec process industrialisé
- Volume élevé nécessitant standardisation et A/B testing

**La vraie friction MODIFY :** Miniaturiser le temps de "Cold Start" entre fin de mission et prospection active à plein régime.

---

#### 1. MAGNIFIER : Multi-Compte Utilisateur ✅

**Décision architecture :** Prévoir multi-compte dès le début (amis freelances potentiellement intéressés).

**Spécifications validées :**

**A. Isolation Totale des Données**
- Chaque utilisateur = données complètement séparées
- Zéro partage entre comptes
- Sécurité stricte : un user ne peut jamais accéder aux données d'un autre

**B. Authentification Simple**
- Système classique : Email + Password
- Page login/signup standard
- Pas de système d'invitation complexe

**C. Contrôle Création Compte**
- Géré par variable d'environnement : `ALLOW_REGISTRATION=true/false`
- Si `false` : Bouton "Créer un compte" non affiché sur page login
- Si `true` : Création compte accessible
- Contrôle total par l'administrateur (utilisateur principal)

**D. Stack Technique Décidée**
- **Hébergement :** VPS auto-hébergé (contrôle total)
- **Base de données :** Supabase
  - Avantage sécurité : Protection data même en cas d'attaque VPS
  - Auth built-in : Email/password + Row Level Security natif
  - Moins de code custom à écrire pour sécurité

**Statut :** ✅ **VALIDÉ - Architecture multi-compte simple et sécurisée**

---

#### 2. MINIATURISER : Cold Start "Hibernation → War Mode"

**Pattern exploré :** Réduire drastiquement le temps entre "Ma mission s'arrête" et "Je prospecte activement".

##### A. War Mode Checklist - Préparation Avant Jour J

**Concept :** Checklist de préparation pour avoir tout prêt avant activation mode guerre.

**Éléments suggérés :**
- 3 variantes CV créées et uploadées dans CRM
- 5 variantes messages LinkedIn rédigées et stockées
- Script appel ESN préparé (questions clés, pitch)
- Liste cible 50-100 ESN identifiées
- Profil LinkedIn optimisé
- Configuration Waalaxy/n8n prête

**Décision utilisateur :**
- ✅ Checklist fait sens conceptuellement
- ⚠️ Pas géré activement par le CRM (responsabilité utilisateur)
- 📋 **Statut : Bonus nice-to-have** - Memo simple dans coin du dashboard au premier lancement

**Statut :** Nice to have, pas core feature

##### B. Import Massif CSV LinkedIn ✅ **FEATURE PRIORITAIRE**

**Besoin :** Passer de 0 à 50 prospects en quelques heures, sans passer 3h à remplir formulaires.

**Solution :** Import CSV depuis LinkedIn Sales Navigator.

**Spécifications détaillées :**

**1. Mapping Champs CSV → CRM**

```
CSV LinkedIn                → CRM tiny-crm
─────────────────────────────────────────────────
Prénom + Nom                → Prospect (nom complet)
Entreprise                  → ESN (champ texte)
LinkedIn URL                → Lien profil LinkedIn
Email (si disponible)       → Email prospect
Téléphone (si disponible)   → Téléphone prospect
Titre du poste              → Titre (info contextuelle)
Autres infos disponibles    → Optionnel (bonus si pertinent)
```

**Champs essentiels validés :** Nom/prénom, entreprise, lien LinkedIn, email/tel (si dispo), titre poste.

**2. Statut Funnel par Défaut à l'Import**

**Décision :** Tous les prospects importés arrivent automatiquement à **"Lead qualifié"** (étape 1 du funnel).

**Rationale :** Simplicité. Pas de popup, pas de choix complexe. Import = prospects pas encore contactés.

**3. Gestion des Doublons**

**Problème :** Import CSV avec 50 prospects, dont 5 déjà présents dans CRM.

**Solution validée :**
- ✅ **Détection automatique des doublons** (basée sur email ou LinkedIn URL)
- ✅ **Pré-remplissage des updates** : Système propose update avec nouvelles infos CSV
- ✅ **Validation manuelle** : Utilisateur valide ou refuse l'update pour chaque doublon
- Workflow : "5 doublons détectés → Voici les changements proposés → Valider/Ignorer"

**Statut :** ✅ **CORE FEATURE - Gain de temps massif identifié**

##### C. Batch A/B Automation ❌ REJETÉ

**Concept exploré :** Automation dans CRM pour sélectionner 50 prospects → split auto A/B 50/50 → envoyer vers Waalaxy.

**Décision utilisateur :**
- ❌ **Rejeté** : Waalaxy gère déjà ce genre de batch operations
- Pas besoin de dupliquer cette logique dans le CRM
- Principe : Ne pas recoder ce qui existe déjà dans les outils

**Statut :** ❌ Over-engineering, pas nécessaire

##### D. Mode Hibernation - Préparation Terrain

**Utilisation CRM pendant mission longue (mode hibernation) :**

**Objectif :** Centraliser et préparer tout en amont pour être prêt le jour J.

**Actions possibles en hibernation :**
- Upload variantes (CV, pitch, messages prospection)
- Import prospects potentiels dans CRM
- Structurer et préparer positionnements
- Avoir tout centralisé et prêt pour coup d'envoi immédiat

**Fréquence :** Occasionnelle (ex: 1 fois/mois pour "stay ready")

**Statut :** ✅ Use case validé - CRM utile même en mode hibernation

---

#### 3. MODIFY Interface Visuelle - Deux Modes ? ❌ REJETÉ

**Concept exploré :** Interface qui change selon contexte (Mode Hibernation calme vs Mode Guerre dynamique).

**Proposition :**
- Mode Hibernation : Interface épurée, focus préparation
- Mode Guerre : Interface dynamique, focus action/conversion
- Toggle switch : 🌙 Hibernation | ⚡ War Mode

**Décision utilisateur :**
- ❌ **Rejeté** : Over-engineering
- **Une seule interface simple suffit** pour les deux situations
- Si interface bien conçue, elle convient naturellement aux deux contextes

**Principe :** Simplicité > Sophistication. Pas de modes multiples.

**Statut :** ❌ Pas nécessaire

---

### Récapitulatif MODIFY : Décisions Validées

**✅ CORE FEATURES (Must Have) :**
1. **Multi-compte avec isolation totale** - Architecture dès le début
2. **Auth simple Email/Password** - Supabase auth
3. **Variable d'env contrôle registration** - `ALLOW_REGISTRATION=true/false`
4. **Import CSV LinkedIn** - Feature prioritaire gain de temps massif
   - Mapping : Nom, entreprise, LinkedIn, email/tel, titre
   - Statut par défaut : "Lead qualifié"
   - Gestion doublons : Détection + pré-remplissage + validation manuelle

**✅ NICE TO HAVE :**
1. **War Mode Checklist** - Memo dashboard premier lancement (bonus)
2. **Mode hibernation** - Use case préparation terrain validé

**✅ DÉCISIONS TECHNIQUES :**
1. **Stack :** VPS auto-hébergé + Supabase (sécurité + auth)
2. **Une interface unique** - Pas de modes visuels multiples

**❌ REJETÉS (Over-engineering) :**
1. Batch A/B automation - Waalaxy le gère déjà
2. Système d'invitation complexe - Variable d'env suffit
3. Double mode interface (Hibernation/Guerre) - Une interface simple suffit
4. Choix statut à l'import - Toujours "Lead qualifié"

**Insight Clé MODIFY :** Le CRM n'est pas pour optimiser un workflow existant, c'est une **machine de guerre en hibernation** qui doit pouvoir s'activer en 24h pour trouver mission en 30-45 jours.

**Principe Directeur :** Cold Start rapide + Simplicité > Sophistication

---

### P - PUT TO OTHER USES (Utiliser Autrement) - Exploration Complète

**Objectif PUT TO OTHER USES :** Explorer comment le CRM ou ses composants pourraient être utilisés différemment, pour d'autres usages ou contextes.

#### Angles Explorés

**1. Composants Potentiellement Réutilisables :**
- Performance Matrix (A/B testing variante × étape)
- Import CSV intelligent avec gestion doublons
- Funnel de conversion tracking

**2. Autres Publics Potentiels :**
- Commerciaux indépendants
- Consultants
- Agences de recrutement
- Indie makers / Side projects

---

#### 1. Analyse IA Entretiens = Standalone Future ❌ (Exclu du CRM)

**Concept exploré :** Analyse IA des entretiens enregistrés pour identifier faiblesses et s'améliorer (coach impitoyable).

**Analyse Coût :**
- Transcription (Whisper) : ~0.27$/entretien 45min
- Analyse GPT-4 : ~0.10-0.20$/entretien
- **Total : ~0.40-0.50$ par entretien analysé**
- En mode guerre (20 entretiens) : 8-10$ coût total

**Verdict coût :** ✅ Très acceptable pour la valeur apportée

**Décision stratégique :**
- ❌ **EXCLU de tiny-crm pour l'instant**
- **Rationale :** Bloc vraiment distinct = mieux dans app séparée dédiée
- **Principe produit :** Focus sur 1 problématique unique (CRM data-driven prospection)
- **Future potentiel :** App standalone "Interview Coach AI" pour freelances/commerciaux/consultants
- **Intégration possible :** Pont webhook entre tiny-crm et app analyse IA (futur)

**Statut :** ❌ Hors scope tiny-crm v1 - Potentiel standalone futur

---

#### 2. Funnel Customisable = Flexibilité Sans Complexité ✅ **CORE FEATURE**

**Besoin identifié :**
- Le funnel utilisateur va évoluer avec l'expérience
- Impossible de prédire le découpage optimal dès le début
- Besoin de flexibilité sans toucher au code

**Avantages pour l'utilisateur principal (freelance) :**
1. **Évolution naturelle** - Affiner étapes avec l'expérience terrain
2. **Expérimentation** - Tester différents découpages de funnel
3. **Flexibilité totale** - Ajouter/retirer/modifier étapes sans limite

**Avantages pour généralisation future (bonus, pas prioritaire) :**
- Commercial indépendant : Funnel vente classique
- Consultant : Funnel prospection conseil
- Recruteur : Funnel placement candidats
- App devient réellement générique si besoin futur

**Implémentation technique (simplicité maintenue) :**

**UI de gestion :**
```
Page "Configuration Funnel"
┌─────────────────────────────────┐
│ MES ÉTAPES DU FUNNEL            │
├─────────────────────────────────┤
│ 1. Lead qualifié               │ [✏️] [🗑️]
│ 2. Premier contact             │ [✏️] [🗑️]
│ 3. Réponse positive            │ [✏️] [🗑️]
│ ...                            │
│ [➕ Ajouter une étape]         │
└─────────────────────────────────┘
```

**Modèle de données :**
- Table `funnel_stages` : `user_id, stage_name, order, created_at`
- Relations : `interactions.funnel_stage_id` → `funnel_stages.id`
- Gestion ordre (séquentiel simple)

**Limites pour éviter usine à gaz :**
- Maximum 15 étapes (largement suffisant)
- Noms texte simple
- Ordre linéaire uniquement (pas de branches conditionnelles)
- Pas de sous-types complexes

**Funnel par défaut au premier lancement :**
- Pré-rempli avec funnel freelance validé (10 étapes)
- Message : "Voici un funnel par défaut. Modifiable dans Paramètres > Funnel"
- User peut utiliser tel quel ou customiser

**Verdict complexité technique :** ✅ CRUD standard, pas si complexe

**Décision :**
- ✅ **INCLUS dans le scope tiny-crm v1**
- **Rationale :** Très très très bénéfique même pour utilisateur unique
- Permet évolution naturelle du process sans redéploiement code

**Statut :** ✅ **CORE FEATURE - Flexibilité essentielle validée**

---

#### 3. Généralisation App pour Toute Prospection ⏸️ PAS PRIORITAIRE

**Potentiel identifié :**
- Avec funnel customisable → app devient générique
- Toute personne faisant prospection pourrait être intéressée

**Décision utilisateur :**
- ⏸️ **Pas à l'ordre du jour pour l'instant**
- On garde nom "tiny-crm"
- Focus freelance maintenu
- Multi-user reste limité (amis freelances, variable env)
- **Funnel customisable utile pour utilisateur principal déjà**

**Principe :** Ne pas généraliser prématurément. Focus sur UN cas d'usage bien résolu.

**Statut :** ⏸️ Potentiel futur, pas priorité actuelle

---

### Récapitulatif PUT TO OTHER USES : Décisions Validées

**✅ CORE FEATURES AJOUTÉES :**
1. **Funnel Customisable** - Configuration étapes sans toucher code
   - UI simple gestion étapes
   - Funnel par défaut pré-rempli
   - Maximum 15 étapes, ordre linéaire simple
   - Bénéfice immédiat même pour usage solo

**❌ EXCLUS DU SCOPE (Future standalone potentiel) :**
1. **Analyse IA Entretiens** - App séparée dédiée future
   - Coût acceptable (~0.40$/entretien) mais bloc distinct
   - Potentiel pont webhook plus tard
   - Focus tiny-crm = CRM data-driven, pas coaching entretiens

**⏸️ PAS PRIORITAIRE :**
1. **Généralisation app tous contextes prospection** - Pas à l'ordre du jour
2. **Composants standalone** - Pas exploré davantage

**Insight Clé PUT TO OTHER USES :** Un bon produit résout UN problème vraiment bien. Analyse IA entretiens = problème séparé = app séparée. Funnel customisable = flexibilité essentielle même pour cas d'usage unique.

**Principe Directeur :** Focus + Flexibilité. Ne pas essayer de tout faire, mais ce qu'on fait doit être adaptable.

---

### E - ELIMINATE (Éliminer / Simplifier) - Exploration Complète

**Objectif ELIMINATE :** Identifier ce qu'on peut supprimer, simplifier, réduire ou éliminer complètement pour améliorer l'expérience.

**Principe :** Parfois, la meilleure feature c'est celle qu'on N'ajoute PAS.

---

#### Éliminations Réalisées Avant ELIMINATE (Révision)

**Ce qu'on a déjà éliminé dans les étapes précédentes :**

**✂️ GROSSES ÉLIMINATIONS :**
1. **Analyse IA Entretiens** - Bloc entier exclu (complexe, coûteux, distinct = app séparée future)
2. **Batch A/B automation** - Waalaxy le gère déjà, pas de duplication
3. **Système d'invitation complexe** - Variable d'env simple suffit
4. **Double mode interface** (Hibernation/Guerre) - Une interface simple universelle suffit
5. **Choix statut à l'import CSV** - Toujours "Lead qualifié" automatiquement
6. **Cohort Analysis détaillée** - Trop granulaire pour usage réel
7. **Multiples indicateurs statistiques** (p-value, effect size, power) - Feu tricolore simple suffit
8. **Alertes anxiogènes** - Pas de notifications push stressantes

**Principe appliqué :** Simplicité > Sophistication. Focus sur ce qui apporte vraiment de la valeur.

---

#### Éliminations Complémentaires Phase ELIMINATE

##### 1. Dashboard North Star / Vue Générale ✂️ ÉLIMINÉ

**Statut antérieur :** Nice to have, bonus cool mais pas ultra obligatoire

**Décision :**
- ✂️ **ÉLIMINÉ du scope**
- **Rationale :**
  - Performance Matrix = déjà la vue centrale qui compte
  - Dashboard général = couche supplémentaire sans valeur ajoutée essentielle
  - Ergonomie = accès direct aux vues qui comptent (Prospects, Interactions, Variantes)
  - Moins de complexité UI

**Impact :** Simplification interface, focus sur vues actionnables.

**Statut :** ✂️ Supprimé définitivement

##### 2. War Mode Checklist ✂️ ÉLIMINÉ

**Statut antérieur :** Bonus nice-to-have, memo dashboard premier lancement

**Décision :**
- ✂️ **ÉLIMINÉ complètement**
- **Rationale :** Utilisateur gère ça de son côté en dehors du CRM
- Pas besoin de feature dédiée dans l'app

**Statut :** ✂️ Supprimé définitivement

##### 3. CMD+K Recherche Globale Fuzzy ✂️ ÉLIMINÉ du MVP

**Statut antérieur :** Feature "power user" pour recherche cross-entity

**Décision :**
- ✂️ **ÉLIMINÉ du MVP**
- **Remplacé par :** Recherche simple dans chaque vue séparément
- **Rationale :**
  - Simplifie développement initial
  - Recherche par vue suffit pour commencer
  - Peut être ajoutée en v2 si besoin ressenti après usage réel
  - Principe : MVP d'abord, power user features après

**Statut :** ✂️ Exclu MVP, potentiel v2 future

##### 4. Feu Tricolore Fiabilité Statistique ✅ GARDÉ (Décision inverse ELIMINATE)

**Statut antérieur :** Nice to have (pas obligation absolue)

**Réévaluation :**
- ✅ **GARDÉ dans le scope**
- **Rationale utilisateur :**
  - Nombre d'essais par variante = donnée absolument nécessaire pour stats
  - Afficher code couleur conditionnel basé sur ce nombre = trivial en code
  - Pas de surcoût développement ou complexité
  - Valeur visuelle immédiate pour fiabilité insights

**Implémentation :**
```
Logique simple :
- < 20 essais → 🔴 Rouge
- 20-50 essais → 🟡 Jaune
- 50+ essais → 🟢 Vert

Basé sur data déjà présente, juste affichage conditionnel
```

**Statut :** ✅ **Confirmé dans scope** - Simple et utile

---

#### Simplifications Workflow Validées

##### Ajout Interaction - Deux Chemins Complémentaires ✅

**Pattern validé :** Permettre ajout interaction depuis 2 points d'entrée selon contexte utilisateur.

**Chemin 1 : Depuis fiche prospect**
```
Vue Prospect (détail)
└─ [➕ Ajouter interaction]
   └─ Formulaire avec prospect pré-rempli
```
**Use case :** Je viens de raccrocher avec CE prospect, j'ajoute interaction immédiatement.

**Chemin 2 : Depuis liste interactions**
```
Vue Interactions (liste globale)
└─ [➕ Nouvelle interaction]
   └─ Formulaire avec dropdown/autocomplete prospect
```
**Use case :** Je veux logger une interaction, je cherche/sélectionne le prospect dans la foulée.

**Rationale :** Deux chemins complémentaires, pas redondants. Chacun correspond à un contexte d'usage réel différent.

**Statut :** ✅ Workflow simplifié et flexible validé

---

### Récapitulatif ELIMINATE : Décisions Finales

**✂️ ÉLIMINÉ DÉFINITIVEMENT :**
1. **Dashboard North Star** - Pas de valeur ajoutée vs Performance Matrix
2. **War Mode Checklist** - Géré en dehors du CRM
3. **Analyse IA Entretiens** - App séparée future (éliminé en PUT TO OTHER USES)
4. **Batch A/B automation** - Waalaxy le gère (éliminé en MODIFY)
5. **Système invitation complexe** - Variable env suffit (éliminé en MODIFY)
6. **Double mode interface** - Interface unique suffit (éliminé en MODIFY)
7. **Cohort Analysis** - Trop granulaire (éliminé en ADAPT)
8. **Multiples KPI génériques** - Focus conversion par étape (éliminé en ADAPT)

**✂️ ÉLIMINÉ DU MVP (Potentiel v2) :**
1. **CMD+K Recherche Globale** - Remplacé par recherche simple par vue

**✅ GARDÉ (Décision contraire ELIMINATE) :**
1. **Feu Tricolore Fiabilité** - Simple à implémenter, donnée déjà présente, valeur visuelle

**✅ SIMPLIFIÉ ET VALIDÉ :**
1. **Workflow ajout interaction** - Deux chemins complémentaires selon contexte

---

**Total features/concepts éliminés :** 9 éliminations définitives + 1 reportée v2

**Insight Clé ELIMINATE :** On a éliminé ~30-40% des features/concepts identifiés. Le CRM est maintenant ultra-focalisé sur ce qui compte vraiment : tracking prospects/interactions/variantes + analytics conversion par étape.

**Principe Directeur :** La simplicité libère. Chaque feature éliminée = moins de complexité, développement plus rapide, maintenance plus facile.

---

### R - REVERSE (Inverser / Renverser) - Exploration Complète

**Objectif REVERSE :** Inverser la logique, renverser les assumptions, faire l'opposé de ce qu'on pense naturel pour découvrir des insights surprenants.

**Principe :** Parfois challenger nos hypothèses de base révèle des opportunités cachées.

---

#### Inversions Explorées

##### 1. Inbound vs Outbound (Prospects Viennent à Vous)

**Inversion proposée :** Au lieu de chasser activement les ESN, inverser le flux pour être trouvable.

**Exploration :**
- CRM pourrait tracker d'où viennent leads entrants
- Optimiser visibilité LinkedIn (profil = variante testable)
- Dimension inbound marketing

**Verdict :** ❌ Pas pertinent pour contexte utilisateur (prospection active B2B ESN)

##### 2. Reverse-Engineer Succès (Partir de la Fin)

**Inversion proposée :** Analyser rétrospectivement les missions signées pour comprendre patterns de succès.

**Exploration :**
- Vue "Anatomy of Success"
- Profils ESN gagnants, timing optimal, messages fonctionnels
- Scorer automatiquement nouveaux leads basé sur succès passés

**Verdict :** ❌ Trop complexe pour volume faible (1-2 missions/an), pas assez de data historique

##### 3. Action > Data (Forcer l'Action vs Collecte Infinie)

**Inversion proposée :** Plutôt que "il manque X prospects pour valider", dire "Utilise ça en attendant".

**Exploration :**
- Mode "Bias toward action"
- Anti-paralysie par l'analyse
- Encourager décision avec data partielle

**Verdict :** ❌ Pas nécessaire - Bayesian Updating résout déjà ce problème (comparaison baseline)

##### 4. Self-Service Prospects (Ils Gèrent Leurs Infos)

**Inversion proposée :** Prospects mettent à jour leurs propres infos dans le CRM.

**Exploration :**
- Formulaire public pour ESN intéressées
- Lien signature email "Mettez à jour votre statut"
- Réduire friction data entry

**Verdict :** ❌ Trop complexe/étrange pour contexte B2B professionnel ESN

##### 5. CRM Proactif (Dit Quoi Faire) ⚠️ INTÉRESSANT MAIS OVERKILL

**Inversion proposée :** CRM devient assistant décisionnel proactif plutôt que tableau de bord passif.

**Exploration :**
- "Aujourd'hui tu devrais relancer ces 3 prospects"
- "Cette variante performe mieux, switche maintenant"
- Notifications intelligentes vs consultation à la demande

**Réaction utilisateur :**
- ✨ **Concept le plus intéressant parmi les inversions**
- ⚠️ **MAIS : Overkill pour MVP**

**Analyse :**

**Pourquoi overkill :**
1. **Complexité technique importante** - Système de règles, notifications, intelligence décisionnelle
2. **Incohérence philosophique** - Utilisateur a rejeté "alertes anxiogènes" dès ADAPT
3. **Principe validé** - "Je consulte data quand JE veux, pas quand app décide"
4. **Coût développement** - Chaque feature proactive = maintenance continue

**Version ultra-minimaliste théorique (non retenue) :**
```
Badge notification discret :
"3 prospects sans interaction depuis 14+ jours"

Pas de push, juste indicateur visuel in-app
Ultra-simple, non-intrusif
```

**Verdict final :** ❌ Même version minimaliste pas nécessaire pour MVP

**Statut :** Concept intéressant mais rejeté pour simplicité

---

### Récapitulatif REVERSE : Aucune Inversion Retenue

**Inversions explorées :** 5 concepts

**Inversions validées :** 0

**Rationale globale :**
- Toutes les inversions sont soit overkill, soit ne correspondent pas au besoin réel
- Le modèle "classique" du CRM est finalement le bon pour ce cas d'usage
- Parfois, ne pas inverser = la bonne décision

**Insight Clé REVERSE :** Explorer les inversions a permis de VALIDER le modèle choisi. Quand aucune inversion n'apporte de valeur, c'est que le modèle initial est solide.

**Principe Directeur :** Pas d'inversion pour le principe d'inverser. Garder ce qui marche. La simplicité bat la sophistication.

---

## 🎯 SCAMPER COMPLET : SYNTHÈSE GLOBALE

**Technique SCAMPER appliquée intégralement sur tiny-crm :**

### Résumé par Lettre

**S - SUBSTITUTE (Substituer) ✅**
- Vues contextuelles adaptatives vs tableaux Excel statiques
- Analyse IA entretiens "coach impitoyable" (exclu en PUT TO OTHER USES)
- Formulaires intelligents avec auto-complétion

**C - COMBINE (Combiner) ✅**
- Architecture UX hybride : 3 vues pivots (Prospects | Positionnements | Interactions)
- Funnel 10 étapes avec instances multiples
- Workflow automatisé LinkedIn/Waalaxy + A/B testing
- KPI principal : Taux conversion par étape

**A - ADAPT (Adapter) ✅**
- Science expérimentale → Bayesian Updating pour faible volume
- Performance Matrix Variante × Étape (CŒUR DU CRM)
- Feu tricolore fiabilité statistique
- Rejet alertes anxiogènes

**M - MODIFY (Modifier) ✅**
- Multi-compte (Supabase + VPS + isolation totale)
- Import CSV LinkedIn (feature prioritaire)
- Funnel customisable (flexibilité essentielle)
- Insight "Machine de guerre en hibernation" (Cold Start 24h)

**P - PUT TO OTHER USES (Utiliser Autrement) ✅**
- Analyse IA entretiens → App standalone future
- Funnel customisable → Flexibilité même pour usage solo
- Rejet généralisation prématurée

**E - ELIMINATE (Éliminer) ✅**
- 9 features/concepts éliminés définitivement
- 1 feature reportée v2 (CMD+K)
- ~30-40% des concepts identifiés éliminés
- Focus ultra-clair validé

**R - REVERSE (Inverser) ✅**
- 5 inversions explorées
- 0 inversion retenue
- Validation du modèle classique
- CRM proactif : intéressant mais overkill

---

### Features CORE Finales (Post-SCAMPER)

**✅ MUST HAVE (MVP v1) :**

**1. Gestion Données :**
- Multi-compte avec auth Email/Password (Supabase)
- 3 tables : Prospects / Interactions / Positionnements
- Funnel customisable (config sans code)
- Import CSV LinkedIn avec gestion doublons

**2. Vues Principales :**
- Vue Prospects (liste + détail drill-down)
- Vue Interactions (timeline + ajout depuis 2 chemins)
- Vue Positionnements (variantes)
- Performance Matrix Variante × Étape Funnel (VUE CENTRALE)

**3. Analytics Data-Driven :**
- Taux conversion par étape/variante
- Bayesian Updating (comparaison baseline)
- Feu tricolore fiabilité (🔴🟡🟢)
- Drill-down détail par cellule matrix

**4. UX/Workflow :**
- Architecture hybride 3 pivots
- Drill-down contextuel inline
- Recherche simple par vue
- 2 chemins ajout interaction

**✅ NICE TO HAVE (v1 optionnel) :**
- Aucun retenu finalement (tout éliminé ou intégré en core)

**❌ EXCLUS MVP :**
- Analyse IA entretiens (app séparée future)
- Dashboard North Star
- CMD+K recherche globale
- War Mode Checklist
- CRM proactif
- Cohort Analysis
- Alertes/notifications

**⏸️ POTENTIEL v2 :**
- CMD+K recherche globale fuzzy
- CRM proactif (si besoin ressenti)
- Pont webhook vers app analyse IA

---

### Principes Directeurs Validés

1. **Simplicité > Sophistication** - Toujours
2. **Focus sur 1 problème** - CRM data-driven prospection freelance
3. **Quelques KPI significatifs > 50 KPI** - Pas d'usine à gaz
4. **Ergonomie = Gain de temps** - Priorité #1
5. **Machine de guerre en hibernation** - Cold Start 24h pour mode guerre
6. **Data pour amélioration continue** - Pas pour paralysie analytique
7. **Flexibilité sans complexité** - Funnel customisable simple
8. **Un bon produit résout UN problème vraiment bien** - Focus beats scope

---

### Statistiques Session SCAMPER

**Durée exploration :** 2 sessions (2026-01-06 + 2026-01-08)

**Concepts explorés :** ~40-50 idées/features/patterns

**Concepts retenus MVP :** ~15-20 features core

**Taux élimination :** ~30-40%

**Lettres SCAMPER complètes :** 7/7 ✅

**Décisions majeures :**
- Architecture multi-compte validée
- Funnel customisable ajouté
- Analyse IA entretiens exclu
- Performance Matrix = cœur système
- ~10 features éliminées pour simplicité

---

**Insight Global Session :** Le SCAMPER a permis d'explorer largement (divergence) puis de concentrer drastiquement (convergence). Le CRM final est ultra-focalisé, techniquement simple, et aligné sur le vrai besoin utilisateur.

**État de la session:** SCAMPER COMPLÉTÉ INTÉGRALEMENT ✅

**Prochaine étape suggérée :** Organisation des idées et création plan d'action (Step 4 du workflow brainstorming)
