# BattleCRM

CRM pour prestataires de services (développeurs freelance) qui prospectent des clients finaux et des ESN, et qui A/B testent leurs façons de se présenter pour trouver, avec peu de contacts, celle qui marche le mieux.

## Language

L'interface est bilingue (anglais US) : la ligne `_EN_` de chaque terme donne son équivalent anglais, ses valeurs et les termes anglais à éviter.

### Prospection

**Contact**:
Une personne prospectée, que l'on fait avancer dans le Funnel et sur qui l'on teste des Positionnements. Un Contact peut participer à plusieurs Battles successives d'une même Étape (retour en arrière, reprospection). Rattachée à 0 ou 1 Organisation. Seul son nom est obligatoire ; il peut porter un poste, un e-mail, un téléphone, une note libre et l'URL de son profil LinkedIn, qui l'identifie : deux Contacts d'un Utilisateur ne peuvent pas avoir la même (un même nom, e-mail ou téléphone est permis). Changer d'Organisation change sa Cible, sans toucher l'Essai en cours, et n'est pas une Interaction. Un nouveau Contact est ajouté au Vivier par défaut ; il peut aussi être ajouté directement En prospection (c'est une Entrée dans le Funnel) ou Allié. Supprimer un Contact l'anonymise : son nom, ses coordonnées et ses notes sont effacés, mais ses Essais et Interactions restent, sous « Contact supprimé » ; son Essai en cours passe en annulé (motif « Contact supprimé ») et sa Relance planifiée est annulée.
_EN_: Contact (avoid: prospect, lead, client)
_Avoid_: Prospect, lead, client

**État**:
La situation d'un Contact vis-à-vis de la prospection, distincte de son Étape : au Vivier, En prospection, Allié ou Archivé. Seul un Contact En prospection est dans le Funnel : lui seul change d'Étape, a une Relance de Cadence, un Tirage ou un Essai en cours. Les autres États ne sont pas des Étapes : le Contact garde la dernière Étape atteinte, s'il en a une, ce qui montre où il est sorti du Funnel. Rien n'est définitif : tout État peut revenir à tout autre, avec un motif optionnel. Revenir En prospection est une Entrée dans le Funnel, à la dernière Étape atteinte ou à une Étape choisie (obligatoire si elle est archivée ou s'il n'en a pas). Quitter En prospection oblige à régler l'Essai en cours et annule la Relance planifiée. Chaque changement d'État est enregistré comme une Interaction.
_EN_: Status; values Pool, Prospecting, Ally, Archived (avoid: active, paused, closed, won, lost, state)
_Avoid_: Statut, situation, actif, en pause, clos, gagné, perdu

**Vivier**:
L'État d'un Contact que l'on pourrait prospecter mais qui ne l'est pas, ou plus : l'État par défaut d'un nouveau Contact, et celui où l'on remet un Contact resté silencieux. Le Vivier n'est pas une Étape et n'est pas dans le Funnel ; un Contact du Vivier n'a aucune Relance.
_EN_: Pool (avoid: backlog, cold list, paused)
_Avoid_: Réserve, en pause, dormant

**En prospection**:
L'État d'un Contact que l'on fait avancer dans le Funnel, à une Étape.
_EN_: Prospecting (avoid: active, in progress)
_Avoid_: Actif, en cours

**Allié**:
L'État d'un Contact avec qui l'Utilisateur entretient la relation dans la durée pour qu'il lui fasse remonter des missions, même pendant une mission. On l'y fait entrer à la main (« Ajouter au Cercle »), depuis tout État : en général après un Essai réussi à la dernière Étape, ou parce qu'il fait déjà partie du réseau. Un Allié ne change pas d'Étape, n'a ni Cadence, ni Tirage, ni Essai ; il peut avoir une Relance planifiée facultative. Il reste Allié quand il propose une mission : elle se suit par ses Interactions.
_EN_: Ally (avoid: won, customer, partner, friend)
_Avoid_: Gagné, client, partenaire

