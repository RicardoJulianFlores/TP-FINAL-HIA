"""
Configuracion unica de la carga masiva.

La usan tanto generar_datos.py como cargar_datos.py para que los CSV y el
COPY no se desincronicen nunca (ese fue el error de la version anterior).
"""

# Semilla fija: todos generan exactamente los mismos datos.
SEED = 20261117

# Total: 36.000.000 de filas (6.000.000 por tabla, segun el requerimiento de JIRA).
COUNTS = {
    "usuarios": 6_000_000,
    "productos": 6_000_000,
    "pedidos": 6_000_000,
    "detalles": 6_000_000,
    "pagos": 6_000_000,
    "accesos": 6_000_000,
}

TOTAL_ESPERADO = sum(COUNTS.values())  # 36.000.000

# Orden obligatorio por las claves foraneas.
LOAD_ORDER = ["usuarios", "productos", "pedidos", "detalles", "pagos", "accesos"]

# Columnas exactas del esquema (db/init/01-schema.sql).
COLUMNS = {
    "usuarios": [
        "id", "username", "password", "nombres", "apellido",
        "perfil", "email", "createdAt", "updatedAt",
    ],
    "productos": [
        "id", "nombre", "categoria", "precio", "descuento", "imagen",
        "descripcion", "material", "destacado", "stock", "createdAt", "updatedAt",
    ],
    "pedidos": [
        "id", "fecha", "total", "estado_envio", "id_mercado_pago",
        "createdAt", "updatedAt", "usuarioId",
    ],
    "detalles": ["id", "cantidad", "precio_unitario", "pedidoId", "productoId"],
    "pagos": ["id", "mp_payment_id", "estado_pago", "fecha_pago", "pedidoId"],
    "accesos": ["id", "fecha_hora", "ip_origen", "accion_realizada", "usuarioId"],
}

# Credenciales que quedan cargadas (hash bcrypt generado con pgcrypto).
# admin     -> admin123
# clientes  -> cliente123
HASH_ADMIN = "$2a$10$0tiF4q9bp89JRrORE519QO3zSymrzdFZWsw5Rg8.OH07O9vf1RIiS"
HASH_CLIENTE = "$2a$10$7fZAXsHjU5ChPCsxQhKZbOW3.nNpsKY8M66TNWBxRf2vSjZbAn03."

# Rangos / catalogos usados por el generador.
CATEGORIAS = ["anillos", "collares", "aretes", "pulseras"]
MATERIALES = ["Plata", "Oro", "Acero", "Oro blanco"]
ESTADOS_ENVIO = ["Pendiente", "Despachado", "Entregado", "Cancelado"]
ESTADOS_PAGO = ["APROBADO", "PENDIENTE", "RECHAZADO"]
ACCIONES = ["login", "logout", "consulta_catalogo", "intento_fallido"]

# DDL que se elimina antes de la carga y se reconstruye despues.
# Reconstruir indices/constraints en bloque es mucho mas rapido que
# mantenerlos durante 6M de inserciones.
DROP_SQL = """
ALTER TABLE public.accesos   DROP CONSTRAINT IF EXISTS "accesos_usuarioId_fkey";
ALTER TABLE public.detalles  DROP CONSTRAINT IF EXISTS "detalles_pedidoId_fkey";
ALTER TABLE public.detalles  DROP CONSTRAINT IF EXISTS "detalles_productoId_fkey";
ALTER TABLE public.pagos     DROP CONSTRAINT IF EXISTS "pagos_pedidoId_fkey";
ALTER TABLE public.pedidos   DROP CONSTRAINT IF EXISTS "pedidos_usuarioId_fkey";

ALTER TABLE public.accesos   DROP CONSTRAINT IF EXISTS accesos_pkey;
ALTER TABLE public.detalles  DROP CONSTRAINT IF EXISTS detalles_pkey;
ALTER TABLE public.pagos     DROP CONSTRAINT IF EXISTS pagos_pkey;
ALTER TABLE public.pedidos   DROP CONSTRAINT IF EXISTS pedidos_pkey;
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_pkey;
ALTER TABLE public.usuarios  DROP CONSTRAINT IF EXISTS usuarios_pkey;
ALTER TABLE public.usuarios  DROP CONSTRAINT IF EXISTS usuarios_email_key;

DROP INDEX IF EXISTS public.idx_pedidos_usuario;
DROP INDEX IF EXISTS public.idx_detalles_pedido;
DROP INDEX IF EXISTS public.idx_detalles_producto;
DROP INDEX IF EXISTS public.idx_pagos_pedido;
DROP INDEX IF EXISTS public.idx_accesos_usuario;
DROP INDEX IF EXISTS public.idx_productos_filtro_catalogo;
DROP INDEX IF EXISTS public.idx_pedidos_fecha_estado;
DROP INDEX IF EXISTS public.idx_productos_stock_critico;
DROP INDEX IF EXISTS public.idx_pedidos_historial_cliente;
DROP INDEX IF EXISTS public.idx_productos_destacados_cat;
DROP INDEX IF EXISTS public.idx_accesos_accion_fecha;
DROP INDEX IF EXISTS public.idx_pedidos_pendientes_fifo;
DROP INDEX IF EXISTS public.idx_pedidos_cancelados_total;
"""

