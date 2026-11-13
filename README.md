# Base de datos con volumen persistente y pgAdmin

PostgreSQL 17 en red Docker interna, volumen nombrado, pgAdmin local y scripts de backup/restauración en `.sql`.

```
 Tu máquina ──127.0.0.1:5050──► pgadmin ──┐
                                           ├─ db-net (interna, sin acceso exterior) ──► db (PostgreSQL)
                                           │                                              │
                                  admin-net┘                                  volumen lumiere_pgdata
```

## Estructura

```
├── docker-compose.yml
├── .env.example              ← plantilla; el .env real NO se sube a git
├── db/init/                  ← esquema inicial (01-schema.sql, 02-indices.sql)
├── pgadmin/servers.json      ← registra la base automáticamente en pgAdmin
├── scripts/
│   ├── backup.sh             ← genera backups/lumiere_AAAAMMDD_HHMMSS.sql
│   ├── restore.sh            ← restaura un .sql
│   └── verificar-persistencia.sh
└── backups/
```

## Puesta en marcha

```bash
cp .env.example .env          # completar DB_PASSWORD y PGADMIN_PASSWORD
docker compose up -d --build  (levanta el proyecto buscando los dockerfile de las carpetas)
docker compose ps             # db: healthy
```

pgAdmin: http://localhost:5050 → iniciar sesión con `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` → servidor «Lumiere (contenedor db)» (pide la contraseña `DB_PASSWORD` la primera vez) → *Schemas › public › Tables* → clic derecho › *View/Edit Data*.

## Criterios de aceptación y cómo comprobarlos

| Criterio | Cómo se cumple | Cómo comprobarlo |
|---|---|---|
| Motor en red interna, no expuesto | `db-net` con `internal: true`; el servicio `db` no tiene `ports` | `docker compose ps` (la columna PORTS de `db` muestra solo `5432/tcp`, sin `->`) y `docker network inspect lumiere-db-minimo_db-net --format '{{.Internal}}'` → `true`. Desde el host, `psql -h localhost -p 5432` debe fallar. |
| Volumen nombrado persistente | `lumiere_pgdata` montado en `/var/lib/postgresql/data` | `./scripts/verificar-persistencia.sh` (inserta un dato, hace `docker compose down` y `up`, y confirma que el dato sigue) |
| Cliente web accesible localmente | `pgadmin` publicado solo en `127.0.0.1:5050` | Abrir http://localhost:5050; desde otro equipo de la red no responde |
| Backup y restauración `.sql` | `scripts/backup.sh` y `scripts/restore.sh` | ver abajo |

> El nombre del proyecto Compose (prefijo de la red) es el de la carpeta; ajuste el comando de `docker network inspect` si la carpeta se llama distinto (`docker network ls` lo muestra).

## Backups

```bash
./scripts/backup.sh                                   # crea backups/lumiere_<fecha>.sql
./scripts/restore.sh backups/lumiere_<fecha>.sql      # pide confirmación (use -y para omitirla)
```

- El dump se hace con `pg_dump --clean --if-exists` dentro del contenedor, de modo que restaurar **reemplaza** las tablas en lugar de duplicar filas.
- Se rechaza un backup incompleto (se verifica la línea final del dump).
- La restauración es atómica: ante cualquier error no se modifica nada.
- Cada operación queda en `backups/backup.log` con su duración. Se conservan las últimas 7 copias (`BACKUP_KEEP=N` para cambiarlo).
- Para automatizar (cron del host, diario a las 3:00):
  `0 3 * * * cd /ruta/al/proyecto && ./scripts/backup.sh >> backups/cron.log 2>&1`

Los `.sql` contienen datos reales (incluidos hashes de contraseñas): no los suba a git (ya están en `.gitignore`) y guarde una copia fuera de esta máquina.

## Notas

- `db/init/` solo se ejecuta cuando el volumen está vacío. Si cambia el esquema, aplíquelo con SQL sobre la base o recree el volumen (`docker compose down -v`, **borra todos los datos**).
- `docker compose down` conserva los datos; `docker compose down -v` los destruye.
- Si ya tiene datos en una base local, puede cargarlos con `./scripts/restore.sh` a partir de un `pg_dump --clean --if-exists --no-owner` de esa base.

---

## Módulo de Gestión Operativa y Mesa de Ayuda (GLPI - JOY-20)

