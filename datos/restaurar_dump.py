#!/usr/bin/env python3
"""
Restaura el dump de 36.000.000 de registros (6M por tabla) en el PostgreSQL del proyecto.

Pensado para que lo ejecute cualquier companero con Docker Desktop:
    python datos/restaurar_dump.py
    python datos/restaurar_dump.py backups/lumiere-36m.dump --si

El dump se aplica en UNA sola transaccion: si algo falla, la base queda
como estaba (no se pierden datos a medias).
"""

import argparse
import hashlib
import os
import subprocess
import sys
import time
from pathlib import Path

from config_datos import COUNTS, TOTAL_ESPERADO

RAIZ = Path(__file__).resolve().parent.parent
CONTENEDOR = "lumiere-db"
REPLICA = "lumiere-db-replica"
DUMP_POR_DEFECTO = RAIZ / "backups" / "lumiere-36m.dump"


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


def contenedor_existe(nombre: str) -> bool:
    r = subprocess.run(["docker", "inspect", "-f", "{{.Name}}", nombre],
                       capture_output=True, text=True)
    return r.returncode == 0


def estado_contenedor(nombre: str) -> str:
    r = subprocess.run(
        ["docker", "inspect", "-f",
         "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", nombre],
        capture_output=True, text=True,
    )
    return r.stdout.strip() if r.returncode == 0 else "no-existe"


def esperar_estado(nombre: str, timeout: int = 300) -> bool:
    inicio = time.time()
    while time.time() - inicio < timeout:
        estado = estado_contenedor(nombre)
        if estado in ("healthy", "running"):
            return True
        print("  esperando %s (%s)..." % (nombre, estado))
        time.sleep(4)
    return False


def comando_compose():
    for candidato in (["docker", "compose"], ["docker-compose"]):
        r = subprocess.run(candidato + ["version"], capture_output=True, text=True)
        if r.returncode == 0:
            return candidato
    return None


def psql(sql: str, capturar: bool = False):
    args = [
        "docker", "exec", "-i", CONTENEDOR,
        "psql", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1",
        "-U", DB_USER, "-d", DB_NAME, "-c", sql,
    ]
    if capturar:
        r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise RuntimeError(r.stdout + "\n" + r.stderr)
        return r.stdout.strip()
    r = subprocess.run(args)
    if r.returncode != 0:
        raise RuntimeError("Fallo SQL (codigo %s)" % r.returncode)


def verificar_hash(archivo: Path) -> bool:
    sha_file = archivo.parent / (archivo.name + ".sha256")
    if not sha_file.exists():
        print("  AVISO: no hay archivo .sha256; se omite la verificacion.")
        return True
    esperado = sha_file.read_text(encoding="utf-8").split()[0].strip().lower()
    h = hashlib.sha256()
    with open(archivo, "rb") as f:
        while True:
            bloque = f.read(4 * 1024 * 1024)
            if not bloque:
                break
            h.update(bloque)
    real = h.hexdigest()
    if real != esperado:
        print("  ERROR: el SHA256 no coincide. El archivo esta corrupto o incompleto.")
        print("    esperado: %s" % esperado)
        print("    real:     %s" % real)
        return False
    print("  SHA256 OK.")
    return True


def formatear_mb(n: float) -> str:
    return "%.1f MB" % (n / (1024 * 1024))


