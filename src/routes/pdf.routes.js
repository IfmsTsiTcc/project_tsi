const express = require('express');
const routes = express.Router();
const upload = require('../middleware/multer.js');
const login = require("../middleware/login.js");

const pdfController = require("../controllers/pdf-controllers.js");

routes.get('/:usuario_id', login.obrigatorioLogin, pdfController.getPdfs);
routes.get('/:id/:usuario_id', login.obrigatorioLogin, pdfController.getOnePdf);
routes.post('/', login.obrigatorioLogin, upload.single('file'), pdfController.postPdf);
routes.put('/:id', login.obrigatorioLogin, upload.single('file'), pdfController.updatePdf);
routes.delete('/:id', login.obrigatorioLogin, pdfController.deletePdf);

module.exports = routes;