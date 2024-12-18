const jwt = require("jsonwebtoken");

exports.obrigatorioLogin = (req, res, next) => {
  try {
    // Obter o token do cookie
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).send({
        retorno: {
          status: 401,
          mensagem: "Token não encontrado, por favor faça login",
        },
      });
    }

    // Verificar o token JWT
    const decoded = jwt.verify(token, process.env.JWT_KEY);

    // Armazenar as informações do usuário no objeto 'req'
    req.usuario = decoded;

    // Passar para o próximo middleware
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).send({
        retorno: {
          status: 401,
          mensagem: "Token expirado, por favor faça login novamente",
        },
      });
    }
    return res.status(401).send({
      retorno: {
        status: 401,
        mensagem: "Falha na autenticação, token inválido",
      },
    });
  }
};

exports.opcionalLogin = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      // Verificar o token JWT, se existir
      const decoded = jwt.verify(token, process.env.JWT_KEY);
      req.usuario = decoded;

      // Aqui você pode adicionar a lógica para verificar se o usuário existe no banco de dados
      // Exemplo de verificação (se necessário):
      // const usuario = ... // lógica para verificar no banco de dados

      // Exemplo de verificação
      // if (!usuario) {
      //   return res.status(401).send({
      //     retorno: {
      //       status: 401,
      //       mensagem: "Usuário não encontrado, faça login novamente",
      //     },
      //   });
      // }
    }

    // Passar para o próximo middleware (mesmo sem token)
    next();
  } catch (error) {
    // Caso o token seja inválido ou não exista, apenas chama o próximo middleware
    console.error("Erro no middleware opcionalLogin:", error.message);
    next();
  }
};
