# Sauvegardes et RGPD avant d'ouvrir les inscriptions

Type: grilling
Status: resolved
Blocked by:

## Question

Comment les données sont-elles sauvegardées, restaurées et effacées, de façon assez sûre pour ouvrir l'app à des collègues ?

À trancher :
- **Dumps** : `pg_dump` quotidien (préconisé par « [Base de données : SQLite ou Postgres](03-base-de-donnees.md) »). Qui le lance (conteneur dédié, cron de l'hôte, tâche `jobs` de l'API), à quelle heure, sous quel rôle, et comment il échappe à Watchtower.
- **Chiffrement obligatoire** : les jetons de session sont en clair en base (« [Auth : bibliothèque, sessions et client extension](08-auth.md) ») et les pièces jointes y sont aussi, en `bytea` (« [Déploiement](10-deploiement.md) »). Outil (age, gpg…), où vit la clé, et qui peut déchiffrer si le VPS est perdu.
- **Destination hors du VPS** : quel stockage gratuit, et comment il est poussé (rclone…). Les instantanés de l'hébergeur, hebdomadaires et gardés 2 à 3 semaines (« [Relevé du VPS](05-releve-vps.md) »), restent-ils le seul filet du disque entier ?
- **Rétention compatible avec l'anonymisation (ST-38, ADR 0006)** : durée bornée, pour qu'un Contact anonymisé disparaisse aussi des sauvegardes au bout d'un délai annoncé. Même question pour les instantanés de l'hébergeur.
- **Restauration** : procédure écrite, test de restauration (à quelle fréquence, automatique ou non), objectif de perte acceptable.
- **Suppression de compte (spec UX §14)** : effacement immédiat des lignes de l'Utilisateur (cascade sous RLS, pièces jointes comprises, tables de Better Auth hors RLS), délai d'effacement dans les sauvegardes, e-mail de confirmation.
- **RGPD minimal pour des collègues** : registre, mentions légales et politique de confidentialité, export des données de l'Utilisateur (droit d'accès et de portabilité) : ce qui est exigé avant d'ouvrir `SIGNUPS_OPEN`, ce qui peut attendre.

Aucun dump n'existe encore sur le VPS. Déjà tranché : un échec de sauvegarde se signale par un moniteur push uptime-kuma (→ Pushover), pingé après un dump réussi et poussé hors du VPS (« [Observabilité](16-observabilite.md) »). Entrées : ADR 0006, 0009, 0013 ; « [Base de données et accès aux données](07-donnees.md) ».

## Answer

Tranché avec Romain le 2026-10-08. Consigne : **ultra simple, gratuit, aucun service tiers**. Romain est seul sur l'app pour l'instant ; on complexifiera si des collègues arrivent.

- **Dump** : un **cron de l'hôte** à **3 h**, avant le passage de Watchtower à 4 h. Il lance `ops/backup.sh`, versionné dans le dépôt et déposé par `deploy.sh`, sous `set -euo pipefail` :
  - `docker exec … pg_dump -Fc`, en superutilisateur `postgres` par le socket local. La RLS forcée (ADR 0009) bloquerait le rôle propriétaire, et l'API n'a jamais ce droit ;
  - écriture dans `/opt/docker/battlecrm/backups/` (dossier en `700`, propriétaire root) ;
  - effacement des dumps de plus de 30 jours (`find -mtime +30 -delete`) ;
  - si tout a réussi, un `curl` vers un **moniteur push uptime-kuma** distinct (→ Pushover). Sans ping pendant ~25 h, uptime-kuma alerte.

  Ce script n'ajoute ni conteneur ni image, donc rien que Watchtower puisse toucher.
- **Rétention : 30 jours.** Les instantanés hebdomadaires de l'hébergeur (≤ 3 semaines) tiennent sous cette borne, comme la rotation des journaux Docker. Un Contact anonymisé (ST-38, ADR 0006) disparaît donc de toutes les copies en **30 jours au plus**.
- **Pas de copie hors du VPS** :
  - un dump quotidien couvre une erreur applicative (mauvaise migration, bug, fausse manipulation) : on restaure la base seule, avec **24 h de perte au plus** ;
  - si le VPS entier est perdu, l'instantané de l'hébergeur (qui contient aussi les dumps) sert de filet, avec **une semaine de perte au plus**. L'hébergeur n'est pas un tiers de plus ;
  - si cette perte devient inacceptable, le PC de Romain pourra récupérer les dumps par `rsync`.
- **Pas de chiffrement** : les dumps sont sur le même disque que la base, elle-même en clair. Les chiffrer ne protégerait rien. À reprendre si une copie quitte un jour le VPS.
- **Restauration** : quelques lignes dans `docs/ops/restore.md` (`pg_restore` dans la base, l'API arrêtée). Un essai fait une seule fois à la main, pour vérifier que ça marche. Pas de contrôle automatique de l'archive, pas d'exercice périodique.
- **Schéma** : la suppression en cascade depuis l'Utilisateur (`ON DELETE CASCADE`) est prévue dès le départ. Elle ne coûte rien et prépare une future suppression de compte.
- **Hors périmètre**, à reprendre comme un chantier à part **avant d'ouvrir `SIGNUPS_OPEN`** : mentions légales, politique de confidentialité, registre des traitements, suppression de compte (commande `delete-user` envisagée), export des données, copie hors du VPS et son chiffrement. Tant que Romain est seul, il n'y a ni tiers inscrit ni demande à traiter.
- **Écarté** : Backblaze B2 et Google Drive (services tiers), age, un conteneur de sauvegarde, une tâche `jobs` de l'API (elle aurait dû contourner la RLS).
- Pas d'ADR (tout est réversible). Pas de nouveau terme dans `CONTEXT.md`.
