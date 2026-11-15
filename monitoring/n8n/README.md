# Flujo 1 n8n: Alerta de Prometheus ➔ Creación Automática de Ticket en GLPI ➔ Notificación (JOY-30)

**Cátedra:** Herramientas Informáticas Avanzadas (HIA) - 2026  
**Proyecto:** Joyería Lumière  
**Módulo:** Sprint 3 - Observabilidad, Automatización y Gestión de Incidentes ITIL  
**Autor:** Marcos Chambi (`mmarcoschambi`) / Ricardo Flores (`rflores`)  
**Estado:** Implementado, validado y probado empíricamente  

---

## 1. Descripción General de la Solución

El **Flujo 1 de n8n** implementa la automatización integral de la gestión de incidentes del clúster de Joyería Lumière:
Cuando Prometheus Alertmanager o Grafana detectan una anomalía o caída de infraestructura (por ejemplo, fallo del primario PostgreSQL, lentitud de consultas, caída de contenedores Docker o ataques de fuerza bruta), envían una alerta vía webhook seguro a **n8n**.

n8n valida la autenticación de la cabecera, procesa y normaliza el incidente, clasifica el problema dentro de la taxonomía ITIL correspondiente en **GLPI**, consume la API REST de GLPI para abrir el ticket asignándolo al responsable técnico (`mchambi` - Administrador de Infraestructura / SRE), envía una notificación con el detalle del incidente y el ID del ticket generado, y provee un manejo robusto de contingencias en caso de que GLPI no responda.

```
┌─────────────────────────┐
│ Prometheus Alertmanager │
│    / Grafana Alerting   │
└────────────┬────────────┘
             │ POST /webhook/alerta-prometheus
             │ Cabecera: X-Webhook-Token: LumiereWebhookSecret2026!
             ▼
┌────────────────────────────────────────────────────────┐
│                      n8n PIPELINE                      │
│ 1. Validar Autenticación (401 si token inválido)       │
│ 2. Validar Payload JSON (400 si alertname ausente)     │
│ 3. Mapear Severidad -> Prioridad ITIL (1 a 5)          │
│ 4. Mapear Área -> Categoría ITIL GLPI                  │
│    - Rendimiento y Base de Datos (ID 2)                │
│    - Infraestructura, Red y Contenedores (ID 3)        │
│    - Seguridad Informática (ID 1)                      │
│ 5. Consumir API REST GLPI:                             │
│    initSession ➔ POST /Ticket ➔ killSession            │
│ 6. Notificar al Equipo (Ticket ID + Detalles)          │
│ 7. Manejo de Fallas GLPI (Alerta Contingencia + 502)   │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
    HTTP 201 │ Éxito              Fallo    │ HTTP 502 (Timeout / Caída)
             ▼                             ▼
┌─────────────────────────┐   ┌───────────────────────────┐
│        Mesa GLPI        │   │ Notificación Contingencia │
│   Ticket Abierto P1-P5  │   │     "GLPI Inaccesible"    │
│   Técnico: mchambi      │   │   Atención Manual Requer. │
└─────────────────────────┘   └───────────────────────────┘
```

---

## 2. Criterios de Aceptación y Estado de Cumplimiento

