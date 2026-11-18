#!/usr/bin/env python3
"""
Carga los 36.000.000 de registros (6M por tabla) en PostgreSQL usando COPY.

Pensado para PCs con pocos recursos:
  - COPY en streaming: no hace INSERT fila por fila ni guarda nada en memoria.
  - Quita indices y FK antes de cargar y los reconstruye en bloque despues
    (mucho mas rapido y con menos CPU que mantenerlos fila por fila).
  - Carga tabla por tabla: si algo falla, se puede volver a ejecutar.
  - Opcional: pausa la replica durante la carga para liberar RAM/CPU.

Requisitos:
  - Docker Desktop con el contenedor "lumiere-db" corriendo y healthy.
  - Haber ejecutado antes: python datos/generar_datos.py

Uso:
    python datos/cargar_datos.py
    python datos/cargar_datos.py --si
    python datos/cargar_datos.py --pausar-replica
    python datos/cargar_datos.py --solo-indices
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

from config_datos import (
    COLUMNS,
    COUNTS,
    DROP_SQL,
    EXTRA_INDEX_SQL,
    FK_INDEX_SQL,
    FK_SQL,
    LOAD_ORDER,
    PK_SQL,
    SEQUENCE_SQL,
    TOTAL_ESPERADO,
    TRUNCATE_SQL,
)

RAIZ = Path(__file__).resolve().parent.parent
CSV_DIR = Path(__file__).resolve().parent / "csv"
CONTENEDOR = "lumiere-db"
REPLICA = "lumiere-db-replica"


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def leer_env():
    env = {}
    archivo = RAIZ / ".env"
    if archivo.exists():
        for linea in archivo.read_text(encoding="utf-8", errors="replace").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            env[clave.strip()] = valor.strip().strip('"').strip("'")
    return env


ENV = leer_env()
DB_NAME = ENV.get("DB_NAME", "trabajoFinal")
DB_USER = ENV.get("DB_USER", "postgres")


def docker(args, **kwargs):
    return subprocess.run(["docker"] + args, **kwargs)


def contenedor_corriendo(nombre: str) -> bool:
    r = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", nombre],
        capture_output=True, text=True,
    )
    return r.returncode == 0 and r.stdout.strip() == "true"


def esperar_saludable(nombre: str, timeout: int = 180):
    inicio = time.time()
    while time.time() - inicio < timeout:
        r = subprocess.run(
            ["docker", "inspect", "-f", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", nombre],
            capture_output=True, text=True,
        )
        estado = r.stdout.strip() if r.returncode == 0 else "no-existe"
        if estado == "healthy" or estado == "running":
            return True
        print("  esperando %s (%s)..." % (nombre, estado))
        time.sleep(3)
    return False


def psql(sql: str, capturar: bool = False):
    args = [
        "docker", "exec", "-i", CONTENEDOR,
        "psql", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1",
        "-U", DB_USER, "-d", DB_NAME,
        "-c", sql,
    ]
    if capturar:
        r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise RuntimeError("Error SQL:\n%s\n%s" % (r.stdout, r.stderr))
        return r.stdout.strip()
    r = subprocess.run(args)
    if r.returncode != 0:
        raise RuntimeError("Fallo al ejecutar SQL en PostgreSQL (codigo %s)" % r.returncode)
    return ""


def ejecutar_ddl(sql: str, titulo: str):
    inicio = time.time()
    print("  %-28s" % titulo, end="", flush=True)
    psql(sql)
    print("OK  (%.1f s)" % (time.time() - inicio))


def contar_lineas(archivo: Path) -> int:
    lineas = 0
    with open(archivo, "rb") as f:
        while True:
            bloque = f.read(4 * 1024 * 1024)
            if not bloque:
                break
            lineas += bloque.count(b"\n")
    return lineas


def formatear_mb(n: float) -> str:
    return "%.1f MB" % (n / (1024 * 1024))


def copiar_tabla(nombre: str):
    """
    Copia el CSV al contenedor y hace COPY del lado del servidor.

    Se probo que COPY por stdin (docker exec + psql) rinde ~3 MB/s en Windows,
    mientras que COPY desde un archivo dentro del contenedor rinde ~35 MB/s.
    Para 36M de filas la diferencia es de varios minutos.
    """
    archivo = CSV_DIR / (nombre + ".csv")
    if not archivo.exists():
        raise FileNotFoundError("No existe %s. Ejecute primero: python datos/generar_datos.py" % archivo)

    total_bytes = archivo.stat().st_size
    columnas = ", ".join('"%s"' % c for c in COLUMNS[nombre])
    destino = "/tmp/carga_%s.csv" % nombre
    inicio = time.time()

    print("  %-10s %10s filas  %8s  copiando" % (
        nombre, f"{COUNTS[nombre]:,}", formatear_mb(total_bytes)), end="", flush=True)

    proc = subprocess.Popen(["docker", "cp", str(archivo), "%s:%s" % (CONTENEDOR, destino)])
    while proc.poll() is None:
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(2)
    if proc.returncode != 0:
        raise RuntimeError("No se pudo copiar %s al contenedor." % archivo.name)
    segundos_copia = time.time() - inicio

    sql = (
        "SET synchronous_commit = off; "
        "SET work_mem = '64MB'; "
        "COPY public.%s (%s) FROM '%s' WITH (FORMAT csv, NULL '', ENCODING 'UTF8');"
        % (nombre, columnas, destino)
    )

    print("\r  %-10s %10s filas  %8s  copiado (%.0f s). COPY..." % (
        nombre, f"{COUNTS[nombre]:,}", formatear_mb(total_bytes), segundos_copia), end="", flush=True)

    inicio_copy = time.time()
    try:
        psql(sql)
    finally:
        subprocess.run(["docker", "exec", CONTENEDOR, "rm", "-f", destino],
                       capture_output=True, text=True)

    print("\r  %-10s %10s filas  %8s  OK (copia %.0f s + COPY %.0f s)" % (
        nombre, f"{COUNTS[nombre]:,}", formatear_mb(total_bytes),
        segundos_copia, time.time() - inicio_copy))


def esperar_replica(timeout: int):
    if not contenedor_corriendo(REPLICA):
        print("  replica no esta corriendo; se omite la espera.")
        return
    print("  esperando que la replica aplique el WAL", end="", flush=True)
    inicio = time.time()
    while time.time() - inicio < timeout:
        try:
            salida = psql(
                "SELECT COALESCE(MIN(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn))::bigint, -1) "
                "FROM pg_stat_replication;",
                capturar=True,
            )
            if salida and salida != "" and int(salida.splitlines()[0]) == 0:
                print("  OK (%.1f s)" % (time.time() - inicio))
                return
        except Exception:
            pass
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(2)
    print("\n  AVISO: la replica sigue sincronizando. Puede verla con:")
    print('    docker exec lumiere-db psql -U %s -d %s -c "SELECT state, replay_lsn FROM pg_stat_replication;"' % (DB_USER, DB_NAME))


# --------------------------------------------------------------------------
# Pasos
# --------------------------------------------------------------------------
def validar_csv():
    print("  verificando archivos CSV...")
    problemas = []
    for nombre in LOAD_ORDER:
        archivo = CSV_DIR / (nombre + ".csv")
        if not archivo.exists():
            problemas.append("falta %s" % archivo)
            continue
        lineas = contar_lineas(archivo)
        if lineas != COUNTS[nombre]:
            problemas.append("%s tiene %s filas y se esperaban %s" % (archivo.name, f"{lineas:,}", f"{COUNTS[nombre]:,}"))
    if problemas:
        print("\n  ERROR: los CSV no son validos:")
        for p in problemas:
            print("   - %s" % p)
        print("\n  Vuelva a generarlos con: python datos/generar_datos.py")
        sys.exit(1)
    print("  archivos OK (%s filas en total)." % f"{TOTAL_ESPERADO:,}")


def resumen_final():
    print("\n  conteo final en la base:")
    print("  %-12s %12s" % ("tabla", "filas"))
    print("  " + "-" * 26)
    total = 0
    for nombre in LOAD_ORDER:
        n = int(psql("SELECT count(*) FROM public.%s;" % nombre, capturar=True) or 0)
        total += n
        marca = "OK" if n == COUNTS[nombre] else "REVISAR"
        print("  %-12s %12s  %s" % (nombre, f"{n:,}", marca))
    print("  " + "-" * 26)
    print("  %-12s %12s" % ("TOTAL", f"{total:,}"))


def main():
    parser = argparse.ArgumentParser(description="Carga masiva con COPY (36M: 6M por tabla).")
    parser.add_argument("--si", action="store_true", help="No pedir confirmacion")
    parser.add_argument("--no-verificar", action="store_true", help="No contar las lineas de los CSV")
    parser.add_argument("--pausar-replica", action="store_true",
                        help="Detiene la replica durante la carga (libera RAM/CPU; luego se sincroniza)")
    parser.add_argument("--sin-indices", action="store_true",
                        help="No crea los indices analiticos (carga mas rapida; se crean despues con --solo-indices)")
    parser.add_argument("--solo-indices", action="store_true", help="Solo reconstruir todos los indices y FK")
    parser.add_argument("--esperar-replica", type=int, default=1800,
                        help="Segundos maximos a esperar por la replica (0 = no esperar)")
    args = parser.parse_args()

    print("=" * 64)
    print(" Carga masiva - Joyeria Lumiere")
    print(" Base: %s   Contenedor: %s" % (DB_NAME, CONTENEDOR))
    print("=" * 64)

    if not contenedor_corriendo(CONTENEDOR):
        print("\nERROR: el contenedor %s no esta corriendo." % CONTENEDOR)
        print("Ejecute en la raiz del proyecto:")
        print("  docker compose up -d db db-replica pgadmin")
        sys.exit(1)

    if not esperar_saludable(CONTENEDOR, 120):
        print("ERROR: %s no llego a estado healthy." % CONTENEDOR)
        sys.exit(1)

    try:
        psql("SELECT 1;", capturar=True)
    except Exception:
        print("ERROR: no se pudo conectar a la base %s." % DB_NAME)
        sys.exit(1)

    # Limpiar CSV temporales que hayan quedado de una corrida interrumpida.
    subprocess.run(["docker", "exec", CONTENEDOR, "sh", "-c", "rm -f /tmp/carga_*.csv"],
                   capture_output=True, text=True)

    replica_pausada = False
    try:
        if not args.solo_indices:
            if not args.no_verificar:
                validar_csv()

            if not args.si:
                print("\n  ATENCION: se van a borrar y recargar las 6 tablas:")
                print("    " + ", ".join(LOAD_ORDER))
                print("  Los datos actuales de esas tablas se pierden.")
                respuesta = input("\n  Escriba SI para continuar: ").strip().upper()
                if respuesta != "SI":
                    print("  Cancelado.")
                    return

            if args.pausar_replica and contenedor_corriendo(REPLICA):
                print("\n  pausando replica para liberar recursos...")
                docker(["stop", REPLICA], capture_output=True, text=True)
                replica_pausada = True

            print("\n[1/6] Preparando tablas (quitando indices y claves foraneas)...")
            ejecutar_ddl(DROP_SQL, "drop indices/constraints")
            ejecutar_ddl(TRUNCATE_SQL, "truncate de las 6 tablas")

            print("\n[2/6] Cargando datos con COPY...")
            for nombre in LOAD_ORDER:
                copiar_tabla(nombre)

            print("\n[3/6] Reconstruyendo claves primarias y unicos...")
            ejecutar_ddl("SET maintenance_work_mem = '256MB'; " + PK_SQL, "primary keys")

            print("\n[4/6] Creando indices de claves foraneas...")
            ejecutar_ddl(
                "SET maintenance_work_mem = '256MB'; SET max_parallel_maintenance_workers = 2; " + FK_INDEX_SQL,
                "indices FK",
            )

            print("\n[5/6] Creando claves foraneas...")
            ejecutar_ddl(FK_SQL, "foreign keys")

            print("\n[6/6] Indices analiticos, secuencias y analyze...")
            if args.sin_indices:
                print("  indices analiticos       OMITIDOS (--sin-indices). Se crean despues con: python datos/cargar_datos.py --solo-indices")
            else:
                ejecutar_ddl(
                    "SET maintenance_work_mem = '256MB'; SET max_parallel_maintenance_workers = 2; " + EXTRA_INDEX_SQL,
                    "indices de consulta",
                )
            ejecutar_ddl(SEQUENCE_SQL, "secuencias")
            ejecutar_ddl("ANALYZE;", "analyze")
        else:
            print("\n[1/5] Quitando indices y constraints existentes...")
            ejecutar_ddl(DROP_SQL, "drop indices/constraints")
            print("\n[2/5] Reconstruyendo claves primarias y unicos...")
            ejecutar_ddl("SET maintenance_work_mem = '256MB'; " + PK_SQL, "primary keys")
            print("\n[3/5] Creando indices de claves foraneas...")
            ejecutar_ddl(
                "SET maintenance_work_mem = '256MB'; SET max_parallel_maintenance_workers = 2; " + FK_INDEX_SQL,
                "indices FK",
            )
            print("\n[4/5] Creando claves foraneas...")
            ejecutar_ddl(FK_SQL, "foreign keys")
            print("\n[5/5] Creando indices de consulta, secuencias y analyze...")
            ejecutar_ddl(
                "SET maintenance_work_mem = '256MB'; SET max_parallel_maintenance_workers = 2; " + EXTRA_INDEX_SQL,
                "indices de consulta",
            )
            ejecutar_ddl(SEQUENCE_SQL, "secuencias")
            ejecutar_ddl("ANALYZE;", "analyze")

        if replica_pausada:
            print("\n  reiniciando replica...")
            docker(["start", REPLICA], capture_output=True, text=True)
            replica_pausada = False

        if args.esperar_replica > 0:
            esperar_replica(args.esperar_replica)

        resumen_final()
        print("\n  Carga finalizada.")
        print("  Siguiente paso: python datos/crear_dump.py")
    finally:
        if replica_pausada:
            print("\n  reiniciando replica (salida no normal)...")
            docker(["start", REPLICA], capture_output=True, text=True)
            if args.esperar_replica > 0:
                esperar_replica(args.esperar_replica)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrumpido por el usuario.")
        sys.exit(130)
    except Exception as e:
        print("\nERROR: %s" % e)
        sys.exit(1)
