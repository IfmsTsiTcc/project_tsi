const express = require('express');
const routes = express.Router();
const login = require("../middleware/login.js");

const camposController = require("../controllers/campos-controllers.js");

routes.get('/', login.obrigatorioLogin, camposController.getCampos);
routes.get('/:id', login.obrigatorioLogin, camposController.readOneCampos);
routes.post('/', login.obrigatorioLogin, camposController.createCampos);
routes.put('/:id', login.obrigatorioLogin, camposController.updateCampos);
routes.delete('/:id', login.obrigatorioLogin, camposController.deleteCampos);

module.exports = routes;