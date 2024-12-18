const express = require('express');
const routes = express.Router();
const login = require("../middleware/login.js");

const turmasController = require("../controllers/turma-controllers.js");

routes.get('/', login.obrigatorioLogin, turmasController.getTurmas);
routes.get('/:id', login.obrigatorioLogin, turmasController.readOneTurmas);
routes.post('/', login.obrigatorioLogin, turmasController.createTurma);
routes.put('/:id', login.obrigatorioLogin, turmasController.updateTurma);
routes.delete('/:id', login.obrigatorioLogin, turmasController.deleteTurma);

module.exports = routes;