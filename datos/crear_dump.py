#!/usr/bin/env python3
"""
Crea el dump comprimido que se comparte con los companeros.

Salida:
    backups/lumiere-36m.dump       (formato custom de PostgreSQL, comprimido)
    backups/lumiere-36m.dump.sha256

Uso:
    python datos/crear_dump.py
"""

import hashlib
import os
import subprocess
import sys
import time
from pathlib import Path

from config_datos import COUNTS

RAIZ = Path(__file__).resolve().parent.parent
CONTENEDOR = "lumiere-db"
REPLICA = "lumiere-db-replica"
DESTINO = RAIZ / "backups" / "lumiere-36m.dump"


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


def contenedor_corriendo(nombre: str) -> bool:
    r = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", nombre],
                       capture_output=True, text=True)
    return r.returncode == 0 and r.stdout.strip() == "true"


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


def formatear(n: int) -> str:
    if n >= 1024 ** 3:
        return "%.2f GB" % (n / 1024 ** 3)
    return "%.1f MB" % (n / 1024 ** 2)


def main():
    print("=" * 64)
    print(" Creando dump de %s" % DB_NAME)
    print("=" * 64)

    if not contenedor_corriendo(CONTENEDOR):
        print("ERROR: el contenedor %s no esta corriendo." % CONTENEDOR)
        sys.exit(1)

    # Validar que los datos esten completos antes de generar el dump.
    print("\n Verificando conteos...")
    total = 0
    for nombre, esperado in COUNTS.items():
        n = int(psql("SELECT count(*) FROM public.%s;" % nombre, capturar=True) or 0)
        estado = "OK" if n == esperado else "INCOMPLETO"
        print("   %-10s %12s / %12s  %s" % (nombre, f"{n:,}", f"{esperado:,}", estado))
        total += n
        if n != esperado:
            print("\nERROR: la tabla %s no tiene las filas esperadas." % nombre)
            print("Ejecute primero: python datos/cargar_datos.py")
            sys.exit(1)
    print("   %-10s %12s" % ("TOTAL", f"{total:,}"))

    # Quitar la extension auxiliar usada para generar los hashes, para que
    # el dump quede igual al esquema del repositorio.
    try:
        psql("DROP EXTENSION IF EXISTS pgcrypto;")
    except Exception:
        pass

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    temporal = DESTINO.with_suffix(".dump.tmp")
    if temporal.exists():
        temporal.unlink()

    print("\n Generando dump (esto puede tardar unos minutos)...")
    inicio = time.time()
    with open(temporal, "wb") as salida:
        proc = subprocess.Popen(
            [
                "docker", "exec", CONTENEDOR,
                "pg_dump", "-U", DB_USER, "-d", DB_NAME,
                "--format=custom", "--compress=6",
                "--no-owner", "--no-privileges",
            ],
            stdout=salida,
        )
        while proc.poll() is None:
            try:
                mb = os.path.getsize(temporal) / (1024 * 1024)
                sys.stdout.write("\r  escribiendo... %.1f MB" % mb)
                sys.stdout.flush()
            except OSError:
                pass
            time.sleep(1.5)
        codigo = proc.wait()

    if codigo != 0:
        if temporal.exists():
            temporal.unlink()
        print("\nERROR: pg_dump fallo (codigo %s)." % codigo)
        sys.exit(1)

    if temporal.stat().st_size == 0:
        temporal.unlink()
        print("\nERROR: el dump quedo vacio.")
        sys.exit(1)

    if DESTINO.exists():
        DESTINO.unlink()
    temporal.rename(DESTINO)

    tamano = DESTINO.stat().st_size
    print("\r  dump creado: %-45s %s  (%.1f s)" % (DESTINO.name, formatear(tamano), time.time() - inicio))

    # Verificar que el dump se pueda leer y que contenga las 6 tablas.
    print("\n Verificando integridad del dump...")
    with open(DESTINO, "rb") as entrada:
        r = subprocess.run(
            ["docker", "exec", "-i", CONTENEDOR, "pg_restore", "-l"],
            stdin=entrada, capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
    if r.returncode != 0:
        print("ERROR: pg_restore no puede leer el dump.")
        print(r.stderr)
        sys.exit(1)

    faltantes = []
    for nombre in COUNTS:
        if ("TABLE DATA public %s " % nombre) not in r.stdout:
            faltantes.append(nombre)
    if faltantes:
        print("ERROR: el dump no contiene datos de: %s" % ", ".join(faltantes))
        sys.exit(1)
    print("  dump valido: contiene datos de las 6 tablas.")

    # Hash para que los companeros verifiquen que el archivo no se corrompio.
    print("\n Calculando SHA256...")
    h = hashlib.sha256()
    with open(DESTINO, "rb") as f:
        while True:
            bloque = f.read(4 * 1024 * 1024)
            if not bloque:
                break
            h.update(bloque)
    sha = h.hexdigest()
    (DESTINO.parent / (DESTINO.name + ".sha256")).write_text(
        "%s  %s\n" % (sha, DESTINO.name), encoding="utf-8")
    print("  %s" % sha)

    print("\n" + "=" * 64)
    print(" LISTO. Comparta estos dos archivos:")
    print("   %s" % DESTINO)
    print("   %s.sha256" % DESTINO)
    print("\n Sus companeros solo deben ejecutar:")
    print("   RESTAURAR_DATOS.bat            (Windows)")
    print("   python datos/restaurar_dump.py (Linux/macOS)")
    print("=" * 64)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrumpido.")
        sys.exit(130)
    except Exception as e:
        print("\nERROR: %s" % e)
        sys.exit(1)
