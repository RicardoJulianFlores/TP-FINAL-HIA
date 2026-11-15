#!/bin/bash
# ==============================================================================
# Joyería Lumière - HIA Práctica Integradora Final
# JOY-30: Script de Importación y Activación Automática del Flujo 1 n8n
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_FILE="$DIR/monitoring/n8n/workflows/flujo-1-alerta-prometheus-glpi.json"
CONTAINER_NAME="lumiere-n8n"

echo "=== [JOY-30] Importación y Activación del Flujo n8n ==="

if [ ! -f "$WORKFLOW_FILE" ]; then
  echo "Error: No se encontró el archivo de workflow en $WORKFLOW_FILE"
  exit 1
fi

# 1. Verificar si el contenedor n8n está en ejecución
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "El contenedor $CONTAINER_NAME no está corriendo. Iniciándolo con Docker Compose..."
  cd "$DIR"
  docker compose up -d n8n
fi

# 2. Conectar lumiere-glpi a tp-final-hia_admin-net si existe
if docker ps --format '{{.Names}}' | grep -q "^lumiere-glpi$"; then
  echo "Asegurando conexión entre red de administración y lumiere-glpi..."
  docker network connect tp-final-hia_admin-net lumiere-glpi 2>/dev/null || true
fi

# 3. Esperar a que n8n esté saludable
echo "Esperando a que n8n inicialice..."
until docker exec "$CONTAINER_NAME" wget -qO- http://127.0.0.1:5678/healthz 2>/dev/null | grep -q "ok"; do
  sleep 2
done

# 4. Copiar workflow al contenedor
echo "Copiando definición de workflow al contenedor..."
docker cp "$WORKFLOW_FILE" "$CONTAINER_NAME:/tmp/flujo-1-alerta-prometheus-glpi.json"

# 5. Sincronizar e importar workflow directamente en n8n
echo "Sincronizando workflow en la base de datos de n8n..."
docker exec "$CONTAINER_NAME" node -e '
const fs = require("fs");
const sqlite3 = require("/usr/local/lib/node_modules/n8n/node_modules/sqlite3");
const db = new sqlite3.Database("/home/node/.n8n/database.sqlite");
const data = JSON.parse(fs.readFileSync("/tmp/flujo-1-alerta-prometheus-glpi.json", "utf8"));

db.get("SELECT id FROM workflow_entity WHERE name = ? LIMIT 1", [data.name], (err, row) => {
  if (err) {
    console.error("Error reading database:", err);
    process.exit(1);
  }
  const nodesJson = JSON.stringify(data.nodes);
  const connJson = JSON.stringify(data.connections);
  if (row && row.id) {
    db.run("UPDATE workflow_entity SET nodes = ?, connections = ?, active = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [
      nodesJson,
      connJson,
      row.id
    ], (err2) => {
      if (err2) {
        console.error("Error updating workflow_entity:", err2);
        process.exit(1);
      }
      db.run("UPDATE workflow_history SET nodes = ?, connections = ?, updatedAt = CURRENT_TIMESTAMP WHERE workflowId = ?", [
        nodesJson,
        connJson,
        row.id
      ], (errHistory) => {
        if (errHistory) console.warn("Notice: workflow_history update returned:", errHistory);
        console.log("Workflow sincronizado (ID: " + row.id + ")");
        db.close();
      });
    });
  } else {
    const id = "D93amS4phNYugPA8";
    db.run("INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [
      id,
      data.name,
      nodesJson,
      connJson,
      JSON.stringify(data.settings || {})
    ], (err3) => {
      if (err3) {
        console.error("Error inserting workflow:", err3);
        process.exit(1);
      }
      console.log("Workflow creado y activado (ID: " + id + ")");
      db.close();
    });
  }
});
'

# 6. Publicar workflow formalmente con el CLI de n8n
echo "Publicando versión activa del workflow con CLI n8n..."
docker exec "$CONTAINER_NAME" n8n publish:workflow --id=D93amS4phNYugPA8 >/dev/null 2>&1 || true

# 7. Reiniciar n8n para aplicar la publicación
echo "Reiniciando $CONTAINER_NAME para aplicar cambios..."
docker restart "$CONTAINER_NAME" >/dev/null

echo "Esperando a que n8n vuelva a estar en línea y registre el webhook..."
until docker exec "$CONTAINER_NAME" wget -S -O- --post-data="{}" http://127.0.0.1:5678/webhook/alerta-prometheus 2>&1 | grep -q "401"; do
  sleep 2
done

echo "=== Flujo 1 n8n importado y activado exitosamente ==="
echo "Webhook activo en: http://localhost:5678/webhook/alerta-prometheus"
echo "Credencial Header: X-Webhook-Token: LumiereWebhookSecret2026!"
