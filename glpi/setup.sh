#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== [JOY-20] Despliegue y Parametrizacion de GLPI ==="

if [ ! -f .env ]; then
  echo "Creando .env a partir de .env.example..."
  cp .env.example .env
fi

# Cargar variables de entorno
set -a
source .env
set +a

echo "1. Levantando stack de contenedores GLPI..."
docker compose up -d

echo "2. Esperando a que lumiere-glpi-db este saludable..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' lumiere-glpi-db 2>/dev/null)" = "healthy" ]; do
  sleep 3
done

echo "3. Esperando inicializacion de archivos web en lumiere-glpi..."
until docker exec lumiere-glpi test -f /var/www/html/glpi/bin/console 2>/dev/null; do
  sleep 5
done

echo "4. Verificando instalacion de base de datos GLPI..."
if ! docker exec lumiere-glpi test -f /var/www/html/glpi/config/config_db.php; then
  echo "Instalando esquema inicial de base de datos..."
  docker exec -u www-data lumiere-glpi php /var/www/html/glpi/bin/console db:install \
    --db-host=glpi-db \
    --db-name="$MARIADB_DATABASE" \
    --db-user="$MARIADB_USER" \
    --db-password="$MARIADB_PASSWORD" \
    --default-language=es_AR \
    --no-interaction
else
  echo "Base de datos GLPI ya configurada."
fi

# Eliminar archivo install.php por seguridad
docker exec lumiere-glpi rm -f /var/www/html/glpi/install/install.php

echo "5. Aplicando parametrizacion inicial de ITIL, Usuarios y API REST..."
docker exec -i lumiere-glpi-db mariadb -u "$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" < "$DIR/init-parametrizacion.sql"

echo "=== Despliegue y Parametrizacion completados con exito ==="
echo "Acceso Web: http://localhost:${GLPI_PORT:-8086}"
echo "Credenciales de integrantes: <usuario> / Lumiere2026!"
echo "API REST endpoint: http://localhost:${GLPI_PORT:-8086}/apirest.php"
echo "App-Token n8n: LumiereN8NAppToken2026SecureKeyJOY30"