Para la gestión de incidentes ITIL, categorización operativa y conexión con n8n/Prometheus, consultar la documentación detallada en [glpi/README.md](glpi/README.md):

```bash
cd glpi
./setup.sh
```
- Acceso Web: http://localhost:8086 (Credenciales para integrantes: `<usuario>` / `Lumiere2026!`).
- API REST: http://localhost:8086/apirest.php (App-Token configurado para n8n).
# Procedimiento Operativo Estándar: Rollback y Recuperación ante Fallos

## 1. Detección del Incidente
Un fallo en producción se considera crítico si:
- Las pruebas de salud (Healthchecks) responden con códigos de estado HTTP 5xx.
- Ocurren excepciones no controladas en los logs del servidor post-despliegue.

## 2. Mecanismos de Reversión

### Opción A: Rollback mediante Reversión en Git (Método Automatizado Preferido)
1. Identificar el commit estable anterior en la rama `main`.
2. Crear un commit de reversión local y enviarlo al repositorio:
   git revert HEAD --no-edit
   git push origin main
3. GitHub Actions ejecutará automáticamente el pipeline completo, construyendo y desplegando la versión previa garantizada.

### Opción B: Rollback Inmediato en Servidor por SHA (Método de Emergencia < 2 Minutos)
Si la aplicación no responde y el pipeline tarda demasiado en compilar:
1. Conectarse al servidor vía SSH.
2. Identificar el SHA del commit estable anterior en el registro de contenedores (GHCR).
3. Reemplazar el contenedor en producción ejecutando:
   docker stop app-prod
   docker rm app-prod
   docker run -d --name app-prod -p 80:3000 --restart always ghcr.io/tu-usuario/tu-repo:<COMMIT_SHA_ANTERIOR>

## 3. Post-Mortem y Análisis de Fallo
1. Extraer los registros del contenedor fallido antes de su destrucción:
   docker logs app-prod > error_logs_$(date +%F).log
2. Analizar el log en búsqueda de dependencias faltantes, errores de migración de base de datos o fallos de variables de entorno.
3. Incorporar una nueva prueba unitaria o de integración en el pipeline que replique la falla para prevenir su reaparición futura.


---

## Clúster de Base de Datos: Topología Maestro-Esclavo (Primario + Réplica)

Se configuró una arquitectura de alta disponibilidad y segregación de lectura/escritura mediante **Streaming Replication** física nativa de PostgreSQL 17:
- **Nodo Primario (`lumiere-db`):** Responsable de las transacciones de escritura (`INSERT`, `UPDATE`, `DELETE`, DDL). Genera los registros WAL (*Write-Ahead Logging*) y los transmite mediante un replication slot (`replica_slot`).
- **Nodo Réplica (`lumiere-db-replica`):** Servidor en modo *Hot Standby* de solo lectura. Clona el estado inicial del primario vía `pg_basebackup` y se mantiene sincronizado en tiempo real.
- **Backend (Express + Sequelize):** Pool de conexiones dual (`replication: { write: ..., read: [...] }`). Las consultas de lectura se derivan automáticamente a la réplica y las escrituras al nodo primario.
- **Endpoint de Monitoreo:** `GET /api/health` reporta el estado y conectividad de ambos nodos del clúster.

### Diagrama de Red y Topología del Clúster

```mermaid
flowchart TD
    subgraph Host["Host Machine"]
        Client["Navegador / Cliente API"]
    end

    subgraph AdminNet["Docker Network: admin-net (Bridge)"]
        Frontend["Frontend: joyeria-frontend (Port 8080:80)"]
        Backend["Backend API: joyeria-backend (Port 3000:3000)"]
        PgAdmin["pgAdmin 4: lumiere-pgadmin (Port 127.0.0.1:5050:80)"]
        Tunnel["Cloudflare Tunnel: joyeria-tunnel"]
    end

    subgraph DbNet["Docker Network: db-net (internal: true)"]
        Primary["DB Primario: lumiere-db (5432/tcp) - ESCRITURA"]
        Replica["DB Réplica: lumiere-db-replica (5432/tcp) - LECTURA"]
        VolPrimary[("Volumen: lumiere_pgdata")]
        VolReplica[("Volumen: lumiere_pgdata_replica")]
    end

    Client -->|HTTP 8080| Frontend
    Client -->|HTTP 3000| Backend
    Client -->|HTTP 5050| PgAdmin

    Frontend -->|HTTP /api| Backend
    Tunnel --> Frontend

    Backend -->|Sequelize Write / DDL: 5432| Primary
    Backend -->|Sequelize Read: 5432| Replica

    PgAdmin -->|Admin: 5432| Primary
    PgAdmin -->|Admin: 5432| Replica

    Primary -.->|Streaming Replication WAL / 5432 (Slot: replica_slot)| Replica
    Primary --- VolPrimary
    Replica --- VolReplica
```