**Cercle d'alliés**:
L'ensemble des Alliés d'un Utilisateur, toutes Cibles confondues. On dit « le Cercle ».
_EN_: Circle of allies; the Circle (avoid: network, inner circle)
_Avoid_: Réseau

**Archivé**:
L'État d'un Contact sorti de la prospection parce qu'il est hors sujet (un « no go », la personne a changé de métier) : caché par défaut, sans Relance, et réactivable comme une Étape ou un Positionnement archivé. Un silence se range au Vivier, pas en Archivé.
_EN_: Archived (avoid: closed, dropped, lost)
_Avoid_: Clos, perdu

**Entrée dans le Funnel**:
Le passage d'un Contact En prospection, à une Étape : depuis tout autre État (réentrées comprises) ou dès son ajout. Elle est datée de son enregistrement et comptée, comme l'Activité, dans le fuseau horaire de l'Utilisateur en vigueur ce jour-là. Chaque passage compte : un Contact qui entre deux fois dans la semaine fait deux Entrées. Les Étapes qui précèdent celle d'entrée ne comptent pas comme sautées.
_EN_: Funnel entry (avoid: activation, enrollment)
_Avoid_: Activation, inscription

**Organisation**:
La société pour laquelle travaille un Contact, avec un nom et un type : ESN ou client final. Le type d'Organisation définit la Cible du Contact : le changer change la Cible de tous ses Contacts, mais les Essais déjà commencés gardent la leur. Deux Organisations d'un Utilisateur ne peuvent pas porter le même nom, à la casse, aux accents et aux espaces près ; deux Organisations créées en double se fusionnent. Une Organisation sans Contact subsiste jusqu'à ce qu'on la supprime.
_EN_: Organization (avoid: company, account)
_Avoid_: Société, entreprise, compte

**Cible**:
Le type de destinataire d'un Contact : ESN, client final, ou inconnue si le Contact n'a pas d'Organisation. Une Battle mélange les Cibles par défaut, mais peut être restreinte à une seule.
_EN_: Target; values Consultancy (ESN), End client, Unknown (avoid: segment, persona)
_Avoid_: Segment, persona

**Funnel**:
La suite ordonnée d'Étapes, configurée par l'Utilisateur, que traverse un Contact. Un seul Funnel par Utilisateur ; un Contact peut sauter des Étapes. Il garde toujours au moins une Étape non archivée ; un Contact qui n'a jamais atteint d'Étape y entre par défaut à la première Étape non archivée du moment. Le Vivier, le Cercle et les Contacts archivés n'en font pas partie. Réordonner les Étapes ne déplace aucun Contact et ne réécrit pas l'historique : le sens « avant / arrière » d'un changement d'Étape se lit dans l'ordre en vigueur au moment où il a lieu. Une Étape ajoutée n'a rien de rétroactif : les Contacts déjà plus loin l'ont sautée.
_EN_: Funnel (avoid: pipeline, tunnel)
_Avoid_: Pipeline, tunnel

**Étape**:
Un palier du Funnel (par ex. « premier contact », « CV envoyé », « entretien »). Son identité ne dépend pas de son nom : la renommer s'applique partout, historique compris. Elle peut porter un But. Une Étape qui a servi (un Contact y est passé, ou elle porte un Positionnement ou une Battle) n'est jamais supprimée, elle est **archivée** : elle sort du Funnel, mais ses Positionnements, ses Battles et son Historique des Champions restent consultables, et elle peut être restaurée telle quelle, à sa place d'avant (juste après l'Étape qui la précédait, si celle-ci est encore dans le Funnel, sinon en fin de Funnel). On ne peut archiver une Étape ni pendant qu'elle a une Battle ouverte, ni tant qu'un Contact En prospection s'y trouve ; un Contact d'un autre État garde une Étape archivée comme dernière Étape atteinte.
_EN_: Stage; archived Stage (avoid: step, phase, status)
_Avoid_: Stage, phase, statut

