# Relevé du VPS

Type: task
Status: open
Blocked by:

## Question

Quels faits du VPS contraignent le déploiement ? Ticket HITL : Romain lance la checklist sur le VPS et colle les sorties ici.

Checklist :
- [ ] Ressources : `nproc`, `free -h`, `df -h /`, et l'offre exacte.
- [ ] Charge actuelle : `docker stats --no-stream` (mémoire déjà prise par les autres apps).
- [ ] Traefik : version (`docker ps --format '{{.Image}}' | grep -i traefik`), entrypoints, certresolver, middlewares communs (en-têtes de sécurité, limitation de débit).
- [ ] Réseaux : `docker network ls`.
- [ ] Watchtower : comment il est configuré (opt-in par label ou toutes les images, fréquence) ; la V1 l'avait désactivé (`com.centurylinklabs.watchtower.enable=false`).
- [ ] Comment la V1 était déployée : fichier `deploy.yml` (SSH depuis Actions ?) et emplacement des `.env` sur le VPS.
- [ ] Sauvegardes de l'hébergeur : ce qu'elles couvrent (disque entier, volumes Docker compris ?).