### Matriz de Puertos y Servicios

| Servicio | Contenedor | Redes | Puerto Interno | Puerto Host / Exposición | Rol |
|---|---|---|---|---|---|
| `db` | `lumiere-db` | `db-net` | 5432/tcp | Aislado (sin acceso exterior) | Primario (Escritura y WAL streaming) |
| `db-replica` | `lumiere-db-replica` | `db-net` | 5432/tcp | Aislado (sin acceso exterior) | Réplica (Hot Standby - Solo Lectura) |
| `pgadmin` | `lumiere-pgadmin` | `db-net`, `admin-net` | 80/tcp | `127.0.0.1:5050` | Administrador visual de ambos nodos |
| `backend` | `joyeria-backend` | `db-net`, `admin-net` | 3000/tcp | `0.0.0.0:3000` | API REST con dual-pool Sequelize |
| `frontend` | `joyeria-frontend` | `admin-net` | 80/tcp | `0.0.0.0:8080` | SPA Angular + Nginx |

### Script de Verificación Automática de Replicación

Para validar la sincronización automática y la restricción de solo lectura:
```bash
chmod +x scripts/verificar-replicacion.sh
./scripts/verificar-replicacion.sh
```
El script comprueba:
1. Roles `pg_is_in_recovery()` (`f` para primario, `t` para réplica).
2. Estado del canal WAL (`pg_stat_replication` y `pg_stat_wal_receiver`).
3. Inserción de un registro en el primario y verificación de su lectura inmediata en la réplica.
4. Rechazo de transacciones de escritura directa en la réplica (`read-only transaction`).

---

## Prueba de Fallo Controlado (Failover) y Alta Disponibilidad

Se diseñó y validó una suite de prueba de fallo controlado para evaluar el comportamiento del sistema ante la caída inesperada del nodo primario (`lumiere-db`), midiendo los indicadores de resiliencia **RTO** (*Recovery Time Objective*) y **RPO** (*Recovery Point Objective*).

### Resumen de Métricas de Resiliencia Obtenidas

| Métrica | Objetivo de Diseño | Resultado Empírico | Comportamiento del Sistema |
|---|---|---|---|
| **RTO** (Tiempo de Recuperación) | $< 60$ s | **6 s a 26 s** | Restablecimiento total de escrituras sobre nuevo primario promovido |
| **RPO** (Pérdida de Datos) | $0$ transacciones | **0 s (0 bytes)** | Cero pérdida de transacciones. Sincronía WAL completa |
| **Persistencia tras Failback** | $100\%$ retención | **100% Preservado** | Transacciones post-failover sincronizadas sin pérdidas hacia el nodo original |
| **Lecturas en Modo Degradado** | $100\%$ uptime | **HTTP 200 (0.004s)** | Despachadas sin interrupción por el nodo réplica |
| **Escrituras durante la Caída** | Rechazo Atómico | **HTTP 400 (0.088s)** | Previene *split-brain* e incoherencias de datos |
| **Promoción de Base de Datos** | $< 5$ s | **1.21 s a 3.96 s** | Promoción nativa con `SELECT pg_promote()` o `pg_ctl promote` |

### Scripts Operativos de Failover y Restauración

```bash
# 1. Simulación Automatizada Completa de Fallo Controlado con auto-restauración y verificación de persistencia:
./scripts/simular-failover.sh --restore

# 2. Simulación utilizando el método alternativo de control pg_ctl:
./scripts/simular-failover.sh --restore --method=pg_ctl

# 3. Promoción asistida / semiautomática de la réplica a nuevo primario:
./scripts/promover-replica.sh                 # Método SQL pg_promote()
./scripts/promover-replica.sh --method=pg_ctl # Método de proceso pg_ctl

# 4. Restauración de la topología base (lumiere-db primario y db-replica standby con preservación de datos):
./scripts/restaurar-cluster.sh
```
