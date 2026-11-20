# Carga masiva: 36.000.000 de registros (6M por tabla)

Esta carpeta contiene todo lo necesario para generar, cargar, respaldar y
restaurar los datos de prueba del proyecto **sin saturar la PC**.

## 1. Qué se genera

Según el requerimiento de JIRA: **6.000.000 de filas por tabla**.

| Tabla | Filas | Para qué sirve |
|---|---:|---|
| `usuarios` | 6.000.000 | login, dashboard, auditoría |
| `productos` | 6.000.000 | catálogo, filtros, stock |
| `pedidos` | 6.000.000 | reportes por fecha y estado |
| `detalles` | 6.000.000 | ventas por categoría y producto |
| `pagos` | 6.000.000 | ingresos aprobados |
| `accesos` | 6.000.000 | auditoría de ingresos |
| **Total** | **36.000.000** | |

Los datos son **coherentes entre sí**:

- Todos los `id` existen y son consecutivos.
- `pedidos.usuarioId` siempre apunta a un usuario real.
- `detalles.pedidoId` y `detalles.productoId` apuntan a filas reales.
- `pagos.pedidoId` apunta a un pedido real.
- `accesos.usuarioId` apunta a un usuario real.
- El `total` de cada pedido es la suma real de sus detalles.
- Hay pedidos en todos los estados y pagos `APROBADO`, `PENDIENTE` y `RECHAZADO`.
- Semilla fija: quien ejecute el generador obtiene **exactamente los mismos datos**.

## 2. Estrategia para no saturar la PC

- **`COPY`, no `INSERT` fila por fila.** Se copia el CSV al contenedor y se
  ejecuta `COPY` del lado del servidor (probado ~7 veces más rápido que
  pasar el archivo por el pipe de Docker en Windows).
- **Sin índices analíticos durante la carga.** Primero se cargan los datos y
  las claves (PK, unique y FK). Los 8 índices de consulta se dejan para
  después, tal como se acordó: la carga prioriza que salga bien.
- **Reconstrucción de claves en bloque.** Se eliminan PK/FK antes de cargar y
  se crean después, que es mucho más rápido que mantenerlas fila por fila.
- **Pausa opcional de la réplica** durante la carga (`--pausar-replica`) para
  liberar CPU/RAM; después se sincroniza sola.
- **Todo es repetible.** Si se corta, se vuelve a ejecutar y empieza de cero.
  Cada tabla se carga en una transacción `COPY`: nunca queda a medias.

## 3. Requisitos

- Docker Desktop iniciado.
- Python 3.10 o superior (`python --version`).
- ~18 GB libres en disco para todo el proceso
  (CSV 3,7 GB + base 5,6 GB + réplica 5,6 GB + dump 0,83 GB, más espacio temporal).
- No hace falta RAM extra: la carga usa `COPY` en streaming por archivo.

## 4. Flujo completo (lo hace una sola persona)

Desde la raíz del proyecto:

```bash
# 1) Base y réplica arriba
docker compose up -d db db-replica pgadmin

# 2) Generar los CSV (~8 minutos)
python datos/generar_datos.py

# 3) Cargar en PostgreSQL (~20 minutos)
python datos/cargar_datos.py --sin-indices

# 4) Crear el dump para compartir (~4 minutos, ~830 MB)
python datos/crear_dump.py
```

Tiempos medidos en la PC del equipo (4 núcleos, ~5,9 GB de RAM):

| Paso | Tiempo |
|---|---:|
| Generar los 36M de CSV (3,7 GB) | 457 s |
| Copiar CSV al contenedor | 566 s |
| `COPY` de las 6 tablas | 403 s |
| PK y unique | 142 s |
| Índices de FK | 89 s |
| FK | 29 s |
| `ANALYZE` | 10 s |
| **Carga total** | **~21 min** |
| Crear el dump (830 MB) | 247 s |

En Windows también se puede hacer doble clic en:

1. `1_generar_datos.bat`
2. `2_cargar_datos.bat`   (ya incluye `--sin-indices`)
3. `3_crear_dump.bat`

Al final quedan:

```
backups/lumiere-36m.dump          <- se comparte
backups/lumiere-36m.dump.sha256   <- se comparte
```

### Opciones útiles de la carga

```bash
python datos/cargar_datos.py --si              # sin confirmación
python datos/cargar_datos.py --sin-indices     # omite los 8 índices de consulta
python datos/cargar_datos.py --pausar-replica  # libera RAM/CPU; la réplica se sincroniza después
python datos/cargar_datos.py --no-verificar    # no vuelve a contar las líneas de los CSV
python datos/cargar_datos.py --solo-indices    # crea TODOS los índices/FK (para después)
```

Cuando ya no se esté cargando nada y se quiera optimizar consultas:

```bash
python datos/cargar_datos.py --solo-indices
```

Ese comando borra y recrea PK, unique, índices y FK sobre los datos ya
cargados. Es el paso de "optimización de consultas con índices" que quedó
pendiente.

## 5. Flujo para los compañeros (solo restaurar)

1. Clonar el repositorio.
2. Crear el `.env`:

   ```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Linux/macOS
   ```

   Completar `DB_PASSWORD` y `PGADMIN_PASSWORD`.

3. Copiar `lumiere-36m.dump` y `lumiere-36m.dump.sha256` dentro de `backups/`.

