const executeQuery = require('../../pgsql.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Configuração do cliente OAuth do Google
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.getUsuario = async (req, res, next) => {
    try {
        let registros = [];
        const usuario = {
            tipo: req.usuario?.tipo,  // Tipo do usuário (1 = admin, 0 = aluno)
            id: req.usuario?.usuario_id,  // ID do usuário (usado quando for aluno)
            campos_id: req.query.campos_id,  // Filtro por campos_id (se fornecido)
            tipo_user_filter: req.query.tipo_user_filter  // Filtro por tipo de usuário (1 = admin, 0 = aluno)
        };

        // Recebe os parâmetros de paginação
        const pagina = parseInt(req.query.page) || 1;  // Página atual (default: 1)
        const limite = parseInt(req.query.limit) || 10;  // Limite de registros por página (default: 10)
        const offset = (pagina - 1) * limite;  // Cálculo do OFFSET

        let totalRegistros = 0;  // Para armazenar o total de registros

        // Monta a consulta base
        let query = `
            SELECT usuarios.*, 
                   turmas.nome as turma_nome, 
                   cursos.nome as curso_nome, 
                   cursos.id as curso_id, 
                   cursos.horas_complementares as horas_complementares,
                   campos.nome as campos_nome
            FROM usuarios 
            LEFT JOIN turmas ON turmas.id = usuarios.turma_id
            LEFT JOIN cursos ON cursos.id = turmas.curso_id
            LEFT JOIN campos ON campos.id = usuarios.campos_id
        `;

        // Array para armazenar condições e valores dos filtros
        const conditions = [];
        const values = [];

        // Adiciona o filtro de campos_id, se fornecido
        if (usuario.campos_id) {
            conditions.push(`usuarios.campos_id = $${conditions.length + 1}`);
            values.push(usuario.campos_id);
        }

        // Adiciona o filtro de tipo_user_filter, se fornecido
        if (usuario.tipo_user_filter !== undefined) {
            conditions.push(`usuarios.tipo = $${conditions.length + 1}`);
            values.push(usuario.tipo_user_filter);
        }

        // Filtro para o tipo do usuário (admin ou aluno)
        if (usuario.tipo == 1) {
            // Se for administrador, traz todos os usuários
            // Não adiciona filtro de tipo no SQL, pois queremos todos os tipos
        } else if (usuario.tipo == 0) {
            // Se for aluno, traz somente o próprio usuário
            conditions.push(`usuarios.id = $${conditions.length + 1}`);
            values.push(usuario.id);
        }

        // Adiciona as condições à consulta, se existirem
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        // Contagem total de registros
        const countResult = await executeQuery(
            `SELECT COUNT(*) as total FROM (${query}) as subquery`,
            values
        );
        totalRegistros = countResult[0].total;

        // Busca os registros com paginação
        query += `
            ORDER BY usuarios.id ASC
            LIMIT $${values.length + 1} OFFSET $${values.length + 2}
        `;
        values.push(limite, offset);

        registros = await executeQuery(query, values);

        // Remover o campo 'senha' de cada objeto
        registros = registros?.map(({ senha, ...resto }) => { return resto });

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: 'Sucesso ao consultar dados',
            },
            registros: registros,
            totalRegistros: totalRegistros, // Retorne o total de registros
            totalPaginas: Math.ceil(totalRegistros / limite), // Calcule o total de páginas
        });
    } catch (error) {
        console.error("Erro ao consultar dados:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: 'Erro ao consultar dados, tente novamente',
            },
            registros: [],
            totalRegistros: 0,
            totalPaginas: 0,
        });
    }
};

