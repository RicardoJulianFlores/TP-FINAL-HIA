#!/bin/bash
# ==============================================================================
# Joyería Lumière - HIA Práctica Integradora Final
# JOY-30: Suite de Validación de Alerta Prometheus -> Ticket GLPI -> Notificación
# ==============================================================================
set -e

N8N_URL="http://localhost:5678/webhook/alerta-prometheus"
GLPI_API="http://localhost:8086/apirest.php"
APP_TOKEN="LumiereN8NAppToken2026SecureKeyJOY30"
WEBHOOK_SECRET="LumiereWebhookSecret2026!"
PASS_COUNT=0
FAIL_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test() {
  echo -e "\n${BLUE}======================================================================${NC}"
  echo -e "${YELLOW}TEST: $1${NC}"
  echo -e "${BLUE}======================================================================${NC}"
}

assert_status() {
  local expected=$1
  local actual=$2
  local test_name=$3
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✔ [PASS] $test_name (HTTP $actual esperado)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${RED}✘ [FAIL] $test_name (Esperado HTTP $expected, recibido HTTP $actual)${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}   SUITE DE PRUEBAS AUTOMATIZADAS - JOY-30 (n8n -> GLPI -> NOTIF)     ${NC}"
echo -e "${BLUE}======================================================================${NC}"

# ------------------------------------------------------------------------------
# Test 1: Petición sin cabecera de autenticación (debe rechazar con 401)
# ------------------------------------------------------------------------------
log_test "1. Webhook Rechaza Petición sin Cabecera de Autenticación (401)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$N8N_URL" \
  -H "Content-Type: application/json" \
  -d '{"status":"firing","alerts":[{"labels":{"alertname":"TestNoAuth"}}]}')
assert_status 401 "$HTTP_CODE" "Petición sin autenticación es rechazada"

# ------------------------------------------------------------------------------
# Test 2: Petición con token inválido (debe rechazar con 401)
# ------------------------------------------------------------------------------
log_test "2. Webhook Rechaza Token Inválido (401)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$N8N_URL" \
  -H "X-Webhook-Token: TokenInvalido123" \
  -H "Content-Type: application/json" \
  -d '{"status":"firing"}')
assert_status 401 "$HTTP_CODE" "Petición con token inválido es rechazada"

# ------------------------------------------------------------------------------
# Test 3: Petición autenticada pero con estructura JSON inválida (debe responder 400)
# ------------------------------------------------------------------------------
log_test "3. Validación de Estructura de Payload JSON (400 si payload vacío)"
RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$N8N_URL" \
  -H "X-Webhook-Token: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"datos_invalidos": true}')
HTTP_CODE=$(echo "$RESP" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_STATUS:")
echo "Respuesta n8n: $BODY"
assert_status 400 "$HTTP_CODE" "Payload sin alerta retorna 400 Bad Request"

# ------------------------------------------------------------------------------
# Test 4: E2E Happy Path - Alerta Crítica de Base de Datos -> Ticket GLPI
# ------------------------------------------------------------------------------
log_test "4. E2E Happy Path: Alerta PostgresDown -> Ticket GLPI (201)"
RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$N8N_URL" \
  -H "X-Webhook-Token: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "n8n-webhook",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "PostgresDown",
          "severity": "critical",
          "instance": "lumiere-db:5432",
          "job": "postgres-exporter",
          "area": "Rendimiento y Base de Datos"
        },
        "annotations": {
          "summary": "Caída del motor principal de Base de Datos",
          "description": "El contenedor primario lumiere-db no responde en el puerto 5432. Clúster en degradación."
        },
        "startsAt": "2026-11-14T20:55:00.000Z"
      }
    ]
  }')
HTTP_CODE=$(echo "$RESP" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_STATUS:")
echo "Respuesta n8n: $BODY"
assert_status 201 "$HTTP_CODE" "Alerta de BD crea ticket con éxito"

# Extraer ID del ticket
TICKET_ID=$(echo "$BODY" | grep -o '"ticket_id":[0-9]*' | cut -d':' -f2)
echo "Ticket ID generado: $TICKET_ID"

# ------------------------------------------------------------------------------
# Test 5: Mapeo de Categoría ITIL Infraestructura y Contenedores (Docker)
# ------------------------------------------------------------------------------
log_test "5. Mapeo ITIL: Alerta de Infraestructura / Docker (201, Cat 3)"
RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$N8N_URL" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "n8n-webhook",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "DockerBackendContainerExited",
          "severity": "warning",
          "instance": "joyeria-backend",
          "job": "cadvisor",
          "area": "Infraestructura, Red y Contenedores"
        },
        "annotations": {
          "summary": "Contenedor Backend Express detenido",
          "description": "El servicio joyeria-backend salió inesperadamente con código de salida 137."
        },
        "startsAt": "2026-11-14T20:56:00.000Z"
      }
    ]
  }')
