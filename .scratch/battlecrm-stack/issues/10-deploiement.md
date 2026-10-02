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
- Budget mémoire sur le VPS au regard des autres apps.
