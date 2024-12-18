const express = require('express');
const routes = express.Router();
const login = require("../middleware/login.js");

const cursosController = require("../controllers/curso-controllers.js");

routes.get('/', login.obrigatorioLogin, cursosController.getCursos);
routes.get('/:id', login.obrigatorioLogin, cursosController.readOneCursos);
routes.post('/', login.obrigatorioLogin, cursosController.createCurso);
routes.put('/:id', login.obrigatorioLogin, cursosController.updateCurso);
routes.delete('/:id', login.obrigatorioLogin, cursosController.deleteCurso);

module.exports = routes;