const multer = require('multer');

// Configuração básica do multer
const upload = multer({ dest: 'uploads/' });

module.exports = upload;
