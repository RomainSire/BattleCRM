# Déploiement

Type: grilling
Status: open
Blocked by: 05, 06, 07

## Question

Comment l'app est-elle construite, livrée et configurée sur le VPS ?

À trancher :
- Images (une ou plusieurs), conteneurs, réseau Traefik ; migrations au déploiement.
- Chaîne GitHub Actions → GHCR → VPS : déclenchement, Watchtower ou déploiement explicite, retour arrière.
- Configuration par variables d'environnement (dont l'ouverture des inscriptions) et secrets (SMTP Gmail).
- Budget mémoire sur le VPS au regard des autres apps : limites `mem_limit` par conteneur (il n'y a pas de swap).
- Watchtower : exclure chaque conteneur BattleCRM par label (Postgres compris), ou laisser Watchtower livrer l'app.
- Accès SSH d'Actions : clé verrouillée par une commande forcée (`restrict,command=…`) ou utilisateur dédié, plutôt qu'un compte personnel.
- En-têtes de sécurité et limitation de débit : à déclarer par labels Traefik, puisqu'aucun middleware global n'existe.
- Bascule depuis la V1 : la supprimer (conteneurs, volume `battlecrm_pgdata`, `/opt/docker/battlecrm`) et reprendre `battlecrm.romainsire.com`.

Faits du VPS : voir « [Relevé du VPS](05-releve-vps.md) ».