**Étapes types**:
Les quatre Étapes, avec leur But, dont part le Funnel de tout nouvel Utilisateur : Approche, Qualif ESN, Qualif Client, Closing. Écrites à la création du compte dans la langue de l'inscription, puis jamais traduites : ce sont des Étapes comme les autres.
_EN_: Standard stages (avoid: default stages, template)
_Avoid_: Étapes par défaut, modèle

**But**:
Ce qui fait franchir une Étape, en texte libre et facultatif (par ex. « CV à envoyer », « entretien ESN à obtenir »). Il sert de point de départ au Critère de succès d'une Battle de cette Étape, sans le lier : le modifier ne touche aucune Battle.
_EN_: Aim (avoid: goal, objective)
_Avoid_: Objectif (réservé à l'Objectif d'activité), Critère de succès

**Taux de passage**:
La part des Contacts arrivés à une Étape qui ont ensuite atteint une Étape plus loin, qu'ils aient sauté des Étapes ou non. « Plus loin » se lit dans l'ordre en vigueur au moment du changement d'Étape, comme pour le Funnel. Une Étape archivée n'a pas de Taux de passage. Il décrit le Funnel, jamais l'Utilisateur, et n'est pas un taux de succès.
_EN_: Pass-through rate (avoid: conversion rate)
_Avoid_: Taux de conversion