| Criterio de Aceptación (Jira JOY-30) | Estado | Evidencia de Implementación |
|---|---|---|
| **1. Webhook en n8n con cabecera de autenticación** para recibir alertas enviadas por Alertmanager/Grafana | **CUMPLIDO** | Webhook expuesto en `/webhook/alerta-prometheus`. Exige cabecera `X-Webhook-Token: LumiereWebhookSecret2026!` o `Authorization: Bearer LumiereWebhookSecret2026!`. Retorna HTTP 401 si la cabecera falta o es incorrecta. |
| **2. Validar estructura del payload JSON y procesar datos del incidente** | **CUMPLIDO** | Valida campos obligatorios. Soporta arrays `alerts: [...]` de Alertmanager/Grafana y objetos planos. Extrae `alertname`, `severity`, `instance`, `summary`, `description` y `startsAt`. Retorna HTTP 400 Bad Request si la estructura es inválida. |
| **3. Consumir API REST de GLPI para abrir automáticamente una incidencia asignada al área correspondiente** | **CUMPLIDO** | Autentica en `/apirest.php/initSession` con App-Token y credenciales, crea el ticket en `/apirest.php/Ticket` con prioridad ITIL calculada, categoría ITIL mapeada y técnico asignado (`_users_id_assign: 7`), y cierra sesión en `/apirest.php/killSession`. |
| **4. Notificar al equipo con el ID del ticket y detalle del error** | **CUMPLIDO** | Nodo despachador de notificación y respuesta HTTP 201 estructurada con `ticket_id`, `alertname`, `category`, `priority`, y enlace directo a la mesa de ayuda (`http://localhost:8086/front/ticket.form.php?id=<id>`). |
| **5. Documentar manejo de errores del flujo si el servicio GLPI no responde** | **CUMPLIDO** | Ramificación de contingencia activada ante timeouts o caídas de GLPI: captura el error, emite notificación de emergencia al equipo solicitando atención manual, y retorna HTTP 502 Bad Gateway documentado. |

---

## 3. Especificación Técnica de los Componentes

### A. Webhook y Autenticación
- **URL Producción:** `http://localhost:5678/webhook/alerta-prometheus` (o interno en docker: `http://n8n:5678/webhook/alerta-prometheus`)
- **Método HTTP:** `POST`
- **Cabeceras de Autenticación Aceptadas:**
  - `X-Webhook-Token: LumiereWebhookSecret2026!`
  - `Authorization: Bearer LumiereWebhookSecret2026!`
- **Control de Acceso:**
  Si la cabecera no coincide o está ausente, el flujo interrumpe la ejecución de inmediato y responde:
  ```json
  {
    "status": "error",
    "code": 401,
    "message": "Acceso no autorizado: la cabecera 'X-Webhook-Token' o 'Authorization: Bearer' no coincide con el secreto configurado."
  }
  ```

---

### B. Matriz de Mapeo a Categorías ITIL y Prioridades

El flujo procesa las etiquetas (`labels.area`, `labels.severity`, `labels.job`) y el texto descriptivo para clasificar automáticamente la incidencia dentro de las categorías ITIL creadas en JOY-20:

| Categoría ITIL en GLPI | ID Categoría | Criterio de Coincidencia (RegEx / Labels) | Severidad | Prioridad ITIL | Urgencia / Impacto |
|---|---|---|---|---|---|
| **Seguridad Informática y Vulnerabilidades** | `1` | `labels.area == 'Seguridad'` o coincidencia con `owasp`, `trivy`, `token`, `jwt`, `auth`, `bruteforce`, `security` | `critical` | **5 (Mayor)** | 5 / 5 |
| **Rendimiento y Base de Datos** | `2` | `labels.area == 'Rendimiento'` o coincidencia con `postgres`, `database`, `latency`, `slow_query`, `wal`, `replication` | `critical` / `warning` | **5** (Crítico) / **4** (Alto) | 5 / 5 o 4 / 4 |
| **Infraestructura, Red y Contenedores** | `3` | `labels.area == 'Infraestructura'` o coincidencia con `container`, `docker`, `cadvisor`, `node_exporter`, `cpu`, `memory`, `tunnel` | `critical` / `warning` | **5** (Crítico) / **4** (Alto) | 5 / 5 o 4 / 4 |
| **Alertas Automáticas (Prometheus / n8n)** | `4` | Categoría por defecto si no encuadra en las reglas anteriores | `info` / `warning` | **2** a **4** | 2 / 2 a 4 / 4 |

**Asignación de Responsable:**
- `_users_id_assign: 7` (Marcos Chambi - Administrador de Infraestructura / SRE de Joyería Lumière).

---

### C. Ciclo de Vida de Interacción con la API REST de GLPI

El flujo interactúa con la API REST de GLPI siguiendo las buenas prácticas de sesión efímera:

