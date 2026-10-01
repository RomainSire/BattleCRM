# BattleCRM

CRM pour prestataires de services (développeurs freelance) qui prospectent des clients finaux et des ESN, et qui A/B testent leurs façons de se présenter pour trouver, avec peu de contacts, celle qui marche le mieux.

## Language

L'interface est bilingue (anglais US) : la ligne `_EN_` de chaque terme donne son équivalent anglais, ses valeurs et les termes anglais à éviter.

### Prospection

**Contact**:
Une personne prospectée, que l'on fait avancer dans le Funnel et sur qui l'on teste des Positionnements. Un Contact peut participer à plusieurs Battles successives d'une même Étape (retour en arrière, reprospection). Rattachée à 0 ou 1 Organisation ; peut porter l'URL de son profil LinkedIn, qui l'identifie : deux Contacts d'un Utilisateur ne peuvent pas avoir la même. Changer d'Organisation change sa Cible, sans toucher l'Essai en cours. Un nouveau Contact entre à la première Étape du Funnel, dans l'État actif.
_EN_: Contact (avoid: prospect, lead, client)
_Avoid_: Prospect, lead, client

**État**:
La situation d'un Contact vis-à-vis de la prospection, distincte de son Étape : actif, en pause, clos (la prospection s'arrête sans aboutir, avec un motif optionnel) ou gagné (l'objectif de la prospection est atteint, par ex. mission signée). Clos et gagné ne sont pas des Étapes : le Contact garde la dernière Étape atteinte, ce qui montre où il est sorti du Funnel. Tout Contact peut redevenir actif, à son Étape actuelle, ou à une Étape choisie si celle-ci est archivée. Chaque changement d'État est enregistré comme une Interaction. Seul un Contact actif peut avoir un Essai en cours : quitter l'État actif oblige à régler l'Essai en cours.
_EN_: Status; values Active, Paused, Dropped, Won (avoid: closed, lost, state)
_Avoid_: Statut, situation, perdu

**Organisation**:
La société pour laquelle travaille un Contact, avec un nom et un type : ESN ou client final. Le type d'Organisation définit la Cible du Contact : le changer change la Cible de tous ses Contacts, mais les Essais déjà commencés gardent la leur. Deux Organisations d'un Utilisateur ne peuvent pas porter le même nom, à la casse, aux accents et aux espaces près ; deux Organisations créées en double se fusionnent. Une Organisation sans Contact subsiste jusqu'à ce qu'on la supprime.
_EN_: Organization (avoid: company, account)
_Avoid_: Société, entreprise, compte

**Cible**:
Le type de destinataire d'un Contact : ESN, client final, ou inconnue si le Contact n'a pas d'Organisation. Une Battle mélange les Cibles par défaut, mais peut être restreinte à une seule.
_EN_: Target; values Consultancy (ESN), End client, Unknown (avoid: segment, persona)
_Avoid_: Segment, persona

**Funnel**:
La suite ordonnée d'Étapes, configurée par l'Utilisateur, que traverse un Contact. Un seul Funnel par Utilisateur ; un Contact peut sauter des Étapes. Il garde toujours au moins une Étape non archivée ; un nouveau Contact entre à la première Étape non archivée du moment. Réordonner les Étapes ne déplace aucun Contact et ne réécrit pas l'historique : le sens « avant / arrière » d'un changement d'Étape se lit dans l'ordre en vigueur au moment où il a lieu. Une Étape ajoutée n'a rien de rétroactif : les Contacts déjà plus loin l'ont sautée.
_EN_: Funnel (avoid: pipeline, tunnel)
_Avoid_: Pipeline, tunnel

**Étape**:
Un palier du Funnel (par ex. « premier contact », « CV envoyé », « entretien »). Son identité ne dépend pas de son nom : la renommer s'applique partout, historique compris. Elle peut porter un But. Une Étape qui a servi (un Contact y est passé, ou elle porte un Positionnement ou une Battle) n'est jamais supprimée, elle est **archivée** : elle sort du Funnel, mais ses Positionnements, ses Battles et son Historique des Champions restent consultables, et elle peut être restaurée telle quelle. On ne peut archiver une Étape ni pendant qu'elle a une Battle ouverte, ni tant qu'un Contact actif ou en pause s'y trouve ; un Contact clos ou gagné garde une Étape archivée comme dernière Étape atteinte.
_EN_: Stage; archived Stage (avoid: step, phase, status)
_Avoid_: Stage, phase, statut

**But**:
Ce qui fait franchir une Étape, en texte libre et facultatif (par ex. « CV à envoyer », « entretien ESN à obtenir »). Il sert de point de départ au Critère de succès d'une Battle de cette Étape, sans le lier : le modifier ne touche aucune Battle.
_EN_: Aim (avoid: goal, objective)
_Avoid_: Objectif (réservé à l'Objectif d'activité), Critère de succès

**Taux de passage**:
La part des Contacts arrivés à une Étape qui ont ensuite atteint une Étape plus loin, qu'ils aient sauté des Étapes ou non. « Plus loin » se lit dans l'ordre en vigueur au moment du changement d'Étape, comme pour le Funnel. Une Étape archivée n'a pas de Taux de passage. Il décrit le Funnel, jamais l'Utilisateur, et n'est pas un taux de succès.
_EN_: Pass-through rate (avoid: conversion rate)
_Avoid_: Taux de conversion

**Interaction**:
Un événement daté concernant un Contact, sortant (ce que l'Utilisateur a fait) ou entrant (ce que le Contact a fait). Elle est rattachée au Contact, pas à un Essai : les Interactions d'un Essai sont celles du Contact pendant sa durée. Chaque utilisation d'un Positionnement, chaque changement d'Étape et chaque changement d'État est enregistré comme une Interaction, ce qui conserve l'historique de son parcours dans le Funnel. Sa date peut précéder sa saisie.
_EN_: Interaction (avoid: activity, note, log)
_Avoid_: Activité, note, log

**Relance**:
Une Interaction sortante planifiée à une date future sur un Contact : planifiée, faite (datée du jour où elle a été faite, elle devient alors une Interaction comme une autre) ou annulée. Elle appartient au Contact, ne référence jamais de Positionnement et ne crée jamais d'Essai. Elle peut porter une note libre (la raison de relancer, ce qui a été dit), qui reste sur l'Interaction une fois la Relance faite. Un Contact a au plus une Relance planifiée : en planifier une autre revient à modifier celle-ci, qui garde son rang. Une Relance planifiée dont la date est passée est signalée « en retard » ; rien n'est automatique.
_EN_: Follow-up; values Scheduled, Done, Canceled; signal Overdue (avoid: reminder, task)
_Avoid_: Rappel, tâche, follow-up

**Cadence de relance**:
La façon de relancer un Contact qui ne répond pas après l'utilisation d'un Positionnement : une suite d'intervalles, chacun compté depuis la dernière Interaction sortante faite, puis le Délai de réponse (par défaut +3, +7, +14 jours, puis 14 jours). Chaque rang peut porter un message de relance. Tant que la Cadence court, la Relance d'un rang montre le message de ce rang, lu depuis la dernière utilisation d'un Positionnement sur le Contact ; une Relance hors Cadence (ajoutée à la main, après le dernier rang ou après une Interaction entrante) n'a pas de message. Elle fait partie du Positionnement, peut donc être l'objet d'une Battle, et elle est figée avec lui. L'app planifie les Relances une à la fois ; pour un Contact donné, l'Utilisateur peut en sauter ou en ajouter, ce qui est tracé comme un écart sur l'Essai. Une Interaction entrante arrête la Cadence : l'app ne planifie plus de Relance d'elle-même, et l'Utilisateur peut toujours en planifier une à la main.
_EN_: Follow-up cadence (avoid: sequence, automated follow-ups)
_Avoid_: Séquence, relances automatiques

**Cadence par défaut**:
La Cadence de relance qu'un Utilisateur se donne pour pré-remplir un nouveau Positionnement qui n'est dérivé d'aucun autre : des intervalles et un Délai de réponse, sans message. La modifier ne touche aucun Positionnement existant.
_EN_: Default follow-up cadence

### A/B testing

**Positionnement**:
Une façon de se présenter et de relancer, rattachée à une Étape précise (par ex. « CV A », « mail d'accroche B ») : un libellé, une description et des pièces jointes optionnelles, et une Cadence de relance avec un message facultatif par rang (pré-remplie depuis le Positionnement dont il est dérivé, sinon avec la Cadence par défaut). Il fixe le canal utilisé (deux canaux = deux Positionnements). Figé dès son premier Essai, messages de relance compris (seule une faute de frappe dans le libellé reste corrigible) : le modifier revient à créer une **copie modifiée**, un nouveau Positionnement qui indique de quel Positionnement il est dérivé. Un Positionnement battu est archivé ; l'Utilisateur peut aussi archiver à la main un Positionnement qui n'est ni Champion ni dans une Battle ouverte. Un Positionnement archivé reste consultable, peut être désarchivé et peut revenir plus tard comme Challenger. Seul un Positionnement jamais utilisé peut être supprimé ; une fois utilisé, on l'archive. Le Challenger d'une Battle abandonnée n'est pas battu : il reste disponible. Ne tester qu'une chose à la fois relève de la responsabilité de l'Utilisateur.
_EN_: Positioning; modified copy (avoid: pitch, template, variant, version)
_Avoid_: Variante, template, pitch

**Battle**:
La confrontation de deux Positionnements d'une même Étape, le Champion et un Challenger, qui se termine par un Verdict. L'Utilisateur l'ouvre explicitement et confirme sa clôture ; une Étape a au plus une Battle ouverte, mais plusieurs Étapes peuvent en avoir une en même temps. Les Essais d'une Battle ne sont jamais cumulés avec ceux d'une autre. Elle compare les Positionnements parmi les Contacts qui atteignent son Étape, quels que soient les Positionnements qu'ils ont reçus aux Étapes précédentes.
_EN_: Battle (avoid: A/B test, experiment, campaign)
_Avoid_: A/B test, expérience, campagne

**Champion**:
Le Positionnement vainqueur de la dernière Battle d'une Étape ; il défend son titre face au Challenger suivant. Avant la première Battle d'une Étape, l'Utilisateur désigne un Champion initial (en général ce qu'il utilise déjà).
_EN_: Champion

**Historique des Champions**:
La succession des Champions d'une Étape, Battle après Battle, avec le Verdict et l'Enseignement de chaque Battle ; elle montre la progression de l'Utilisateur. Elle distingue ce que les données ont prouvé de ce que l'Utilisateur a désigné.
_EN_: Champion history; winners marked Proven or Designated

**Enseignement**:
Une note libre et optionnelle sur une Battle close : ce que l'Utilisateur en retient, quel que soit le Verdict. Saisie à la clôture et modifiable ensuite, elle figure dans l'Historique des Champions et n'entre dans aucun calcul.
_EN_: Takeaway (avoid: conclusion, comment, lesson)
_Avoid_: Conclusion, commentaire

**Challenger**:
Un nouveau Positionnement opposé au Champion dans une Battle.
_EN_: Challenger

**Essai**:
L'exposition d'un Contact à un Positionnement dans le cadre d'une Battle, qui commence avec l'Interaction qui enregistre l'utilisation du Positionnement, à sa date. Son issue est en cours, succès, sans suite (silence ou refus) ou annulé (avec un motif). Chaque Essai réussi ou sans suite est un point de donnée neutre de la Battle ; un Essai annulé n'est pas compté. Un Contact a au plus un Essai en cours, et jamais deux Essais dans la même Battle. Sans Battle ouverte, utiliser un Positionnement est enregistré comme Interaction mais ne crée pas d'Essai. L'issue reste modifiable tant que la Battle est ouverte ; à la clôture, un Essai encore en cours passe en annulé (motif « Battle clôturée »). L'Essai retient la Cible du Contact au moment où il commence. Seul un Contact actif peut commencer un Essai.
_EN_: Trial; Outcome values In progress, Success, No result, Canceled (avoid: test, attempt, failure)
_Avoid_: Battle unitaire, test, tentative, échec (pour l'issue)

**Règle de victoire**:
La règle qui rend une Battle concluante : un Positionnement a au moins le seuil de confiance (0,85 par défaut) d'être meilleur que l'autre, une fois atteint le minimum de 10 Essais terminés par Positionnement et de 5 succès au total. Seuil et Horizon sont fixés à l'ouverture de la Battle puis figés. L'app signale qu'une Battle est concluante, mais c'est l'Utilisateur qui la clôt ; il peut aussi déclarer un vainqueur sans que la règle soit satisfaite, après avertissement.
_EN_: Win rule; Confidence threshold (avoid: significance, statistical test)
_Avoid_: Significativité, test statistique

**Horizon**:
Le nombre maximal d'Essais commencés (hors annulés) par Positionnement dans une Battle (25 par défaut). Atteint sans vainqueur, il conclut la Battle sur une égalité.
_EN_: Horizon

**Verdict**:
L'issue d'une Battle close : victoire du Challenger (il devient Champion), titre défendu, égalité, données insuffisantes (Horizon atteint avec moins de 3 succès au total) ou abandonnée (la Battle n'a rien appris sur les Positionnements). Sauf victoire du Challenger, le Champion garde son titre. Un vainqueur déclaré par l'Utilisateur sans que la Règle de victoire soit satisfaite est marqué « désigné par l'Utilisateur ».
_EN_: Verdict; values Challenger wins, Title defended, Draw, Not enough data, Abandoned; Designated (avoid: result, conclusion)
_Avoid_: Résultat, conclusion

**Critère de succès**:
Ce qui fait d'un Essai un succès dans une Battle donnée (par ex. « a répondu positivement »), fixé à l'ouverture de la Battle et inchangé ensuite. L'Utilisateur valide chaque succès à la main au regard de ce critère.
_EN_: Success criterion

**Délai de réponse**:
L'attente après la dernière Relance prévue par la Cadence de relance, dont il fait partie (14 jours par défaut), ou après l'Interaction entrante qui a arrêté la Cadence, au-delà de laquelle un Essai en cours sans nouvelle Interaction est signalé « délai dépassé ». Tant que la Cadence n'est pas épuisée, un silence appelle la Relance suivante, pas ce signal. Le délai ne tranche rien : c'est l'Utilisateur qui confirme que l'Essai est sans suite.
_EN_: Response window; signal Window elapsed

### Activité

**Action de prospection**:
Une utilisation de Positionnement ou une Relance faite : ce qui dépend de l'Utilisateur. Les Interactions entrantes et les changements d'Étape ou d'État n'en sont pas.
_EN_: Prospecting action (avoid: task, effort)
_Avoid_: Tâche, effort

**Activité**:
Le nombre d'Actions de prospection d'un Utilisateur par jour, comptées à la date de l'Interaction (pas à sa saisie), dans le fuseau horaire de l'Utilisateur. Le total d'une semaine en découle, sans objectif propre. Un jour sans Action de prospection est simplement vide : il n'existe pas de jour « off ».
_EN_: Activity (avoid: score, streak)
_Avoid_: Score, streak

**Objectif d'activité**:
Le nombre d'Actions de prospection par jour que l'Utilisateur se fixe : un seul par Utilisateur, 1 par défaut, désactivable. Une modification s'applique à partir du lendemain, sans effet sur les jours passés, dont les valeurs en vigueur sont conservées. Atteindre l'Objectif est célébré ; ne pas l'atteindre n'a aucune conséquence et n'est jamais enregistré comme tel : seuls le réalisé et l'objectif du jour sont retenus.
_EN_: Activity goal (avoid: quota, target)
_Avoid_: Quota, cible

### Comptes

**Utilisateur**:
Un freelance qui possède son propre Funnel, ses Contacts et ses Battles, isolés de ceux des autres Utilisateurs.
_EN_: User (avoid: account, member)
_Avoid_: Compte, membre
