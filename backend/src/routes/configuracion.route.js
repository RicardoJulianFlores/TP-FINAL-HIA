const express = require("express");
const router = express.Router();

const configuracionCtrl = require("../controllers/configuracion.controller");

router.get("/", configuracionCtrl.getConfiguracion);

router.put("/", configuracionCtrl.updateConfiguracion);

module.exports = router;