exports.getOneUsuario = async (req, res, next) => {
    try {
        const usuario = {
            id: req.usuario.tipo == 1 ? req.params?.id : req.usuario.usuario_id
        };
        let registros = await executeQuery(
            'SELECT * FROM usuarios where id = $1 ORDER BY id ASC',
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

        // Remover o campo 'senha' de cada objeto
        registros = registros?.map(({ senha, ...resto }) => { return resto });

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
            cpf: req.body.cpf,
            matricula: req.body.matricula,
            semestre: req.body.semestre,
            ra: req.body.ra,
            created_at: created_at,
            last_login: null,
            turma_id: req.body.turma_id,
            is_active: 1,
            tipo: req.usuario?.tipo == 1 ? req.body.tipo : 0
        }

        // Verificação de email já cadastrado
        const resultResponseEmailUser = await executeQuery(
            'select * from usuarios where email = $1 ORDER BY id ASC',
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

        // Verificação de CPF já cadastrado
        const resultResponseCpfUser = await executeQuery(
            'select * from usuarios where cpf = $1 ORDER BY id ASC',
            [usuario?.cpf]
        );

        if (resultResponseCpfUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `CPF ${usuario?.cpf} já cadastrado`,
                },
                registros: [],
            });
            return
        }

        // Verificação de nome já cadastrado
        const resultResponseNomeUser = await executeQuery(
            'select * from usuarios where nome = $1 ORDER BY id ASC',
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

        // Verificação de matrícula já cadastrada
        const resultResponseMatriculaUser = await executeQuery(
            'select * from usuarios where matricula = $1 ORDER BY id ASC',
            [usuario?.matricula]
        );

        if (resultResponseMatriculaUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Matrícula ${usuario?.matricula} já cadastrada`,
                },
                registros: [],
            });
            return
        }

        // Verificação de RA já cadastrado
        const resultResponseRaUser = await executeQuery(
            'select * from usuarios where ra = $1 ORDER BY id ASC',
            [usuario?.ra]
        );

        if (resultResponseRaUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `RA ${usuario?.ra} já cadastrado`,
                },
                registros: [],
            });
            return
        }

        // Inserção do novo usuário no banco
        const result = await executeQuery(
            `INSERT INTO usuarios (nome, email, senha, tipo, cpf, matricula, semestre, ra, last_login, is_active, created_at, updated_at, turma_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [usuario?.nome, usuario.email, bcrypt.hashSync(usuario?.senha, 10), usuario?.tipo, usuario?.cpf, usuario?.matricula, usuario?.semestre, usuario?.ra, usuario?.last_login, usuario?.is_active, created_at, created_at, usuario?.turma_id]
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
                mensagem: 'Erro ao cadastrar usuário, tente novamente',
            },
            registros: [],
        });
    }
};

