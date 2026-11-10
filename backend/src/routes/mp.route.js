const express = require('express');
const router = express.Router();

const mpCtrl = require('../controllers/mp.controller');

// Ruta para crear un pago
router.post('/payment', mpCtrl.getPaymentLink);

module.exports = router;