4. Ejecutar **uno** de estos:

   - Windows: doble clic en `RESTAURAR_DATOS.bat`.
   - Consola:

     ```bash
     python datos/restaurar_dump.py --si
     ```

El script:

- Verifica el SHA256 del dump.
- Levanta `db`, `db-replica` y `pgadmin` si están detenidos.
- Copia el dump al contenedor y restaura desde ahí (mucho más rápido que
  enviarlo por `stdin` en Windows).
- Restaura en **una sola transacción** (si falla, no deja la base a medias).
- Ejecuta `ANALYZE`.
- Compara el conteo de las seis tablas contra 36.000.000.
- Espera a que la réplica se sincronice.

Tiempo medido de la restauración completa: **~14 min**
(122 s de copia del dump + 705 s de `pg_restore`), incluida la creación de
PK, unique e índices de FK.

El dump **reemplaza** las tablas existentes. No se debe ejecutar si el
compañero ya cargó datos propios que quiera conservar.

> El dump incluye PK, unique, FK e índices de FK, pero **no** los 8 índices
> analíticos si se generó con `--sin-indices`. Se pueden crear con
> `python datos/cargar_datos.py --solo-indices`.

## 6. Credenciales cargadas

| Usuario | Contraseña | Perfil |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `empleado_0002` ... `empleado_0021` | `cliente123` | Empleado |
| `user_000022` ... `user_6000000` | `cliente123` | Cliente |

Los hashes se generaron con bcrypt (10 rondas), igual que el backend.

## 7. Verificación rápida

```bash
docker exec lumiere-db psql -U postgres -d trabajoFinal -c "
SELECT 'usuarios' AS tabla, count(*) FROM usuarios
UNION ALL SELECT 'productos', count(*) FROM productos
UNION ALL SELECT 'pedidos',   count(*) FROM pedidos
UNION ALL SELECT 'detalles',  count(*) FROM detalles
UNION ALL SELECT 'pagos',     count(*) FROM pagos
UNION ALL SELECT 'accesos',   count(*) FROM accesos;"
```

Integridad referencial (debe devolver 0 en todas):

```bash
docker exec lumiere-db psql -U postgres -d trabajoFinal -c "
SELECT count(*) FROM pedidos p LEFT JOIN usuarios u ON u.id = p.\"usuarioId\" WHERE u.id IS NULL;
SELECT count(*) FROM pagos p LEFT JOIN pedidos o ON o.id = p.\"pedidoId\" WHERE o.id IS NULL;
SELECT count(*) FROM detalles d LEFT JOIN productos pr ON pr.id = d.\"productoId\" WHERE pr.id IS NULL;"
```

Tamaño de la base:

```bash
docker exec lumiere-db psql -U postgres -d trabajoFinal -c "SELECT pg_size_pretty(pg_database_size('trabajoFinal'));"
```

Réplica:

```bash
docker exec lumiere-db psql -U postgres -d trabajoFinal -c "SELECT state, replay_lsn FROM pg_stat_replication;"
docker exec lumiere-db-replica psql -U postgres -d trabajoFinal -c "SELECT count(*) FROM pedidos;"
```

## 8. Advertencia sobre el backend

Con 6M de filas por tabla hay endpoints que hoy **no paginan** y traen todo:

- `GET /api/productos` → `Producto.findAll()` (6M de productos).
- `GET /api/productos/categoria/:categoria` → ~1,5M por categoría.
- `GET /api/usuario` → `Usuario.findAll()` (6M de usuarios).

Esos endpoints pueden agotar la RAM del navegador/backend. La carga de datos
es independiente; antes de una demo conviene agregar `limit`/`offset` o
paginación en el backend. Los índices de `--solo-indices` ayudan, pero no
evitan traer 6M de filas a memoria.

## 9. Problemas comunes

| Síntoma | Solución |
|---|---|
| `el contenedor lumiere-db no está corriendo` | `docker compose up -d db db-replica pgadmin` |
| `los CSV no son válidos` | Volver a ejecutar `python datos/generar_datos.py` |
| `COPY de ... falló` | Verificar que el volumen se creó con `db/init/01-schema.sql`; recrear solo si no hay datos que conservar: `docker compose down -v` (borra todo) |
| Se cortó la carga | Volver a ejecutar `python datos/cargar_datos.py --sin-indices` (empieza de cero) |
| Se cortó al crear índices | `python datos/cargar_datos.py --solo-indices` |
| `no space left on device` | Borrar dumps anteriores de `backups/`; los CSV nuevos pesan ~3,5 GB |
| La réplica queda atrasada | Es normal tras una carga grande; esperar o revisar `pg_stat_replication` |
| `pg_restore: error: ... is being accessed by other users` | Detener backend/frontend antes de restaurar: `docker compose stop backend frontend` |
| El `.env` no existe o está vacío | `copy .env.example .env` y completar contraseñas |

## 10. Cambiar la distribución

Editar `COUNTS` en `datos/config_datos.py` y volver a generar. Reglas:

- `pagos` ≤ `pedidos` (cada pago necesita un pedido).
- `detalles` ≥ `pedidos` (cada pedido necesita al menos un detalle).
- El total se recalcula solo (`TOTAL_ESPERADO`).

Si cambia el esquema (`db/init/01-schema.sql` o `02-indices.sql`), actualizar
también `COLUMNS`, `PK_SQL`, `INDEX_SQL` y `FK_SQL` en `config_datos.py`.
