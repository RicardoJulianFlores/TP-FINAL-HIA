-- Índices sobre claves foráneas (Sequelize no los crea).
-- Aceleran los JOIN y los borrados/actualizaciones en cascada.
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario  ON pedidos  ("usuarioId");
CREATE INDEX IF NOT EXISTS idx_detalles_pedido  ON detalles ("pedidoId");
CREATE INDEX IF NOT EXISTS idx_detalles_producto ON detalles ("productoId");
CREATE INDEX IF NOT EXISTS idx_pagos_pedido     ON pagos    ("pedidoId");
CREATE INDEX IF NOT EXISTS idx_accesos_usuario  ON accesos  ("usuarioId");

-- JOY-22: Índices de Optimización (Sprint 2)

-- 1. Búsqueda compuesta en catálogo
CREATE INDEX idx_productos_filtro_catalogo ON public.productos (categoria, material, precio);

-- 2. Reporte de ventas (Fecha limpia + estado)
CREATE INDEX idx_pedidos_fecha_estado ON public.pedidos (estado_envio, fecha);

-- 3. Stock crítico (Índice de cobertura)
CREATE INDEX idx_productos_stock_critico ON public.productos (stock) INCLUDE (id, nombre);

-- 4. Historial cliente (Ordenado por fecha)
CREATE INDEX idx_pedidos_historial_cliente ON public.pedidos ("usuarioId", fecha DESC);

-- 5. Catálogo Destacados (Índice parcial)
CREATE INDEX idx_productos_destacados_cat ON public.productos (categoria) WHERE destacado = 'true';

-- 6. Auditoría: Ingresos recientes
CREATE INDEX idx_accesos_accion_fecha ON public.accesos (accion_realizada, fecha_hora DESC);

-- 7. Tablero Empleado: Pedidos antiguos
CREATE INDEX idx_pedidos_pendientes_fifo ON public.pedidos (estado_envio, fecha ASC);

-- 8. Top 100 Cancelados (Ordenamiento nativo)
CREATE INDEX idx_pedidos_cancelados_total ON public.pedidos (estado_envio, total DESC);