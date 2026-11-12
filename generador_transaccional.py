import csv
import random
import time
from datetime import datetime, timedelta

def generar_datos_transaccionales(cantidad):
    inicio_total = time.time()
    
    # 1. Tabla PEDIDOS (id_mercado_pago y estado_envio)
    print("Generando 6M de pedidos...")
    with open('pedidos.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for i in range(1, cantidad + 1):
            fecha = (datetime.now() - timedelta(days=random.randint(1, 365))).strftime('%Y-%m-%d %H:%M:%S')
            # Columnas[cite: 27]: fecha, total, estado_envio, id_mercado_pago, usuarioId
            writer.writerow([fecha, round(random.uniform(5000, 250000), 2), 'Pendiente', f"MP_{i}", random.randint(1, cantidad)])

    # 2. Tabla DETALLES (cruza pedidos con productos)
    print("Generando 6M de detalles...")
    with open('detalles.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for i in range(1, cantidad + 1):
            # Columnas[cite: 27]: cantidad, precio_unitario, pedidoId, productoId
            writer.writerow([random.randint(1, 5), round(random.uniform(1000, 50000), 2), i, random.randint(1, cantidad)])

    # 3. Tabla PAGOS
    print("Generando 6M de pagos...")
    with open('pagos.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for i in range(1, cantidad + 1):
            fecha = (datetime.now() - timedelta(days=random.randint(1, 365))).strftime('%Y-%m-%d %H:%M:%S')
            # Columnas[cite: 27]: mp_payment_id, estado_pago, fecha_pago, pedidoId
            writer.writerow([f"PAY_{i}", 'approved', fecha, i])

    # 4. Tabla ACCESOS (Bitácora)
    print("Generando 6M de accesos...")
    with open('accesos.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for i in range(1, cantidad + 1):
            fecha = (datetime.now() - timedelta(days=random.randint(1, 365))).strftime('%Y-%m-%d %H:%M:%S')
            # Columnas[cite: 27]: fecha_hora, ip_origen, accion_realizada, usuarioId
            writer.writerow([fecha, f"192.168.1.{random.randint(1, 255)}", 'login', random.randint(1, cantidad)])

    print(f"✅ Todos los archivos generados en {time.time() - inicio_total:.2f} segundos.")

generar_datos_transaccionales(6000000)