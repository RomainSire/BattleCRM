# Sauvegardes et RGPD avant d'ouvrir les inscriptions

Type: grilling
Status: open
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

Aucun dump n'existe encore sur le VPS. Entrées : ADR 0006, 0009, 0013 ; « [Base de données et accès aux données](07-donnees.md) ».
