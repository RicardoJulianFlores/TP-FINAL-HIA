-- Índices sobre claves foráneas (Sequelize no los crea).
-- Aceleran los JOIN y los borrados/actualizaciones en cascada.
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario  ON pedidos  ("usuarioId");
CREATE INDEX IF NOT EXISTS idx_detalles_pedido  ON detalles ("pedidoId");
CREATE INDEX IF NOT EXISTS idx_detalles_producto ON detalles ("productoId");
CREATE INDEX IF NOT EXISTS idx_pagos_pedido     ON pagos    ("pedidoId");
CREATE INDEX IF NOT EXISTS idx_accesos_usuario  ON accesos  ("usuarioId");
