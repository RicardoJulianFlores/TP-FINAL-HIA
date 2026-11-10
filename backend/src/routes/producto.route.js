const productoCtrl = require("../controllers/producto.controller");
const autCtrl = require('./../controllers/auth.controller');

const express = require('express');
const router = express.Router();

router.get('/', [autCtrl.verifyToken, autCtrl.isEmpleado], productoCtrl.getProductos);
router.get('/destacados', productoCtrl.getDestacados);
router.get('/categoria/:categoria', productoCtrl.getProductosPorCategoria);
router.get('/:id', productoCtrl.getProductoPorId);
router.post('/', [autCtrl.verifyToken, autCtrl.isEmpleado], productoCtrl.crearProducto);
router.delete('/:id', [autCtrl.verifyToken, autCtrl.isEmpleado], productoCtrl.deleteProducto);
router.put('/:id', [autCtrl.verifyToken, autCtrl.isEmpleado], productoCtrl.modificarProducto);

module.exports = router;