1. **Inicialización de Sesión (`GET /apirest.php/initSession`):**
   - Cabeceras:
     - `App-Token: LumiereN8NAppToken2026SecureKeyJOY30`
     - `Authorization: Basic bWNoYW1iaTpMdW1pZXJlMjAyNiE=` (`mchambi:Lumiere2026!`)
   - Respuesta: `{ "session_token": "<token>" }`

2. **Creación del Ticket (`POST /apirest.php/Ticket`):**
   - Cabeceras:
     - `App-Token: LumiereN8NAppToken2026SecureKeyJOY30`
     - `Session-Token: <token>`
     - `Content-Type: application/json`
   - Cuerpo de la Petición:
     ```json
     {
       "input": {
         "name": "[PROMETHEUS] PostgresDown - Caída del motor principal de Base de Datos",
         "content": "<h3>Alerta Automática de Infraestructura - Joyería Lumière</h3>...",
         "type": 1,
         "urgency": 5,
         "impact": 5,
         "priority": 5,
         "itilcategories_id": 2,
         "_users_id_assign": 7
       }
     }
     ```
   - Respuesta: `{ "id": 10, "message": "Elemento agregado exitosamente" }`

3. **Cierre de Sesión (`GET /apirest.php/killSession`):**
   - Libera el token de sesión en MariaDB para prevenir agotamiento de sesiones concurrentes.

---

## 4. Manejo de Errores y Resiliencia del Flujo

Si el servicio GLPI no responde, experimenta un timeout o rechaza las credenciales, el flujo ejecuta una estrategia de **contingencia no bloqueante**:

### A. Detección del Fallo
- El nodo `GLPI Init Session` tiene configurado un timeout de 8000 ms y `continueOnFail: true`.
- El nodo condicional `If Sesion GLPI Creada` valida la presencia de `session_token`.
- Si `session_token` es nulo o la conexión es rechazada (`ECONNREFUSED`, `ECONNABORTED`, HTTP 500/502/503), la ejecución se desvía a la rama `Manejo Error GLPI`.

### B. Notificación de Contingencia al Equipo
El nodo `Manejo Error GLPI` construye de inmediato un mensaje de alarma de alta prioridad:
```
🚨 *FALLO CRÍTICO DE GESTIÓN DE INCIDENTES* 🚨

⚠️ *NO SE PUDO CREAR EL TICKET EN GLPI*
• *Alerta:* PostgresDown
• *Severidad:* CRITICAL
• *Instancia:* lumiere-db:5432
• *Resumen:* Caída del motor principal de Base de Datos
• *Causa de la Falla:* Servicio GLPI inaccesible o error en API REST
• *Detalle Error:* timeout of 8000ms exceeded (ECONNABORTED)
• *Acción Requerida:* Atender el incidente manualmente y verificar contenedor lumiere-glpi.
```
Este mensaje se despacha por el canal de mensajería de emergencia.

### C. Respuesta HTTP 502 al Emisor
Para evitar que Prometheus o Grafana asuman erróneamente que la alerta fue recibida y registrada con éxito, n8n responde al webhook con un código **HTTP 502 Bad Gateway**:
```json
{
  "status": "error",
  "code": 502,
  "message": "El servicio GLPI no está disponible para registrar la incidencia. Se ha emitido notificación de contingencia al equipo.",
  "alert": "PostgresDown",
  "error_detail": {
    "message": "timeout of 8000ms exceeded",
    "name": "AxiosError",
    "code": "ECONNABORTED"
  }
}
```
Esto permite a Alertmanager reintentar el envío de acuerdo con su directiva `repeat_interval`.

---

## 5. Guía de Puesta en Marcha y Validación Local

### Paso 1: Levantar los Servicios

En una terminal (o entorno WSL):
```bash
# 1. Asegurar que el stack principal esté levantado
docker compose up -d

# 2. Asegurar que GLPI esté levantado y parametrizado
cd glpi && ./setup.sh && cd ..
```

---

### Paso 2: Importar y Activar el Workflow en n8n

Ejecutar el script automatizado provisto:
```bash
chmod +x scripts/import-n8n-workflow.sh
./scripts/import-n8n-workflow.sh
```