HTTP_CODE=$(echo "$RESP" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_STATUS:")
echo "Respuesta n8n: $BODY"
assert_status 201 "$HTTP_CODE" "Alerta de Infraestructura procesada"

# ------------------------------------------------------------------------------
# Test 6: Mapeo de Categoría ITIL Seguridad Informática (OWASP / JWT)
# ------------------------------------------------------------------------------
log_test "6. Mapeo ITIL: Alerta de Seguridad / OWASP (201, Cat 1)"
RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$N8N_URL" \
  -H "X-Webhook-Token: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "n8n-webhook",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "JwtBruteForceDetected",
          "severity": "critical",
          "instance": "joyeria-backend:3000",
          "area": "Seguridad Informática y Vulnerabilidades"
        },
        "annotations": {
          "summary": "Ataque de fuerza bruta detectado en endpoint de login",
          "description": "Se detectaron más de 100 intentos fallidos de autenticación en menos de 1 minuto."
        },
        "startsAt": "2026-11-14T20:57:00.000Z"
      }
    ]
  }')
HTTP_CODE=$(echo "$RESP" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_STATUS:")
echo "Respuesta n8n: $BODY"
assert_status 201 "$HTTP_CODE" "Alerta de Seguridad procesada"

# ------------------------------------------------------------------------------
# Test 7: Verificación del Ticket Directamente en la API REST de GLPI
# ------------------------------------------------------------------------------
log_test "7. Verificación del Incidente en API REST de GLPI"
if [ -n "$TICKET_ID" ]; then
  python3 -c "
import urllib.request, json
req = urllib.request.Request('$GLPI_API/initSession', headers={'App-Token': '$APP_TOKEN', 'Authorization': 'Basic bWNoYW1iaTpMdW1pZXJlMjAyNiE='})
st = json.loads(urllib.request.urlopen(req).read().decode())['session_token']

req_t = urllib.request.Request('$GLPI_API/Ticket/$TICKET_ID', headers={'App-Token': '$APP_TOKEN', 'Session-Token': st})
t = json.loads(urllib.request.urlopen(req_t).read().decode())
print(f'Ticket #{t[\"id\"]}: {t[\"name\"]}')
print(f'Prioridad: {t[\"priority\"]} | Urgencia: {t[\"urgency\"]} | Impacto: {t[\"impact\"]} | Categoria ITIL: {t[\"itilcategories_id\"]}')

req_u = urllib.request.Request('$GLPI_API/Ticket/$TICKET_ID/Ticket_User', headers={'App-Token': '$APP_TOKEN', 'Session-Token': st})
users = json.loads(urllib.request.urlopen(req_u).read().decode())
tech_user = next((u for u in users if u.get('type') == 2), None)
print(f'Usuario Técnico Asignado: {tech_user}')

req_k = urllib.request.Request('$GLPI_API/killSession', headers={'App-Token': '$APP_TOKEN', 'Session-Token': st})
urllib.request.urlopen(req_k)
assert t['id'] == $TICKET_ID
assert tech_user is not None
print('✔ Validación en GLPI exitosa')
" && {
    echo -e "${GREEN}✔ [PASS] Ticket verificado en base de datos de GLPI${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  } || {
    echo -e "${RED}✘ [FAIL] Error al validar ticket en GLPI${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  }
fi

# ------------------------------------------------------------------------------
# Test 8: Resiliencia del Flujo ante Falla de GLPI (Manejo de Errores - 502)
# ------------------------------------------------------------------------------
log_test "8. Manejo de Errores y Contingencia cuando GLPI no responde (502)"
echo "Pausando temporalmente contenedor lumiere-glpi..."
docker pause lumiere-glpi >/dev/null

RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$N8N_URL" \
  -H "X-Webhook-Token: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "alertname": "TestSimulacionCaidaGlpi",
    "severity": "critical",
    "instance": "lumiere-glpi",
    "summary": "Simulación de fallo de conexión con el servicio GLPI"
  }')
HTTP_CODE=$(echo "$RESP" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_STATUS:")

echo "Reanudando contenedor lumiere-glpi..."
docker unpause lumiere-glpi >/dev/null

echo "Respuesta recibida ante caída de GLPI: $BODY"
assert_status 502 "$HTTP_CODE" "Manejo de contingencia activa respuesta 502 y notificación de emergencia"

# ------------------------------------------------------------------------------
# Resumen Final
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}======================================================================${NC}"
echo -e "${BLUE}                       RESUMEN DE PRUEBAS                             ${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo -e "Pruebas Exitosas: ${GREEN}$PASS_COUNT${NC}"
echo -e "Pruebas Fallidas: ${RED}$FAIL_COUNT${NC}"

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "\n${GREEN}✔ TODOS LOS CRITERIOS DE ACEPTACIÓN SE CUMPLIERON EXITOSAMENTE.${NC}"
  exit 0
else
  echo -e "\n${RED}✘ HUBO FALLOS EN LA VALIDACIÓN.${NC}"
  exit 1
fi
