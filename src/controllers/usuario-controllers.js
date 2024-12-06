const executeQuery = require('../../pgsql.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.getUsuario = async (req, res, next) => {
    try {
        let registros = [];
        const usuario = {
            tipo: req.usuario?.tipo,
            id: req.usuario?.usuario_id
        }
        if (usuario?.tipo == 1) {
            registros = await executeQuery('SELECT * FROM usuario');
        } else if (usuario?.tipo == 0) {
            registros = await executeQuery('SELECT * FROM usuario where id = $1', [usuario?.id]);
        }

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: 'Sucesso ao consultar dados',
            },
            registros: registros,
        });
    } catch (error) {
        console.error("Erro ao consultar dados:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: 'Erro ao consultar dados, tente novamente',
            },
            registros: [],
        });
    }
};

exports.getOneUsuario = async (req, res, next) => {
    try {
        const usuario = {
            id: req.usuario.tipo == 1 ? req.params?.id : req.usuario.usuario_id
        };
        const registros = await executeQuery(
            'SELECT * FROM usuario where id = $1',
            [usuario?.id]
        );

        if (registros.length < 1) {
            res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: `Usuário com id ${usuario.id} não foi localizado`,
                },
                registros: registros,
            });
            return
        }

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: 'Sucesso ao consultar dados',
            },
            registros: registros,
        });
    } catch (error) {
        console.error("Erro ao consultar dados:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: 'Erro ao consultar dados, tente novamente',
            },
            registros: [],
        });
    }
};

exports.postUsuario = async (req, res, next) => {
    try {
        const created_at = new Date();

        const usuario = {
            nome: req.body.nome,
            senha: req.body.senha,
            email: req.body.email,
            created_at: created_at,
            tipo: req.usuario?.tipo == 1 ? req.body.tipo : 0
        }

        const resultResponseEmailUser = await executeQuery(
            'select * from usuario where email = $1',
            [usuario?.email]
        );

        if (resultResponseEmailUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Email ${usuario?.email} já cadastrado`,
                },
                registros: [],
            });
            return
        }

        const resultResponseNomeUser = await executeQuery(
            'select * from usuario where nome = $1',
            [usuario?.nome]
        );

        if (resultResponseNomeUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Nome ${usuario?.nome} já cadastrado`,
                },
                registros: [],
            });
            return
        }

        const result = await executeQuery(
            'INSERT INTO usuario (nome, senha, email, created_at, updated_at, tipo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [usuario?.nome, bcrypt.hashSync(usuario?.senha, 10), usuario?.email, created_at, created_at, usuario?.tipo]
        );

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: 'Usuário cadastrado com sucesso',
            },
            registros: result,
        });
    } catch (error) {
        console.error("Erro ao inserir dados:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: 'Erro so cadastrar usuário, tente novamente',
            },
            registros: [],
        });
    }
};

exports.postUsuarioLogin = async (req, res, next) => {
    try {
        const usuario = {
            email: req.body.email,
            senha: req.body.senha,
        };

        if (!usuario?.email || !usuario?.senha) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: `Todos os campos devem ser preenchidos, tente novamente`,
                }
            });
        }

        const resultResponseEmailUser = await executeQuery('select * from usuario where email=$1', [usuario?.email]);

        if (resultResponseEmailUser?.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: `Falha na autenticação, os dados informados são invalidos`,
                }
            });
        }


        if (bcrypt.compareSync(usuario?.senha, `${resultResponseEmailUser[0]?.senha}`)) {
            const token = jwt.sign(
                {
                    usuario_id: resultResponseEmailUser[0]?.id,
                    nome: resultResponseEmailUser[0]?.nome,
                    email: resultResponseEmailUser[0]?.email,
                    created_at: resultResponseEmailUser[0]?.created_at,
                    tipo: resultResponseEmailUser[0]?.tipo
                },
                process.env.JWT_KEY,
                {
                    expiresIn: '48h'
                }

            );

            res.status(200).send({
                status: 200,
                retorno: {
                    mensagem: 'Usuário autenticado com sucesso',
                    registros: {
                        token: token,
                        id: resultResponseEmailUser[0]?.id,
                        nome: resultResponseEmailUser[0]?.nome,
                        email: resultResponseEmailUser[0]?.email,
                        senha: resultResponseEmailUser[0]?.senha,
                        created_at: resultResponseEmailUser[0]?.created_at,
                        tipo: resultResponseEmailUser[0]?.tipo,
                    }
                }
            });
        } else {
            res.status(401).send({
                status: 401,
                retorno: {
                    mensagem: "Falha na autenticação, os dados informados são invalidos",
                },
            });
        }
    } catch (error) {
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao autenticar usuário, tente novamente',
                error: error
            }
        });
    }
}

exports.putUsuario = async (req, res, next) => {
    try {
        const updated_at = new Date();
        const usuario = {
            nome: req.body.nome,
            email: req.body.email,
            updated_at: updated_at,
            id: req.usuario.tipo == 1 ? req.params?.id : req.usuario.usuario_id,
            tipo: req.usuario?.tipo == 1 ? req.body.tipo : 0
        }

        const resultResponseIdUser = await executeQuery(
            'select * from usuario where id = $1',
            [usuario?.id]
        );

        if (resultResponseIdUser?.length < 1) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Usuário com id ${usuario?.id} não foi localizado`,
                },
                registros: [],
            });
            return
        }

        const resultResponseEmailUser = await executeQuery(
            'select * from usuario where email = $1 and id != $2',
            [usuario?.email, usuario?.id]
        );

        if (resultResponseEmailUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Email ${usuario?.email} já existe para outro usuário`,
                },
                registros: [],
            });
            return
        }

        const resultResponseNomeUser = await executeQuery(
            'select * from usuario where nome = $1 and id != $2',
            [usuario?.nome, usuario?.id]
        );

        if (resultResponseNomeUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Nome ${usuario?.nome} já existe para outro usuário`,
                },
                registros: [],
            });
            return
        }

        const result = await executeQuery(
            'update usuario set nome = $1, email = $2, updated_at = $3, tipo = $4 where id = $5 RETURNING *',
            [usuario?.nome, usuario?.email, usuario?.updated_at, usuario?.tipo, usuario?.id]
        );

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: `Usuário ${usuario?.nome} atualizado com sucesso`,
            },
            registros: result,
        });
    } catch (error) {
        console.error("Erro ao atualizar:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: 'Erro ao atualizar dados, tente novamente',
            },
            registros: [],
        });
    }
};

exports.deleteUsuario = async (req, res, next) => {
    try {
        const usuario = {
            id: req.usuario.usuario_id
        }

        const responseUsuarioId = await executeQuery(
            'select * from usuario where id = $1', [usuario?.id]
        );

        if (responseUsuarioId?.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: `Usuário com id ${usuario.id} não foi localizado, tente novamente`,
                }
            });
        }

        await executeQuery(
            'delete from usuario where id = $1', [usuario?.id]
        );

        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: `Usuário com id ${usuario?.id} foi removido com sucesso`,
            }
        });
    } catch (error) {
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: `Erro ao remover usuário, tente novamente`,
                error: error
            }
        });
    }
}