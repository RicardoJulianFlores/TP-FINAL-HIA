const express = require('express');
const router = express.Router();
const pedidoCtrl = require('../controllers/pedido.controller');

router.post('/', pedidoCtrl.crearPedido);
router.get('/', pedidoCtrl.getPedidos);
router.get('/:id', pedidoCtrl.getPedidoPorId);
router.put('/:id/estado', pedidoCtrl.actualizarEstado);

module.exports = router;