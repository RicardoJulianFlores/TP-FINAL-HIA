"""
OBSOLETO.

Este script generaba 36.000.000 de filas (6M por tabla) con columnas que no
coincidian con el esquema: detalles, pagos y accesos tenian createdAt y
updatedAt inexistentes, por eso el COPY fallaba.

Fue reemplazado por el generador unico:

    python datos/generar_datos.py

Se mantiene solo para no romper enlaces o costumbres: al ejecutarlo se
generan los 36.000.000 de registros completos y correctos.
"""

import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))

print("Aviso: generador_transaccional.py quedo obsoleto.")
print("Se ejecutara el generador unificado (36.000.000 de registros en 6 tablas).\n")

sys.exit(subprocess.call([sys.executable, os.path.join(RAIZ, "datos", "generar_datos.py")] + sys.argv[1:]))
