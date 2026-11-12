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
docker compose up -d
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