**Interaction**:
Un événement daté concernant un Contact, sortant (ce que l'Utilisateur a fait) ou entrant (ce que le Contact a fait). Elle est rattachée au Contact, pas à un Essai : les Interactions d'un Essai sont celles du Contact pendant sa durée. Chaque utilisation d'un Positionnement, l'ajout du Contact, chaque changement d'Étape et chaque changement d'État (dont l'Entrée dans le Funnel) est enregistré comme une Interaction, ce qui conserve l'historique de son parcours. L'ajout et les changements d'Étape ou d'État ne sont ni sortants ni entrants : ils ne touchent ni la Cadence de relance, ni le Délai de réponse, ni les Jours sans contact. Une Interaction entrante, la réponse du Contact, ne porte aucune nature (positive, négative) : seule l'issue de l'Essai qualifie une réponse. Une Interaction sortante ou entrante est dite faite. Sa date peut précéder sa saisie.
_EN_: Interaction (avoid: activity, note, log) ; sortante *outbound*, entrante *inbound* ou *reply*, faite *done*
_Avoid_: Activité, note, log

**Canal**:
Le moyen par lequel l'Utilisateur et un Contact échangent : e-mail, LinkedIn, téléphone ou courrier. Un Positionnement en fixe un seul ; une Interaction entrante porte celui de la réponse.
_EN_: Channel (avoid: medium, method)
_Avoid_: Média, moyen

**Relance**:
Une Interaction sortante planifiée à une date future sur un Contact : planifiée, faite (datée du jour où elle a été faite, elle devient alors une Interaction comme une autre) ou annulée. Elle appartient au Contact, ne référence jamais de Positionnement et ne crée jamais d'Essai. Elle peut porter une note libre (la raison de relancer, ce qui a été dit), qui reste sur l'Interaction une fois la Relance faite. Un Contact a au plus une Relance planifiée : en planifier une autre revient à modifier celle-ci, qui garde son rang. Seuls un Contact En prospection et un Allié en ont ; quitter En prospection l'annule, comme passer au Vivier ou en Archivé. Une Relance planifiée dont la date est passée est signalée « en retard » ; rien n'est automatique.
_EN_: Follow-up; values Scheduled, Done, Canceled; signal Overdue (avoid: reminder, task)
_Avoid_: Rappel, tâche, follow-up

**Cadence de relance**:
La façon de relancer un Contact qui ne répond pas après l'utilisation d'un Positionnement : une suite d'intervalles, chacun compté depuis la dernière Interaction sortante faite, puis le Délai de réponse (par défaut +3, +7, +14 jours, puis 14 jours). Chaque rang peut porter un message de relance. Tant que la Cadence court, la Relance d'un rang montre le message de ce rang, lu depuis la dernière utilisation d'un Positionnement sur le Contact ; une Relance hors Cadence (ajoutée à la main, après le dernier rang ou après une Interaction entrante) n'a pas de message. Elle fait partie du Positionnement, peut donc être l'objet d'une Battle, et elle est figée avec lui. L'app planifie les Relances une à la fois ; pour un Contact donné, l'Utilisateur peut en sauter ou en ajouter, ce qui est tracé comme un écart sur l'Essai. Une Interaction entrante arrête la Cadence : l'app ne planifie plus de Relance d'elle-même, et l'Utilisateur peut toujours en planifier une à la main.
_EN_: Follow-up cadence (avoid: sequence, automated follow-ups)
_Avoid_: Séquence, relances automatiques

**Cadence par défaut**:
La Cadence de relance qu'un Utilisateur se donne pour pré-remplir un nouveau Positionnement qui n'est dérivé d'aucun autre : des intervalles et un Délai de réponse, sans message. La modifier ne touche aucun Positionnement existant.
_EN_: Default follow-up cadence

**À traiter**:
Se dit d'un Contact En prospection qui appelle un geste aujourd'hui : une Relance planifiée du jour ou en retard, ou un Essai « délai dépassé ». Un Contact En prospection est à traiter, sinon en attente, sinon sans prochaine action. Un Allié qui appelle un geste est « à relancer » (voir Rythme des Alliés).
_EN_: Needs action (avoid: due, todo)
_Avoid_: Urgent, à faire

**En attente**:
Se dit d'un Contact En prospection dont la suite est à venir : une Relance planifiée plus tard, un Essai en cours dans les temps, ou une Étape qui ne porte aucun Positionnement.
_EN_: Waiting (avoid: pending, on hold)
_Avoid_: En pause

**Sans prochaine action**:
Se dit d'un Contact En prospection sans Relance planifiée ni Essai en cours, dans une Étape qui porte au moins un Positionnement : rien ne le ramènera de lui-même devant l'Utilisateur.
_EN_: No next step (avoid: idle, inactive, stale)
_Avoid_: Inactif, dormant

### Cercle d'alliés

**Jours sans contact**:
Le nombre de jours écoulés depuis la dernière Interaction faite, sortante ou entrante, avec un Allié, comptés dans le fuseau horaire de l'Utilisateur. Les changements d'Étape ou d'État n'en sont pas, sauf pour un Allié qui n'a encore aucune Interaction faite : ses Jours sans contact se comptent alors depuis son entrée au Cercle.
_EN_: Days since contact (avoid: days idle, last touch)
_Avoid_: Inactivité

**Rythme des Alliés**:
L'intervalle auquel l'Utilisateur veut prendre des nouvelles de chaque Allié (28 jours par défaut), un seul réglage pour tout le Cercle. Selon ses Jours sans contact, un Allié est sans signal, « bientôt » dans les 7 derniers jours du Rythme, puis « à relancer » au-delà. Une Relance planifiée sur un Allié prime sur le Rythme : c'est elle qui le rappelle à sa date. Rien n'est automatique : le Rythme ne planifie aucune Relance.
_EN_: Check-in rhythm; signals Check in soon, Time to check in (avoid: cadence, frequency, SLA)
_Avoid_: Cadence (réservé à la Cadence de relance), fréquence

**Prise de nouvelles**:
Une Interaction sortante faite auprès d'un Allié, hors Positionnement et hors Relance : un message, un appel, un café. Elle ne crée aucun Essai et n'entre dans aucune Battle.
_EN_: Check-in (avoid: touchpoint, ping, follow-up)
_Avoid_: Relance (réservé à la Relance), suivi

**Taille visée du Cercle**:
Le nombre d'Alliés que l'Utilisateur souhaite entretenir (10 par défaut), désactivable. Il sert de repère (« Cercle 7/10 ») : l'atteindre ou non n'a aucune conséquence.
_EN_: Circle size goal (avoid: target, quota, limit)
_Avoid_: Cible (réservé à la Cible), quota, limite

### A/B testing

**Positionnement**:
Une façon de se présenter et de relancer, rattachée à une Étape précise (par ex. « CV A », « mail d'accroche B ») : un libellé, une description et des pièces jointes optionnelles, et une Cadence de relance avec un message facultatif par rang (pré-remplie depuis le Positionnement dont il est dérivé, sinon avec la Cadence par défaut). Il fixe le canal utilisé (deux canaux = deux Positionnements). Figé dès son premier Essai, messages de relance compris (seule une faute de frappe dans le libellé reste corrigible) : le modifier revient à créer une **copie modifiée**, un nouveau Positionnement qui indique de quel Positionnement il est dérivé. Dupliquer un Positionnement, même jamais utilisé, crée aussi une copie modifiée. Un Positionnement battu est archivé ; l'Utilisateur peut aussi archiver à la main un Positionnement qui n'est ni Champion ni dans une Battle ouverte. Un Positionnement archivé reste consultable, peut être désarchivé et peut revenir plus tard comme Challenger. Seul un Positionnement jamais utilisé peut être supprimé ; une fois utilisé, on l'archive. Le Challenger d'une Battle abandonnée n'est pas battu : il reste disponible. Ne tester qu'une chose à la fois relève de la responsabilité de l'Utilisateur.
_EN_: Positioning; modified copy; frozen; lineage (an original and its modified copies, shown under it) (avoid: pitch, template, variant, version)
_Avoid_: Variante, template, pitch

**Battle**:
La confrontation de deux Positionnements d'une même Étape, le Champion et un Challenger, qui se termine par un Verdict. L'Utilisateur l'ouvre explicitement et confirme sa clôture ; une Étape a au plus une Battle ouverte, mais plusieurs Étapes peuvent en avoir une en même temps. Les Essais d'une Battle ne sont jamais cumulés avec ceux d'une autre. Elle compare les Positionnements parmi les Contacts qui atteignent son Étape, quels que soient les Positionnements qu'ils ont reçus aux Étapes précédentes.
_EN_: Battle (avoid: A/B test, experiment, campaign)
_Avoid_: A/B test, expérience, campagne

**Tirage**:
Le Positionnement qu'une Battle ouverte attribue au hasard à un Contact de son Étape, en équilibrant les deux Positionnements parmi les Contacts de la même Cible ; un Positionnement qui a atteint l'Horizon n'est plus tiré. Révélé quand l'Utilisateur s'apprête à utiliser un Positionnement, il reste réservé au Contact, sans jamais être refait, tant que la Battle est ouverte et que le Contact reste En prospection à cette Étape. Utiliser l'autre Positionnement est une **dérogation**, permise et tracée sur l'Essai avec un motif optionnel.
_EN_: Assignment; Override (avoid: draw, suggestion, randomization)
_Avoid_: Attribution, suggestion, proposition

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
L'exposition d'un Contact à un Positionnement dans le cadre d'une Battle, qui commence avec l'Interaction qui enregistre l'utilisation du Positionnement, à sa date. Son issue est en cours, succès, sans suite (silence ou refus) ou annulé (avec un motif). Chaque Essai réussi ou sans suite est un point de donnée neutre de la Battle ; un Essai annulé n'est pas compté. Un Contact a au plus un Essai en cours, et jamais deux Essais dans la même Battle. Utiliser un Positionnement est enregistré comme Interaction mais ne crée pas d'Essai quand l'Étape n'a pas de Battle ouverte, quand le Contact n'est pas En prospection, n'est pas dans la Cible d'une Battle restreinte ou a déjà un Essai dans cette Battle, ou quand les deux Positionnements ont atteint l'Horizon. Un Essai dont le Positionnement n'est pas celui du Tirage porte une dérogation. L'issue reste modifiable tant que la Battle est ouverte ; à la clôture, un Essai encore en cours passe en annulé (motif « Battle clôturée »). L'Essai retient la Cible du Contact au moment où il commence. Seul un Contact En prospection peut commencer un Essai.
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
L'attente, une fois la Cadence de relance épuisée ou arrêtée, au-delà de laquelle un Essai en cours est signalé « délai dépassé » (14 jours par défaut). Il fait partie de la Cadence et se compte depuis la dernière Interaction sortante faite ou entrante : la dernière Relance prévue, l'Interaction entrante qui a arrêté la Cadence, ou toute Interaction sortante ou entrante survenue depuis. Tant que la Cadence n'est pas épuisée, un silence appelle la Relance suivante, pas ce signal. Le délai ne tranche rien : c'est l'Utilisateur qui confirme que l'Essai est sans suite.
_EN_: Response window; signal Window elapsed

### Activité

**Action de prospection**:
Une utilisation de Positionnement, une Relance faite ou une Prise de nouvelles : ce qui dépend de l'Utilisateur. Les Interactions entrantes et les changements d'Étape ou d'État n'en sont pas.
_EN_: Prospecting action (avoid: task, effort)
_Avoid_: Tâche, effort

**Activité**:
Le nombre d'Actions de prospection d'un Utilisateur par jour, comptées à la date de l'Interaction (pas à sa saisie), dans le fuseau horaire de l'Utilisateur en vigueur ce jour-là : un changement de fuseau s'applique à partir du lendemain, sans recompter les jours passés. Le total d'une semaine en découle, sans objectif propre. Un jour sans Action de prospection est simplement vide : il n'existe pas de jour « off ».
_EN_: Activity (avoid: score, streak)
_Avoid_: Score, streak

**Objectif d'activité**:
Le nombre d'Actions de prospection par jour que l'Utilisateur se fixe : un seul par Utilisateur, 1 par défaut, désactivable. Une modification s'applique à partir du lendemain, sans effet sur les jours passés, dont les valeurs en vigueur sont conservées. Atteindre l'Objectif est célébré ; ne pas l'atteindre n'a aucune conséquence et n'est jamais enregistré comme tel : seuls le réalisé et l'objectif du jour sont retenus.
_EN_: Activity goal (avoid: quota, target)
_Avoid_: Quota, cible

**Objectif d'entrées**:
Le nombre d'Entrées dans le Funnel par semaine, du lundi au dimanche, que l'Utilisateur se fixe : un seul par Utilisateur, 5 par défaut (une par jour ouvré), désactivable. Une modification, désactivation comprise, s'applique à partir du lundi suivant, sans effet sur les semaines passées, dont les valeurs en vigueur sont conservées. Il peut être dépassé. L'atteindre n'est pas célébré (seul l'Objectif d'activité l'est) ; ne pas l'atteindre n'a aucune conséquence et n'est jamais enregistré comme tel. Désactivé, les Entrées restent comptées.
_EN_: Entry goal (avoid: quota, target)
_Avoid_: Quota, cible

### Comptes

**Utilisateur**:
Un freelance qui possède son propre Funnel, ses Contacts et ses Battles, isolés de ceux des autres Utilisateurs.
_EN_: User (avoid: account, member; *account* only for the User's sign-in access, as in French)
_Avoid_: Compte, membre (« compte » ne désigne que l'accès d'un Utilisateur, son e-mail et son mot de passe, dans les écrans de connexion et la section Compte des Réglages)
