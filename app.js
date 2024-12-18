require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');  // Importando o cookie-parser
const app = express();

// Importando as rotas
const usuarioRoutes = require('./src/routes/usuario.routes.js');
const pdfRoutes = require('./src/routes/pdf.routes.js');
const cursosRoutes = require('./src/routes/curso.routes.js');
const turmasRoutes = require('./src/routes/turma.routes.js');
const camposRoutes = require('./src/routes/campos.routes.js');

// Usando o morgan para logs
app.use(morgan('dev'));

// Usando o body-parser para lidar com o corpo das requisições
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuração do cookie-parser para trabalhar com cookies
app.use(cookieParser());

// Configuração do CORS (caso necessário) - ajustada para permitir credenciais
app.use((req, res, next) => {
    // Substitua o '*' pelo endereço do seu frontend
    const allowedOrigin = 'http://localhost:3001'; // Altere para o endereço correto do frontend
    res.header("Access-Control-Allow-Origin", allowedOrigin); // Permite apenas o frontend específico
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

// Defina suas rotas e configure o servidor Express
app.use('/usuario', usuarioRoutes);
app.use('/pdf', pdfRoutes);
app.use('/cursos', cursosRoutes);
app.use('/turmas', turmasRoutes);
app.use('/campos', camposRoutes);

// Middleware para tratamento de URL não encontrada
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

module.exports = app;
