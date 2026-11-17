-- Carga masiva de datos de prueba en trabajoFinal.
-- Se ejecuta dentro del contenedor desde cargar_datos.sh (una sola sesion).

\timing on

-- Defaults para columnas NOT NULL que los CSV no traen
ALTER TABLE public.usuarios  ALTER COLUMN "createdAt" SET DEFAULT now(), ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE public.productos ALTER COLUMN "createdAt" SET DEFAULT now(), ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE public.productos ALTER COLUMN imagen SET DEFAULT 'placeholder.jpg';
ALTER TABLE public.pedidos   ALTER COLUMN "createdAt" SET DEFAULT now(), ALTER COLUMN "updatedAt" SET DEFAULT now();

-- Desactiva chequeo de FKs durante la carga (requiere superusuario)
SET session_replication_role = replica;

-- Tablas maestras primero
COPY public.usuarios  (username, password, nombres, apellido, perfil, email) FROM '/tmp/usuarios.csv'  WITH (FORMAT csv, ENCODING 'UTF8');
COPY public.productos (nombre, categoria, precio, descuento, material, destacado, stock) FROM '/tmp/productos.csv' WITH (FORMAT csv, ENCODING 'UTF8');

-- Tablas transaccionales
COPY public.pedidos   (fecha, total, estado_envio, id_mercado_pago, "usuarioId") FROM '/tmp/pedidos.csv'   WITH (FORMAT csv, ENCODING 'UTF8');
COPY public.detalles  (cantidad, precio_unitario, "pedidoId", "productoId")      FROM '/tmp/detalles.csv'  WITH (FORMAT csv, ENCODING 'UTF8');
COPY public.pagos     (mp_payment_id, estado_pago, fecha_pago, "pedidoId")       FROM '/tmp/pagos.csv'     WITH (FORMAT csv, ENCODING 'UTF8');
COPY public.accesos   (fecha_hora, ip_origen, accion_realizada, "usuarioId")     FROM '/tmp/accesos.csv'   WITH (FORMAT csv, ENCODING 'UTF8');

SET session_replication_role = origin;

-- Estadisticas para el planificador
ANALYZE public.usuarios;
ANALYZE public.productos;
ANALYZE public.pedidos;
ANALYZE public.detalles;
ANALYZE public.pagos;
ANALYZE public.accesos;

-- Resumen
SELECT 'usuarios' AS tabla, count(*) FROM public.usuarios
UNION ALL SELECT 'productos', count(*) FROM public.productos
UNION ALL SELECT 'pedidos',   count(*) FROM public.pedidos
UNION ALL SELECT 'detalles',  count(*) FROM public.detalles
UNION ALL SELECT 'pagos',     count(*) FROM public.pagos
UNION ALL SELECT 'accesos',   count(*) FROM public.accesos;