El script copia `monitoring/n8n/workflows/flujo-1-alerta-prometheus-glpi.json`, lo importa vía CLI en n8n, lo publica y reinicia el contenedor para dejar el webhook inmediatamente disponible en `http://localhost:5678/webhook/alerta-prometheus`.

*(Alternativa manual por interfaz web: acceder a `http://localhost:5678` -> Menú "Workflows" -> "Import from File" -> seleccionar `flujo-1-alerta-prometheus-glpi.json` -> Activar el switch en la esquina superior derecha).*

---

### Paso 3: Ejecución de la Suite de Pruebas Automatizadas

Se proporciona un script completo que valida los 8 escenarios de prueba:
```bash
chmod +x scripts/test-alerta-n8n-glpi.sh
./scripts/test-alerta-n8n-glpi.sh
```

**Resultado de la ejecución empírica:**
```
======================================================================
   SUITE DE PRUEBAS AUTOMATIZADAS - JOY-30 (n8n -> GLPI -> NOTIF)     
======================================================================

TEST: 1. Webhook Rechaza Petición sin Cabecera de Autenticación (401)
✔ [PASS] Petición sin autenticación es rechazada (HTTP 401 esperado)

TEST: 2. Webhook Rechaza Token Inválido (401)
✔ [PASS] Petición con token inválido es rechazada (HTTP 401 esperado)

TEST: 3. Validación de Estructura de Payload JSON (400 si payload vacío)
✔ [PASS] Payload sin alerta retorna 400 Bad Request (HTTP 400 esperado)

TEST: 4. E2E Happy Path: Alerta PostgresDown -> Ticket GLPI (201)
✔ [PASS] Alerta de BD crea ticket con éxito (HTTP 201 esperado)

TEST: 5. Mapeo ITIL: Alerta de Infraestructura / Docker (201, Cat 3)
✔ [PASS] Alerta de Infraestructura procesada (HTTP 201 esperado)

TEST: 6. Mapeo ITIL: Alerta de Seguridad / OWASP (201, Cat 1)
✔ [PASS] Alerta de Seguridad procesada (HTTP 201 esperado)

TEST: 7. Verificación del Incidente en API REST de GLPI
✔ [PASS] Ticket verificado en base de datos de GLPI (Prioridad 5, Técnico Asignado: mchambi)

TEST: 8. Manejo de Errores y Contingencia cuando GLPI no responde (502)
✔ [PASS] Manejo de contingencia activa respuesta 502 y notificación de emergencia

======================================================================
                       RESUMEN DE PRUEBAS                             
======================================================================
Pruebas Exitosas: 8
Pruebas Fallidas: 0

✔ TODOS LOS CRITERIOS DE ACEPTACIÓN SE CUMPLIERON EXITOSAMENTE.
```

---

### Paso 4: Pruebas Manuales con `curl`

Si se desea probar manualmente cada caso desde la terminal:

#### 1. Probar rechazo sin autenticación (debe dar 401):
```bash
curl -i -X POST http://localhost:5678/webhook/alerta-prometheus \
  -H "Content-Type: application/json" \
  -d '{"status":"firing"}'
```

#### 2. Probar envío de alerta de Base de Datos (crea ticket P5 en GLPI):
```bash
curl -i -X POST http://localhost:5678/webhook/alerta-prometheus \
  -H "X-Webhook-Token: LumiereWebhookSecret2026!" \
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
          "description": "Fallo crítico: lumiere-db no responde a peticiones."
        },
        "startsAt": "2026-11-14T20:55:00.000Z"
      }
    ]
  }'
```

#### 3. Verificar el ticket en la interfaz web de GLPI:
- Ingresar a [http://localhost:8086](http://localhost:8086)
- Usuario: `mchambi` | Contraseña: `Lumiere2026!`
- Ir a **Soporte ➔ Casos**: observar el ticket generado con título `[PROMETHEUS] PostgresDown`, asignado a Marcos Chambi, con prioridad Muy Alta (5) y categoría *Rendimiento y Base de Datos*.
