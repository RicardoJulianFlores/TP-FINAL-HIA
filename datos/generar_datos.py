#!/usr/bin/env python3
"""
Genera los 36.000.000 de registros (6M por tabla) en CSV, con columnas EXACTAS al esquema.

- Bajo consumo: escribe fila por fila, nunca guarda el CSV en memoria.
- Reproducible: semilla fija, todos obtienen los mismos datos.
- Integridad referencial: los id y las FK siempre apuntan a filas existentes.
- No usa INSERT: la carga posterior se hace con COPY (mucho mas rapido).

Uso:
    python datos/generar_datos.py
    python datos/generar_datos.py --salida datos/csv
"""

import argparse
import calendar
import csv
import json
import os
import random
import sys
import time
from array import array
from datetime import datetime, timezone

from config_datos import (
    ACCIONES,
    CATEGORIAS,
    COLUMNS,
    COUNTS,
    ESTADOS_ENVIO,
    ESTADOS_PAGO,
    HASH_ADMIN,
    HASH_CLIENTE,
    MATERIALES,
    SEED,
    TOTAL_ESPERADO,
)

# Fecha base fija (17/11/2026 00:00 UTC) para que el resultado sea reproducible.
BASE_TS = calendar.timegm((2026, 11, 17, 0, 0, 0))
ANIO = 365 * 24 * 3600


def ts(valor: int) -> str:
    """Timestamp ISO con zona UTC, formato que PostgreSQL COPY entiende."""
    return time.strftime("%Y-%m-%d %H:%M:%S+00", time.gmtime(valor))


def abrir_csv(ruta: str):
    # newline="" es obligatorio para csv; lineterminator="\n" evita CRLF.
    return open(ruta, "w", newline="", encoding="utf-8")


def progreso(nombre: str, hechas: int, total: int):
    sys.stdout.write("\r  %-10s %12s / %12s" % (nombre, f"{hechas:,}", f"{total:,}"))
    sys.stdout.flush()


def generar_usuarios(rnd: random.Random, salida: str):
    total = COUNTS["usuarios"]
    with abrir_csv(os.path.join(salida, "usuarios.csv")) as f:
        w = csv.writer(f, lineterminator="\n")
        for i in range(1, total + 1):
            creado = BASE_TS - rnd.randint(0, 2 * ANIO)
            actualizado = creado + rnd.randint(60, 180 * 24 * 3600)
            if i == 1:
                fila = [1, "admin", HASH_ADMIN, "Administrador", "Lumiere",
                        "Administrador", "admin@lumiere.com", ts(creado), ts(actualizado)]
            elif i <= 21:
                fila = [i, f"empleado_{i:04d}", HASH_CLIENTE, f"Empleado{i}", f"Apellido{i}",
                        "Empleado", f"empleado{i}@lumiere.com", ts(creado), ts(actualizado)]
            else:
                fila = [i, f"user_{i:06d}", HASH_CLIENTE, f"Nombre{i}", f"Apellido{i}",
                        "Cliente", f"cliente{i}@lumiere.com", ts(creado), ts(actualizado)]
            w.writerow(fila)
            if i % 25000 == 0:
                progreso("usuarios", i, total)
    progreso("usuarios", total, total)
    print()


def generar_productos(rnd: random.Random, salida: str):
    total = COUNTS["productos"]
    with abrir_csv(os.path.join(salida, "productos.csv")) as f:
        w = csv.writer(f, lineterminator="\n")
        for i in range(1, total + 1):
            creado = BASE_TS - rnd.randint(0, 2 * ANIO)
            actualizado = creado + rnd.randint(60, 240 * 24 * 3600)
            precio = round(rnd.uniform(1000, 500000), 2)
            descuento = 0.0 if rnd.random() < 0.7 else float(rnd.choice([5, 10, 15, 20, 25, 30]))
            fila = [
                i,
                f"Joya {i}",
                rnd.choice(CATEGORIAS),
                precio,
                descuento,
                f"joya_{i}.jpg",
                f"Joya artesanal numero {i} de la coleccion Lumiere",
                rnd.choice(MATERIALES),
                "true" if rnd.random() < 0.05 else "false",
                0 if rnd.random() < 0.10 else rnd.randint(1, 300),
                ts(creado),
                ts(actualizado),
            ]
            w.writerow(fila)
            if i % 12500 == 0:
                progreso("productos", i, total)
    progreso("productos", total, total)
    print()


def generar_detalles(rnd: random.Random, salida: str, n_pedidos: int):
    """
    Genera detalles ANTES que pedidos para poder calcular el total real de
    cada pedido (suma de cantidad * precio_unitario). Asi los reportes de
    ventas coinciden con los detalles.
    """
    total = COUNTS["detalles"]
    n_productos = COUNTS["productos"]
    totales = array("d", [0.0]) * (n_pedidos + 1)

    with abrir_csv(os.path.join(salida, "detalles.csv")) as f:
        w = csv.writer(f, lineterminator="\n")
        for i in range(1, total + 1):
            # Reparte los detalles de forma uniforme: cada pedido recibe 1 o 2.
            pedido_id = 1 + ((i - 1) * n_pedidos) // total
            cantidad = rnd.randint(1, 5)
            precio = round(rnd.uniform(1000, 300000), 2)
            totales[pedido_id] += cantidad * precio
            w.writerow([
                i,
                cantidad,
                precio,
                pedido_id,
                rnd.randint(1, n_productos),
            ])
            if i % 125000 == 0:
                progreso("detalles", i, total)
    progreso("detalles", total, total)
    print()
    return totales


