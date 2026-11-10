const express = require('express');
const estadisticaCtrl = require('../controllers/estadisticas.controller');
const router = express.Router();


// Ruta para el gráfico de torta
router.get('/grafico-categorias', estadisticaCtrl.getVentasPorCategoria);
router.get('/grafico-ingresos', estadisticaCtrl.getIngresosPorFecha );
router.get('/total-ventas', estadisticaCtrl.getTotalVentas);
router.get('/pedidos-pendientes', estadisticaCtrl.getPedidosPendientes );
router.get('/productos-sin-stock', estadisticaCtrl.getProductosSinStock );
router.get('/productos-mas-vendidos', estadisticaCtrl.getProductosMasVendidos );


module.exports = router;