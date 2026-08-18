#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this script as the regular Ubuntu user, not as root."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y --no-install-recommends ca-certificates curl git docker.io docker-compose-v2 ufw
sudo systemctl enable --now docker

# The cloud firewall is configured in OCI. This host firewall mirrors the minimum exposure.
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

printf '%s\n' \
  'Bootstrap completed.' \
  'Next: clone the repository, create .env from deploy/oracle/.env.production.example, and run the Oracle compose command.' \
  'Use sudo docker compose until you intentionally add your user to the docker group.'