def generar_pedidos(rnd: random.Random, salida: str, totales):
    total = COUNTS["pedidos"]
    n_usuarios = COUNTS["usuarios"]
    fechas = array("q", [0]) * (total + 1)

    pesos = [(0.25, "Pendiente"), (0.20, "Despachado"), (0.45, "Entregado"), (0.10, "Cancelado")]

    with abrir_csv(os.path.join(salida, "pedidos.csv")) as f:
        w = csv.writer(f, lineterminator="\n")
        for i in range(1, total + 1):
            fecha = BASE_TS - rnd.randint(0, 2 * ANIO)
            fechas[i] = fecha
            actualizado = fecha + rnd.randint(3600, 30 * 24 * 3600)
            r = rnd.random()
            acumulado = 0.0
            estado = "Pendiente"
            for peso, nombre in pesos:
                acumulado += peso
                if r <= acumulado:
                    estado = nombre
                    break
            w.writerow([
                i,
                ts(fecha),
                round(totales[i], 2),
                estado,
                f"MP_{i:07d}",
                ts(fecha),
                ts(actualizado),
                rnd.randint(1, n_usuarios),
            ])
            if i % 75000 == 0:
                progreso("pedidos", i, total)
    progreso("pedidos", total, total)
    print()
    return fechas


def generar_pagos(rnd: random.Random, salida: str, fechas):
    total = COUNTS["pagos"]
    pesos = [(0.75, "APROBADO"), (0.15, "PENDIENTE"), (0.10, "RECHAZADO")]

    with abrir_csv(os.path.join(salida, "pagos.csv")) as f:
        w = csv.writer(f, lineterminator="\n")
        for i in range(1, total + 1):
            r = rnd.random()
            acumulado = 0.0
            estado = "PENDIENTE"
            for peso, nombre in pesos:
                acumulado += peso
                if r <= acumulado:
                    estado = nombre
                    break
            fecha_pago = fechas[i] + rnd.randint(300, 4 * 24 * 3600)
            w.writerow([
                i,
                f"PAY_{i:07d}",
                estado,
                ts(fecha_pago),
                i,
            ])
            if i % 45000 == 0:
                progreso("pagos", i, total)
    progreso("pagos", total, total)
    print()


def generar_accesos(rnd: random.Random, salida: str):
    total = COUNTS["accesos"]
    n_usuarios = COUNTS["usuarios"]

    with abrir_csv(os.path.join(salida, "accesos.csv")) as f:
        w = csv.writer(f, lineterminator="\n")
        for i in range(1, total + 1):
            fecha = BASE_TS - rnd.randint(0, ANIO)
            if rnd.random() < 0.5:
                ip = f"192.168.{rnd.randint(0, 255)}.{rnd.randint(1, 254)}"
            else:
                ip = f"10.{rnd.randint(0, 255)}.{rnd.randint(0, 255)}.{rnd.randint(1, 254)}"
            w.writerow([
                i,
                ts(fecha),
                ip,
                rnd.choice(ACCIONES),
                rnd.randint(1, n_usuarios),
            ])
            if i % 40000 == 0:
                progreso("accesos", i, total)
    progreso("accesos", total, total)
    print()


def main():
    parser = argparse.ArgumentParser(description="Genera los CSV de la carga masiva (6M).")
    parser.add_argument("--salida", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "csv"),
                        help="Carpeta destino de los CSV (por defecto datos/csv)")
    parser.add_argument("--seed", type=int, default=SEED, help="Semilla aleatoria")
    args = parser.parse_args()

    # Coherencia entre tablas: si se editan los COUNTS, estas reglas evitan
    # claves foraneas invalidas o pedidos sin detalles.
    if COUNTS["pagos"] > COUNTS["pedidos"]:
        sys.exit("ERROR: pagos no puede superar a pedidos (cada pago necesita un pedido).")
    if COUNTS["detalles"] < COUNTS["pedidos"]:
        sys.exit("ERROR: detalles debe ser >= pedidos (cada pedido necesita al menos un detalle).")
    if COUNTS["pedidos"] > COUNTS["usuarios"] * 100:
        sys.exit("ERROR: demasiados pedidos para la cantidad de usuarios.")

    salida = os.path.abspath(args.salida)
    os.makedirs(salida, exist_ok=True)

    rnd = random.Random(args.seed)
    inicio = time.time()

    print("=" * 62)
    print(" Generando %s registros en %s" % (f"{TOTAL_ESPERADO:,}", salida))
    print(" Semilla: %s" % args.seed)
    print("=" * 62)

    generar_usuarios(rnd, salida)
    generar_productos(rnd, salida)
    totales = generar_detalles(rnd, salida, COUNTS["pedidos"])
    fechas = generar_pedidos(rnd, salida, totales)
    generar_pagos(rnd, salida, fechas)
    generar_accesos(rnd, salida)

    tablas = {}
    for nombre, filas in COUNTS.items():
        archivo = os.path.join(salida, nombre + ".csv")
        tablas[nombre] = {
            "filas": filas,
            "archivo": nombre + ".csv",
            "bytes": os.path.getsize(archivo),
            "columnas": COLUMNS[nombre],
        }

    manifest = {
        "version": 1,
        "seed": args.seed,
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": TOTAL_ESPERADO,
        "tablas": tablas,
    }
    with open(os.path.join(salida, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("=" * 62)
    print(" Listo en %.1f segundos" % (time.time() - inicio))
    for nombre in COUNTS:
        mb = tablas[nombre]["bytes"] / (1024 * 1024)
        print("   %-10s %10s filas  %7.1f MB" % (nombre, f"{COUNTS[nombre]:,}", mb))
    print("   %-10s %10s filas" % ("TOTAL", f"{TOTAL_ESPERADO:,}"))
    print("=" * 62)


if __name__ == "__main__":
    main()
