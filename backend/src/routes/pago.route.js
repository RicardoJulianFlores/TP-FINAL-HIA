const express = require('express');
const router = express.Router();
const pagoCtrl = require('../controllers/pago.controller');

router.post('/', pagoCtrl.registrarPago);//crear pago

router.get('/', pagoCtrl.obtenerPagos);//obtener los pagos

module.exports = router;