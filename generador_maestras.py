import csv
import random
import time

print("Generando 6M de usuarios...")
with open('usuarios.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    for i in range(1, 6000001):
        writer.writerow([f"user_{i}", "$2b$10$NDiJz2/8aOstLupsbBND5esqaBRlGkTehqbTi.62MIda.iPmV6OUC", f"Nombre{i}", f"Apellido{i}", "Cliente", f"cliente{i}@mail.com"])

print("Generando 6M de productos...")
with open('productos.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    for i in range(1, 6000001):
        writer.writerow([f"Joya {i}", random.choice(['Anillos', 'Collares', 'Aros']), round(random.uniform(1000, 50000), 2), 0, random.choice(['Plata', 'Oro', 'Acero']), 'false', random.randint(1, 100)])
print("Archivos listos.")