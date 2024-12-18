const executeQuery = require('../../pgsql.js');


exports.getCampos = async (req, res, next) => {
    try {
        // Obtém os parâmetros de paginação da query string
        const pagina = parseInt(req.query.page) || 1;  // Página atual, padrão é 1
        const registrosPorPagina = parseInt(req.query.limit) || 10;  // Registros por página, padrão é 10

        // Calcula o offset para a consulta
        const offset = (pagina - 1) * registrosPorPagina;

        // Monta a consulta base com LIMIT e OFFSET para paginação
        let query = `
            SELECT * 
            FROM campos
            ORDER BY id ASC
            LIMIT $1 OFFSET $2
        `;

        // Executa a consulta com os parâmetros de LIMIT e OFFSET
        const response = await executeQuery(query, [registrosPorPagina, offset]);

        // Verifica se existem campos na tabela
        if (response.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: 'Nenhum campo encontrado.',
                },
                registros: [],
            });
        }

        // Consulta para contar o número total de campos (sem a limitação de registros)
        const countQuery = `SELECT COUNT(*) as total FROM campos`;
        const countResult = await executeQuery(countQuery);

        // Calcula o número total de páginas
        const totalRegistros = countResult[0].total;
        const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

        // Retorna a resposta com os dados dos campos encontrados e informações de paginação
        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: 'Campos recuperados com sucesso.',
            },
            registros: response,
            paginaAtual: pagina,
            totalRegistros,
            totalPaginas,
        });
    } catch (error) {
        console.error('Erro ao recuperar campos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao recuperar campos, tente novamente.',
                error: error.message,
            },
        });
    }
};


exports.readOneCampos = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Executa a consulta para obter todos os campos
        const response = await executeQuery(
            `SELECT * FROM campos where id = $1 ORDER BY id ASC`,
            [id]
        );

        // Verifica se existem campos na tabela
        if (response.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: 'Nenhum campos encontrado.',
                },
                registros: [],
            });
        }

        // Retorna a resposta com os dados dos campos encontrados
        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: 'campos recuperado com sucesso.',
            },
            registros: response,
        });
    } catch (error) {
        console.error('Erro ao recuperar campos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao recuperar campos, tente novamente.',
                error: error.message,
            },
        });
    }
};

exports.createCampos = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const created_at = new Date();
        const usuario = {
            nome: req.body.nome,
            descricao: req.body.descricao,
            id: req.usuario?.usuario_id,
            tipo: req.usuario?.tipo,
            created_at: created_at
        }
        if (usuario?.tipo != 1) {
            return res.status(401).send({
                status: 401,
                retorno: {
                    mensagem: 'Ação não permitida para usuário: ' + usuario?.id,
                }
            });
        }
        // Verifica se os dados obrigatórios foram fornecidos
        if (!usuario?.nome || !usuario?.descricao) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: 'Dados obrigatórios não fornecidos. Verifique se os campos nome e descricao estão presentes.',
                }
            });
        }

        // Verificação de nome já cadastrado
        const resultResponseCamposNome = await executeQuery(
            'select * from campos where nome = $1 ORDER BY id ASC',
            [usuario?.nome]
        );

        if (resultResponseCamposNome?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Campos ${usuario?.nome} já cadastrado`,
                },
                registros: [],
            });
            return
        }


        // Cria a consulta SQL para inserir um novo campos
        const responseCreate = await executeQuery(
            `INSERT INTO campos (nome, descricao, created_at, updated_at)
            VALUES ($1, $2, $3, $4) RETURNING *`,
            [usuario?.nome, usuario?.descricao, usuario?.created_at, usuario?.created_at]
        );

        // Retorna a resposta com os dados da campos criada
        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Campos criado com sucesso',
                registros: responseCreate[0],
            }
        });
    } catch (error) {
        console.error('Erro ao criar campos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao criar campos, tente novamente.',
                error: error.message,
            }
        });
    }
};

exports.updateCampos = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const created_at = new Date();
        const usuario = {
            nome: req.body.nome,
            descricao: req.body.descricao,
            id: req.usuario?.usuario_id,
            tipo: req.usuario?.tipo,
            campos_id: req.params.id,
            created_at: created_at
        }

        if (usuario?.tipo != 1) {
            return res.status(401).send({
                status: 401,
                retorno: {
                    mensagem: 'Ação não permitida para usuário: ' + usuario?.id,
                }
            });
        }

        // Verifica se os dados obrigatórios foram fornecidos
        if (!usuario?.nome || !usuario?.descricao || !usuario?.campos_id) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: 'Dados obrigatórios não fornecidos. Verifique se os campos nome e descricao estão presentes.',
                }
            });
        }
        const resultResponseCamposIdUser = await executeQuery(
            'select * from campos where nome = $1 and id != $2 ORDER BY id ASC',
            [usuario?.nome, usuario?.campos_id]
        );

        if (resultResponseCamposIdUser?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Nome ${usuario?.nome} já cadastrado para outro campos`,
                },
                registros: [],
            });
            return
        }


        const resultResponseCamposId = await executeQuery(
            'select * from campos where id = $1 ORDER BY id ASC',
            [usuario?.campos_id]
        );

        if (resultResponseCamposId?.length < 1) {
            res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: `Campos ${usuario?.campos_id} não foi encontrado`,
                },
                registros: [],
            });
            return
        }


        const responseCreate = await executeQuery(
            `update campos set nome = $1, descricao = $2, updated_at = $3 where id = $4`,
            [usuario?.nome, usuario?.descricao, usuario?.created_at, usuario?.campos_id]
        );

        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Campos alterado com sucesso',
                registros: responseCreate[0],
            }
        });
    } catch (error) {
        console.error('Erro ao alterar campos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao alterar campos, tente novamente.',
                error: error.message,
            }
        });
    }
};

exports.deleteCampos = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const usuario = {
            id: req.usuario?.usuario_id,
            tipo: req.usuario?.tipo,
            campos_id: req.params.id
        }
        if (usuario?.tipo != 1) {
            return res.status(401).send({
                status: 401,
                retorno: {
                    mensagem: 'Ação não permitida para usuário: ' + usuario?.id,
                }
            });
        }

        // Verificação de nome já cadastrado
        const resultResponseCamposId = await executeQuery(
            'select * from campos where id = $1 ORDER BY id ASC',
            [usuario?.campos_id]
        );

        if (resultResponseCamposId?.length < 1) {
            res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: `Campos ${usuario?.campos_id} não encontrado`,
                },
                registros: [],
            });
            return
        }


        await executeQuery(
            `delete from campos where id = $1`,
            [usuario?.campos_id]
        );

        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Campos removido com sucesso',
                registros: [],
            }
        });
    } catch (error) {
        console.error('Erro ao remover campos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao remover campos, tente novamente.',
                error: error.message,
            }
        });
    }
};
