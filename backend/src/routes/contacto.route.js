const contactoCtrl = require("../controllers/contacto.controller");
const autCtrl = require('./../controllers/auth.controller');

const express = require('express');
const router = express.Router();

router.get('/', autCtrl.verifyToken, contactoCtrl.getContactos);
router.post('/', contactoCtrl.crearContacto);

module.exports = router;
