# Reporter la refonte des États dans la spec UX

Type: task
Status: resolved
Blocked by: 01, 02, 03, 04

## Question

Mettre la [spec UX](../../battlecrm-ux/spec.md) en accord avec le glossaire amendé et les tickets de cette carte, puis faire relire par Romain.

À couvrir : navigation (entrée Cercle, mobile sous « Plus », raccourcis, palette), inventaire des écrans, Aujourd'hui, Funnel (Vivier hors kanban, zones et filtre d'État), fiche Contact (bouton plein, pastille d'État), écran Contacts (puces), Réglages (Étapes types sans Vivier, Rythme des Alliés, Taille visée du Cercle, Objectif d'entrées), Indicateurs, gestes (§6.6, §6.7, §6.8, §6.11, nouveau « Prendre des nouvelles… »), microcopie, vocabulaire anglais, exigences `ST-xx` nouvelles ou modifiées, arbitrages et écarts entre l'UX et le modèle. Graduer en `ST-xx` la zone « Nouvelles exigences pour la stack » de la carte.

Une fois fait : débloquer le ticket « Données » de la carte stack.

## Answer

Fait, puis relu et validé par Romain (2026-10-06). La [spec UX](../../battlecrm-ux/spec.md) est amendée partout ; elle cite les tickets de cette carte sous la forme C01 à C04.

- **Navigation** (§3) : Cercle entre Aujourd'hui et Contacts, `G E`, sous Plus sur mobile ; la pastille d'Aujourd'hui compte les Alliés à relancer (infobulle « 3 à traiter, 2 Alliés à relancer ») ; palette filtrée par État, verbes d'un mot ; touche `S` Changer d'État….
- **Écrans** (§5) : Aujourd'hui (bandeau Entrées, Relances et Alliés mêlés), Funnel réservé à En prospection (zones Vivier, Cercle, Archivé ; filtre d'État et colonne État retirés), fiche par État, puces de Contacts, Réglages (Étapes types sans Vivier, Objectif d'entrées, Rythme des Alliés, Taille visée du Cercle), Indicateurs (Entrées de la semaine et Taille du Cercle en tête, sorties par État et par Étape), nouvelle page Cercle (§5.11).
- **Gestes** (§6) : §6.11 « Changer d'État » (un verbe par destination) remplace « Réactiver… » ; §6.7 propose de remettre au Vivier ; ajout rapide à commande segmentée ; nouveau §6.14 « Prendre des nouvelles… » ; renvois dans §6.1, §6.2, §6.4, §6.5, §6.6, §6.13.
- **Exigences** : nouvelles ST-39 (historique des changements d'État), ST-48 (Jours sans contact), ST-49 (Entrées par semaine), ST-57 et ST-58 (réglages du Cercle) ; modifiées ST-46, ST-47, ST-62.
- Microcopie (§10), arbitrages (§11), note de lecture des écarts (§12), ADR 0007 (§13), Opportunité hors périmètre (§15).

Comblé puis validé à la relecture : couleur « bientôt » reprise du prototype (contraste à contrôler, valeur sombre à définir) ; Vivier vide sur Aujourd'hui ; tirage des propositions stable sur la journée ; cinq chiffres en tête des Indicateurs ; Allié à Relance due rangé dans À relancer, paliers triés par Jours sans contact ; « Nouvelles » dans la barre mobile d'un Allié.

Ajouts de Romain à la relecture :
- un Contact entré depuis le bandeau Entrées **est remplacé** par un nouveau tirage du Vivier : il reste toujours plusieurs propositions (C03 amendé) ;
- **un Allié est repérable partout** : une petite étoile ★ à côté de son nom, avec le libellé accessible « Allié », jamais la couleur seule (§1, §7).

Le ticket « Données » de la carte stack est débloqué.
