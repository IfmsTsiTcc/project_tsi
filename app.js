require('dotenv').config(); // Carrega variáveis de ambiente
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookieParser = require('cookie-parser'); // Importa o cookie-parser
const app = express();

// Importa as rotas
const usuarioRoutes = require('./src/routes/usuario.routes.js');
const pdfRoutes = require('./src/routes/pdf.routes.js');
const cursosRoutes = require('./src/routes/curso.routes.js');
const turmasRoutes = require('./src/routes/turma.routes.js');
const camposRoutes = require('./src/routes/campos.routes.js');

// Middleware para logs de requisição (morgan)
app.use(morgan('dev'));

// Middleware para parsing do corpo das requisições
app.use(bodyParser.urlencoded({ extended: false })); // Lida com dados enviados via formulário
app.use(bodyParser.json()); // Lida com dados no formato JSON

// Middleware para parsing de cookies
app.use(cookieParser());

// Configuração do CORS (permite comunicação entre domínios diferentes)
app.use((req, res, next) => {
    const allowedOrigin = 'http://localhost:3001'; // Altere para o endereço do frontend
    res.header("Access-Control-Allow-Origin", allowedOrigin); // Permite requisições do frontend
    res.header("Access-Control-Allow-Credentials", "true"); // Permite cookies e credenciais
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === "OPTIONS") {
        res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
        return res.status(200).send({});
    }
    next();
});

// Definição das rotas da API
app.use('/usuario', usuarioRoutes);
app.use('/pdf', pdfRoutes);
app.use('/cursos', cursosRoutes);
app.use('/turmas', turmasRoutes);
app.use('/campos', camposRoutes);

// Middleware para tratar URLs não encontradas
app.use((req, res, next) => {
    const error = new Error("Url não encontrada, tente novamente");
    error.status = 404;
    next(error);
});

// Middleware para tratamento de erros gerais
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    return res.send({
        error: {
            message: error.message,
        },
    });
});

// Exporta o app para uso no servidor principal
module.exports = app;
