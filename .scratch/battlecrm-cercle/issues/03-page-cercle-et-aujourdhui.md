# Page Cercle et blocs Cercle d'« Aujourd'hui »

Type: prototype
Status: resolved
Blocked by: 01

## Question

À quoi ressemblent la page **Cercle** (bureau, et sous « Plus » sur mobile) et les nouveaux blocs d'« Aujourd'hui » (« Alliés à relancer », « Entrées cette semaine n/5 » avec les contacts du Vivier proposés) ?

À trancher sur prototype :
- Page Cercle : compteur « Cercle 7/10 », liste triée par jours sans contact, couleur (neutre / ambre clair / ambre, jamais de rouge, jamais la couleur seule — WCAG), dernière Interaction visible, action « Prendre des nouvelles… », état vide (Cercle vide, « Ajouter au Cercle… »).
- « Aujourd'hui » : place et priorité des Alliés à relancer face aux Relances en retard ; bloc Entrées et ses 3 ou 4 propositions du Vivier, « Faire entrer » ; carte par élément sur mobile.
- Compteur ambre de la navigation : les Alliés à relancer y comptent-ils ?
- Position de « Cercle » dans la barre latérale et raccourci `G` + lettre.

## Answer

Tranché avec Romain le 2026-10-06 sur prototype. Branche `prototype/03-page-cercle`, fichier `.scratch/battlecrm-cercle/prototypes/03-page-cercle.html` (`?variant=A|B|C&ecran=today|cercle&largeur=bureau|mobile`). Retenu : **page Cercle de B, Aujourd'hui de C**.

- **Page Cercle (variante B, « Trois paliers »)** : en tête, le compteur « 7/10 » en grand avec une rangée de 10 pastilles (masquées si la Taille visée est désactivée, le compteur devient « 7 Alliés ») et « Ajouter au Cercle… ». Puis trois groupes, chacun avec son effectif : **À relancer**, **Bientôt**, **À jour**. Par Allié : nom, Organisation, Cible, dernière Interaction, une **jauge du Rythme** (remplie sur 28 j, un trait marque le début de « bientôt », couleur neutre / ambre clair / ambre), le nombre de Jours sans contact, et « Prendre des nouvelles… » (en gras pour les Alliés à relancer). Un Allié avec une Relance planifiée à venir est rangé dans À jour et l'affiche (« ⏰ Relance mer. 14 oct. ») : elle prime sur le Rythme. La couleur n'est jamais seule : le groupe donne le palier, et le nombre de jours est écrit. Mobile : même liste en cartes, avec la jauge.
- **État vide** : « 0/10 », une phrase sur ce qu'est le Cercle, « Ajouter au Cercle… » (et le rappel qu'on peut le faire depuis la fiche).
- **Aujourd'hui (variante C)** :
  - en tête, un **bandeau Entrées** : « Entrées cette semaine 2/5 » (couleur de succès une fois atteint, sans célébration), puis 3 ou 4 Contacts du Vivier tirés au hasard (nom, Organisation, dernière Étape atteinte) avec « Faire entrer ». Un Contact entré sort du bandeau sans être remplacé ;
  - les **Alliés à relancer sont mêlés aux Relances** (en retard et du jour) dans une même liste, **triée par ancienneté du retard** (pour un Allié : jours au-delà du Rythme). La ligne d'un Allié est marquée « Allié » et dit « Rythme dépassé (n j) · n j sans contact », avec l'action « Prendre des nouvelles… ». Les Essais délai dépassé restent dans leur bloc ;
  - colonne latérale : Activité du jour, puis « Cercle 7/10 » avec un lien vers la page ;
  - **mobile** : une carte par élément, la carte Entrées en premier (un Contact du Vivier, « Faire entrer » et **« Un autre »**, qui en propose un autre), puis Relances et Alliés mêlés par ancienneté du retard, puis les Essais délai dépassé. Pas de « Plus tard » sur la carte d'un Allié.
- **Navigation** : « Cercle » dans le groupe Prospection, **entre Aujourd'hui et Contacts** ; raccourci **`G E`** ; sur mobile, sous « Plus ».
- **Pastille** : seule l'entrée **Aujourd'hui** porte le compteur ambre, et il compte **les Relances, les Essais délai dépassé et les Alliés à relancer** (cohérent avec la liste mêlée). L'entrée Cercle n'a pas de pastille.

Points pour le report dans la spec UX :
- le libellé « n à traiter » couvre désormais aussi les Alliés à relancer, alors que le glossaire réserve « à traiter » aux Contacts En prospection. Revoir le libellé ou la définition ;
- la palette sans saisie, qui montre les Contacts à traiter, devrait sans doute montrer aussi les Alliés à relancer, par cohérence avec la pastille ;
- « Un autre » sur la carte Entrées du mobile est un ajout au tirage : le bureau montre 3 ou 4 propositions, le mobile une seule à la fois.