exports.postUsuarioLoginAluno = async (req, res, next) => {
    try {
        const { token } = req.body;  // Recebendo o token do Google

        const last_login = new Date();

        if (token) {
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const { email: googleEmail, name, picture } = ticket.getPayload();

            if (!googleEmail.endsWith('@estudante.ifms.edu.br')) {
                return res.status(403).send({
                    status: 403,
                    retorno: {
                        mensagem: 'Apenas e-mails com o domínio @estudante.ifms.edu.br são permitidos.',
                    }
                });
            }

            let resultResponseEmailUser = await executeQuery('SELECT * FROM usuarios WHERE email = $1', [googleEmail]);

            if (resultResponseEmailUser[0]?.is_active === 0) {
                return res.status(403).send({
                    status: 403,
                    retorno: {
                        mensagem: `Seu usuário foi inativado, entre em contato com o administrador`,
                    }
                });
            }

            if (resultResponseEmailUser.length < 1) {
                const newUser = {
                    nome: name,
                    email: googleEmail,
                    foto: picture,
                    senha: '',
                    is_active: 1,
                    tipo: 0,
                    cpf: uuidv4(),
                    created_at: new Date(),
                    last_login: null,
                    matricula: uuidv4(),
                    ra: uuidv4(),
                    semestre: 1,
                    turma_id: null,
                };
                await executeQuery(
                    `INSERT INTO usuarios (nome, email, senha, tipo, cpf, matricula, semestre, ra, last_login, is_active, created_at, updated_at, turma_id) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                    [newUser?.nome, newUser.email, newUser?.senha, newUser?.tipo, newUser?.cpf, newUser?.matricula, newUser?.semestre, newUser?.ra, newUser?.last_login, newUser?.is_active, newUser.created_at, newUser.created_at, newUser?.turma_id]
                );
                resultResponseEmailUser = await executeQuery('SELECT * FROM usuarios WHERE email = $1', [googleEmail]);
            }

            const tokenJWT = jwt.sign(
                {
                    usuario_id: resultResponseEmailUser[0].id,
                    nome: resultResponseEmailUser[0].nome,
                    email: resultResponseEmailUser[0].email,
                    created_at: resultResponseEmailUser[0].created_at,
                    tipo: resultResponseEmailUser[0].tipo
                },
                process.env.JWT_KEY,
                {
                    expiresIn: '48h'
                }
            );

            await executeQuery('UPDATE usuarios SET last_login = $1 WHERE id = $2', [last_login, resultResponseEmailUser[0].id]);

            res.cookie('token', tokenJWT, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 48 * 60 * 60 * 1000,
            });

            const userWithoutPassword = { ...resultResponseEmailUser[0], senha: undefined, token: tokenJWT };

            return res.status(200).send({
                status: 200,
                retorno: {
                    mensagem: 'Usuário autenticado com sucesso',
                    registros: userWithoutPassword
                }
            });
        }
    } catch (error) {
        console.log(error);

        return res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao autenticar usuário, tente novamente',
                error: error.message
            }
        });
    }
};

exports.postUsuarioLoginAdm = async (req, res, next) => {
    try {
        const usuario = {
            email: req.body.email,
            senha: req.body.senha,
        };

        const last_login = new Date();

        if (!usuario?.email || !usuario?.senha) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: `Todos os campos devem ser preenchidos, tente novamente`,
                }
            });
        }

        let resultResponseEmailUser = await executeQuery('select * from usuarios where email=$1 ORDER BY id ASC', [usuario?.email]);

        if (resultResponseEmailUser[0]?.is_active === 0) {
            return res.status(403).send({
                status: 403,
                retorno: {
                    mensagem: `Seu usuário foi inativado, entre em contato com o administrador`,
                }
            });
        }

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

            await executeQuery('update usuarios set last_login = $1 where id = $2 and cpf = $3', [last_login, resultResponseEmailUser[0]?.id, resultResponseEmailUser[0]?.cpf]);

            // Armazena o token JWT no cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.JWT_KEY === 'production', // Somente em produção, se HTTPS estiver habilitado
                maxAge: 48 * 60 * 60 * 1000, // Expira em 48 horas
            });

            // Remover o campo 'senha' de cada objeto
            const userWithoutPassword = { ...resultResponseEmailUser[0], senha: undefined, token };

            res.status(200).send({
                status: 200,
                retorno: {
                    mensagem: 'Usuário autenticado com sucesso',
                    registros: userWithoutPassword
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
        console.log(error);

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
            senha: req.body.senha,
            cpf: req.body.cpf,
            matricula: req.body.matricula || null,
            semestre: req.body.semestre,
            ra: req.body.ra || null,
            created_at: updated_at,
            updated_at: updated_at,
            id: req.usuario.tipo == 1 ? req.params?.id : req.usuario.usuario_id,
            is_active: req.body.is_active,
            tipo: req.usuario.tipo == 1 ? req.body?.tipo : 0,
            turma_id: req.body.turma_id || null
        }

        // Verifica se o usuário com o id informado existe
        const resultResponseIdUser = await executeQuery(
            'select * from usuarios where id = $1 ORDER BY id ASC',
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

        // Verifica se o email já existe para outro usuário
        const resultResponseEmailUser = await executeQuery(
            'select * from usuarios where email = $1 and id != $2 ORDER BY id ASC',
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

        // Verifica se o nome já existe para outro usuário
        const resultResponseNomeUser = await executeQuery(
            'select * from usuarios where nome = $1 and id != $2 ORDER BY id ASC',
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

        // Verifica se o CPF já existe para outro usuário
        const resultResponseCpfUser = await executeQuery(
            'select * from usuarios where cpf = $1 and id != $2 ORDER BY id ASC',
            [usuario?.cpf, usuario?.id]
        );

        if (resultResponseCpfUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `CPF ${usuario?.cpf} já existe para outro usuário`,
                },
                registros: [],
            });
            return
        }

        // Verifica se a matrícula já existe para outro usuário
        const resultResponseMatriculaUser = await executeQuery(
            'select * from usuarios where matricula = $1 and id != $2 ORDER BY id ASC',
            [usuario?.matricula, usuario?.id]
        );

        if (resultResponseMatriculaUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Matrícula ${usuario?.matricula} já existe para outro usuário`,
                },
                registros: [],
            });
            return
        }

        // Verifica se o RA já existe para outro usuário
        const resultResponseRaUser = await executeQuery(
            'select * from usuarios where ra = $1 and id != $2 ORDER BY id ASC',
            [usuario?.ra, usuario?.id]
        );

        if (resultResponseRaUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `RA ${usuario?.ra} já existe para outro usuário`,
                },
                registros: [],
            });
            return
        }

        // Atualiza os dados do usuário no banco de dados
        const result = await executeQuery(
            `UPDATE usuarios 
            SET nome = $1, email = $2, tipo = $3, cpf = $4, matricula = $5, semestre = $6, ra = $7, 
                is_active = $8, created_at = $9, updated_at = $10, turma_id = $11 
            WHERE id = $12
            RETURNING *`,
            [
                usuario?.nome,
                usuario?.email,
                usuario?.tipo,
                usuario?.cpf,
                usuario?.matricula,
                usuario?.semestre,
                usuario?.ra,
                usuario?.is_active,
                usuario?.created_at,
                usuario?.updated_at,
                usuario?.turma_id,
                usuario?.id
            ]
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
            id: req.usuario.tipo == 1 ? req.params?.id : req.usuario.usuario_id,
        }

        const responseUsuarioId = await executeQuery(
            'select * from usuarios where id = $1 ORDER BY id ASC', [usuario?.id]
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
            'delete from usuarios where id = $1', [usuario?.id]
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