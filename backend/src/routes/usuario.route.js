const express = require("express");
const router = express.Router();
//defino controlador para el manejo de CRUD
const usuarioCtrl = require('./../controllers/usuario.controller');
const autCtrl = require('./../controllers/auth.controller');

// definiendo rutas
router.post('/login', usuarioCtrl.loginUsuario);
router.post('/google-login', usuarioCtrl.loginGoogle); // público: mismo motivo, es la puerta de entrada
router.post('/', usuarioCtrl.createUsuario);//crear usuario

router.get('/', [autCtrl.verifyToken, autCtrl.isAdmin], usuarioCtrl.getUsuarios);//obtener todos los usuarios

router.get('/buscar/:texto', usuarioCtrl.getBuscarCoincidenciaEnNombre);//buscar por coincidencias en nombre

router.delete('/:id',[autCtrl.verifyToken, autCtrl.isAdmin], usuarioCtrl.deleteUsuario);//eliminar usuario
router.put('/:id',[autCtrl.verifyToken, autCtrl.isAdmin], usuarioCtrl.editUsuario);//editar usuario
router.get('/:id', [autCtrl.verifyToken, autCtrl.isAdmin], usuarioCtrl.gerUsuarioPorId);//buscar ususario por ID
router.post('/:id/acceso', usuarioCtrl.addAcceso);

//exportacion del modulo de rutas

module.exports = router;