TRUNCATE_SQL = """
TRUNCATE TABLE
    public.accesos,
    public.detalles,
    public.pagos,
    public.pedidos,
    public.productos,
    public.usuarios
RESTART IDENTITY;
"""

# Claves primarias / unicos.
PK_SQL = """
ALTER TABLE ONLY public.usuarios  ADD CONSTRAINT usuarios_pkey  PRIMARY KEY (id);
ALTER TABLE ONLY public.usuarios  ADD CONSTRAINT usuarios_email_key UNIQUE (email);
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pedidos   ADD CONSTRAINT pedidos_pkey   PRIMARY KEY (id);
ALTER TABLE ONLY public.detalles  ADD CONSTRAINT detalles_pkey  PRIMARY KEY (id);
ALTER TABLE ONLY public.pagos     ADD CONSTRAINT pagos_pkey     PRIMARY KEY (id);
ALTER TABLE ONLY public.accesos   ADD CONSTRAINT accesos_pkey   PRIMARY KEY (id);
"""

# Indices sobre claves foraneas: se crean siempre, porque las FK los necesitan
# para que los borrados/actualizaciones no se vuelvan lentos.
FK_INDEX_SQL = """
CREATE INDEX idx_pedidos_usuario   ON public.pedidos  ("usuarioId");
CREATE INDEX idx_detalles_pedido   ON public.detalles ("pedidoId");
CREATE INDEX idx_detalles_producto ON public.detalles ("productoId");
CREATE INDEX idx_pagos_pedido      ON public.pagos    ("pedidoId");
CREATE INDEX idx_accesos_usuario   ON public.accesos  ("usuarioId");
"""

# Indices analiticos/de consulta (db/init/02-indices.sql). Se pueden omitir
# durante la carga de 36M para no saturar la PC y crearlos despues con
# --solo-indices (el requerimiento pide cargar primero, optimizar despues).
EXTRA_INDEX_SQL = """
CREATE INDEX idx_productos_filtro_catalogo  ON public.productos (categoria, material, precio);
CREATE INDEX idx_pedidos_fecha_estado       ON public.pedidos (estado_envio, fecha);
CREATE INDEX idx_productos_stock_critico    ON public.productos (stock) INCLUDE (id, nombre);
CREATE INDEX idx_pedidos_historial_cliente  ON public.pedidos ("usuarioId", fecha DESC);
CREATE INDEX idx_productos_destacados_cat   ON public.productos (categoria) WHERE destacado = 'true';
CREATE INDEX idx_accesos_accion_fecha       ON public.accesos (accion_realizada, fecha_hora DESC);
CREATE INDEX idx_pedidos_pendientes_fifo    ON public.pedidos (estado_envio, fecha ASC);
CREATE INDEX idx_pedidos_cancelados_total   ON public.pedidos (estado_envio, total DESC);
"""

# Todos los indices (para --solo-indices).
INDEX_SQL = FK_INDEX_SQL + EXTRA_INDEX_SQL

FK_SQL = """
ALTER TABLE ONLY public.accesos
    ADD CONSTRAINT "accesos_usuarioId_fkey" FOREIGN KEY ("usuarioId")
    REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.detalles
    ADD CONSTRAINT "detalles_pedidoId_fkey" FOREIGN KEY ("pedidoId")
    REFERENCES public.pedidos(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.detalles
    ADD CONSTRAINT "detalles_productoId_fkey" FOREIGN KEY ("productoId")
    REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT "pagos_pedidoId_fkey" FOREIGN KEY ("pedidoId")
    REFERENCES public.pedidos(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT "pedidos_usuarioId_fkey" FOREIGN KEY ("usuarioId")
    REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;
"""

# Alinea las secuencias con el max(id) cargado.
SEQUENCE_SQL = """
DO $$
BEGIN
    PERFORM setval('public.usuarios_id_seq',  COALESCE((SELECT MAX(id) FROM public.usuarios), 1),  true);
    PERFORM setval('public.productos_id_seq', COALESCE((SELECT MAX(id) FROM public.productos), 1), true);
    PERFORM setval('public.pedidos_id_seq',   COALESCE((SELECT MAX(id) FROM public.pedidos), 1),   true);
    PERFORM setval('public.detalles_id_seq',  COALESCE((SELECT MAX(id) FROM public.detalles), 1),  true);
    PERFORM setval('public.pagos_id_seq',     COALESCE((SELECT MAX(id) FROM public.pagos), 1),     true);
    PERFORM setval('public.accesos_id_seq',   COALESCE((SELECT MAX(id) FROM public.accesos), 1),   true);
END $$;
"""