def restaurar(archivo: Path):
    """
    Copia el dump al contenedor y restaura desde ahi.

    Enviar el dump por stdin a `docker exec` rinde ~3 MB/s en Windows; copiarlo
    al contenedor y leerlo desde el disco del contenedor es varias veces mas
    rapido para un dump de mas de 1 GB.
    """
    total = archivo.stat().st_size
    destino = "/tmp/restaurar_%s" % archivo.name
    print("\n Copiando el dump al contenedor (%s)..." % formatear_mb(total))
    inicio = time.time()

    proc = subprocess.Popen(["docker", "cp", str(archivo), "%s:%s" % (CONTENEDOR, destino)])
    while proc.poll() is None:
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(2)
    if proc.returncode != 0:
        raise RuntimeError("no se pudo copiar el dump al contenedor.")
    print("\r  copiado en %.1f s%s" % (time.time() - inicio, " " * 20))

    print(" Restaurando en una sola transaccion (puede tardar varios minutos)...")
    inicio = time.time()
    proc = subprocess.Popen(
        [
            "docker", "exec", CONTENEDOR,
            "pg_restore", "-U", DB_USER, "-d", DB_NAME,
            "--clean", "--if-exists", "--no-owner", "--no-privileges",
            "--single-transaction", "--exit-on-error", destino,
        ],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    salida = []
    while proc.poll() is None:
        sys.stdout.write("\r  restaurando... %.0f s" % (time.time() - inicio))
        sys.stdout.flush()
        time.sleep(2)
    resto = proc.stdout.read().decode("utf-8", "replace")
    if resto.strip():
        salida.append(resto.strip())
    subprocess.run(["docker", "exec", CONTENEDOR, "rm", "-f", destino],
                   capture_output=True, text=True)

    if proc.returncode != 0:
        detalle = "\n".join(salida)
        raise RuntimeError("pg_restore fallo (codigo %s). La base no se modifico.\n%s"
                           % (proc.returncode, detalle))
    print("\r  restauracion completada en %.1f s%s" % (time.time() - inicio, " " * 20))


def main():
    parser = argparse.ArgumentParser(description="Restaura el dump masivo de 36M de registros.")
    parser.add_argument("dump", nargs="?", default=str(DUMP_POR_DEFECTO),
                        help="Ruta al archivo .dump")
    parser.add_argument("--si", action="store_true", help="No pedir confirmacion")
    parser.add_argument("--sin-hash", action="store_true", help="No verificar SHA256")
    parser.add_argument("--esperar-replica", type=int, default=1800,
                        help="Segundos maximos a esperar por la replica")
    args = parser.parse_args()

    archivo = Path(args.dump).resolve()
    print("=" * 64)
    print(" Restauracion de datos - Joyeria Lumiere")
    print(" Dump: %s" % archivo)
    print("=" * 64)

    if not archivo.exists():
        print("\nERROR: no existe el archivo %s" % archivo)
        print("Pida a su companero el archivo lumiere-36m.dump y su .sha256.")
        sys.exit(1)

    if not (RAIZ / ".env").exists():
        print("\nERROR: falta el archivo .env en %s" % RAIZ)
        print("Copie la plantilla y complete los datos:")
        print("  copy .env.example .env      (Windows)")
        print("  cp .env.example .env        (Linux/macOS)")
        sys.exit(1)

    faltantes = [k for k in ("DB_PASSWORD", "PGADMIN_PASSWORD") if not ENV.get(k)]
    if faltantes:
        print("\nERROR: el archivo .env no tiene valor para: %s" % ", ".join(faltantes))
        print("Edite .env y complete esas contrasenas antes de continuar.")
        sys.exit(1)

    if not args.sin_hash:
        print("\n Verificando archivo...")
        if not verificar_hash(archivo):
            sys.exit(1)

    # Levantar la base si hace falta.
    if not contenedor_existe(CONTENEDOR) or estado_contenedor(CONTENEDOR) in ("exited", "created", "no-existe"):
        print("\n Levantando contenedores (db, db-replica, pgadmin)...")
        compose = comando_compose()
        if not compose:
            print("ERROR: no se encontro 'docker compose' ni 'docker-compose'.")
            print("Levante la base manualmente: docker compose up -d db db-replica pgadmin")
            sys.exit(1)
        r = subprocess.run(compose + ["up", "-d", "db", "db-replica", "pgadmin"], cwd=str(RAIZ))
        if r.returncode != 0:
            print("ERROR: no se pudieron levantar los contenedores.")
            sys.exit(1)

    if not esperar_estado(CONTENEDOR, 300):
        print("ERROR: %s no esta healthy." % CONTENEDOR)
        sys.exit(1)

    # Limpiar dumps temporales de una restauracion interrumpida.
    subprocess.run(["docker", "exec", CONTENEDOR, "sh", "-c", "rm -f /tmp/restaurar_*"],
                   capture_output=True, text=True)

    # Si la replica se esta clonando por primera vez, conviene esperarla.
    if contenedor_existe(REPLICA):
        if not esperar_estado(REPLICA, 600):
            print("  AVISO: la replica todavia no esta lista; se continua igual.")

    if not args.si:
        print("\n  ATENCION: se reemplazaran todas las tablas de la base %s" % DB_NAME)
        print("  con los datos del dump (%s registros)." % f"{TOTAL_ESPERADO:,}")
        respuesta = input("\n  Escriba SI para continuar: ").strip().upper()
        if respuesta != "SI":
            print("  Cancelado.")
            return

    restaurar(archivo)

    print("\n Analizando tablas...")
    psql("ANALYZE;")

    print("\n Conteo final:")
    print("  %-12s %12s" % ("tabla", "filas"))
    print("  " + "-" * 26)
    total = 0
    ok = True
    for nombre, esperado in COUNTS.items():
        n = int(psql("SELECT count(*) FROM public.%s;" % nombre, capturar=True) or 0)
        total += n
        if n != esperado:
            ok = False
        print("  %-12s %12s  %s" % (nombre, f"{n:,}", "OK" if n == esperado else "REVISAR"))
    print("  " + "-" * 26)
    print("  %-12s %12s" % ("TOTAL", f"{total:,}"))

    if args.esperar_replica > 0 and contenedor_existe(REPLICA):
        print("\n Esperando sincronizacion de la replica", end="", flush=True)
        inicio = time.time()
        while time.time() - inicio < args.esperar_replica:
            try:
                salida = psql(
                    "SELECT COALESCE(MIN(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn))::bigint, -1) "
                    "FROM pg_stat_replication;",
                    capturar=True,
                )
                if salida and int(salida.splitlines()[0]) == 0:
                    print("  OK.")
                    break
            except Exception:
                pass
            sys.stdout.write(".")
            sys.stdout.flush()
            time.sleep(2)
        else:
            print("\n  AVISO: la replica sigue sincronizando.")

    print("\n" + "=" * 64)
    if ok:
        print(" RESTAURACION COMPLETA: %s registros." % f"{total:,}")
    else:
        print(" ATENCION: el total no coincide con lo esperado (%s)." % f"{TOTAL_ESPERADO:,}")
    print("\n Acceso a la aplicacion:")
    print("   Administrador: admin      / admin123")
    print("   Cliente:       user_000022 / cliente123")
    print("=" * 64)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrumpido. La base no se modifico (transaccion cancelada).")
        sys.exit(130)
    except Exception as e:
        print("\nERROR: %s" % e)
        sys.exit(1)
