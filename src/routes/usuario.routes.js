const express = require('express');
const routes = express.Router();

const usuarioController =  require("../controllers/usuario-controllers.js");
const login  = require("../middleware/login.js");

// metodos para teste
routes.get('/', login.obrigatorioLogin, usuarioController.getUsuario);
routes.get('/:id', login.obrigatorioLogin, usuarioController.getOneUsuario);
routes.post('/', login.opcionalLogin, usuarioController.postUsuario);
routes.post('/login', usuarioController.postUsuarioLogin);
routes.put('/:id', login.obrigatorioLogin, usuarioController.putUsuario);
routes.delete('/', login.obrigatorioLogin, usuarioController.deleteUsuario);

module.exports = routes;