const executeQuery = require('../../pgsql.js');


exports.getCursos = async (req, res, next) => {
    try {
        const campos_id = req.query.campos_id;  // Recebe o campo de filtro de campos_id da query string
        const pagina = parseInt(req.query.page) || 1;  // Página atual, padrão é 1
        const registrosPorPagina = parseInt(req.query.limit) || 10;  // Registros por página, padrão é 10

        // Calcula o offset para a consulta
        const offset = (pagina - 1) * registrosPorPagina;

        // Monta a consulta base
        let query = `
            SELECT cursos.*, campos.nome as campos_nome 
            FROM cursos
            LEFT JOIN campos ON cursos.campos_id = campos.id
        `;
        
        const conditions = [];
        const values = [];

        // Adiciona o filtro por campos_id, se fornecido
        if (campos_id) {
            conditions.push(`cursos.campos_id = $${conditions.length + 1}`);
            values.push(campos_id);
        }

        // Se houver condições, adiciona ao final da consulta
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        // Adiciona o limite e offset para a paginação
        query += ` ORDER BY cursos.id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

        // Adiciona os parâmetros para LIMIT e OFFSET
        values.push(registrosPorPagina, offset);

        // Executa a consulta com os valores dos filtros
        const result = await executeQuery(query, values);

        // Verifica se existem cursos na tabela
        if (result.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: 'Nenhum curso encontrado.',
                },
                registros: [],
            });
        }

        // Consulta para contar o número total de cursos (sem a limitação de registros)
        let countQuery = `
            SELECT COUNT(*) as total
            FROM cursos
            LEFT JOIN campos ON cursos.campos_id = campos.id
        `;

        // Resetando valores para a consulta de contagem
        const countValues = [];

        // Adiciona o filtro de campos_id, se fornecido
        if (campos_id) {
            countQuery += ` WHERE cursos.campos_id = $${countValues.length + 1}`;
            countValues.push(campos_id);
        }

        // Executa a consulta para contar os registros
        const countResult = await executeQuery(countQuery, countValues);

        // Calcula o número total de páginas
        const totalRegistros = countResult[0].total;
        const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

        // Retorna a resposta com os dados dos cursos encontrados
        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: 'Cursos recuperados com sucesso.',
            },
            registros: result,
            paginaAtual: pagina,
            totalRegistros,
            totalPaginas,
        });
    } catch (error) {
        console.error('Erro ao recuperar cursos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao recuperar cursos, tente novamente.',
                error: error.message,
            },
        });
    }
};


exports.readOneCursos = async (req, res, next) => {
    try {
        // Executa a consulta para obter todos os campos
        const { id } = req.params;
        const result = await executeQuery(
            `SELECT cursos.*, campos.nome as campos_nome FROM cursos
                left join campos on cursos.campos_id = campos.id
                where cursos.id = $1
                ORDER BY cursos.id ASC`,
            [id]
        );

        // Verifica se existem cursos na tabela
        if (result.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: 'Nenhum curso encontrado.',
                },
                registros: [],
            });
        }

        // Retorna a resposta com os dados dos cursos encontrados
        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: 'Curso recuperados com sucesso.',
            },
            registros: result,
        });
    } catch (error) {
        console.error('Erro ao recuperar cursos:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao recuperar cursos, tente novamente.',
                error: error.message,
            },
        });
    }
};

exports.createCurso = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const created_at = new Date();
        const usuario = {
            nome: req.body.nome,
            horas_complementares: req.body.horas_complementares,
            campos_id: req.body.campos_id,
            ano_inicio: req.body.ano_inicio,
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
        if (!usuario?.nome || !usuario?.horas_complementares || !usuario?.ano_inicio) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: 'Dados obrigatórios não fornecidos. Verifique se os campos nome e descricao estão presentes.',
                }
            });
        }

        // Verificação de nome já cadastrado
        const resultResponseCusrsoNome = await executeQuery(
            'select * from cursos where nome = $1 and campos_id = $2',
            [usuario?.nome, usuario?.campos_id]
        );

        if (resultResponseCusrsoNome?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Curso ${usuario?.nome} já cadastrado`,
                },
                registros: [],
            });
            return
        }


        // Cria a consulta SQL para inserir um novo curso
        const responseCreate = await executeQuery(
            `INSERT INTO cursos (nome, horas_complementares, ano_inicio, created_at, updated_at, campos_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [usuario?.nome, usuario?.horas_complementares, usuario?.ano_inicio, usuario?.created_at, usuario?.created_at, usuario?.campos_id]
        );

        // Retorna a resposta com os dados da curso criada
        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'curso criado com sucesso',
                registros: responseCreate[0],
            }
        });
    } catch (error) {
        console.error('Erro ao criar curso:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao criar curso, tente novamente.',
                error: error.message,
            }
        });
    }
};

exports.updateCurso = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const created_at = new Date();
        const usuario = {
            nome: req.body.nome,
            horas_complementares: req.body.horas_complementares,
            campos_id: req.body.campos_id,
            ano_inicio: req.body.ano_inicio,
            id: req.usuario?.usuario_id,
            tipo: req.usuario?.tipo,
            curso_id: req.params.id,
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
        if (!usuario?.nome || !usuario?.horas_complementares || !usuario?.ano_inicio) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: 'Dados obrigatórios não fornecidos. Verifique se os campos nome e descricao estão presentes.',
                }
            });
        }

        // Verificação de nome já cadastrado
        const resultResponseCusrsoExiste = await executeQuery(
            'select * from cursos where id = $1 ORDER BY id ASC',
            [usuario?.curso_id]
        );

        if (resultResponseCusrsoExiste?.length < 1) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Curso ${usuario?.nome} não encontrado`,
                },
                registros: [],
            });
            return
        }

        // Verificação de nome já cadastrado
        const resultResponseCusrsoNome = await executeQuery(
            'select * from cursos where nome = $1 and id != $2 ORDER BY id ASC',
            [usuario?.nome, usuario?.curso_id]
        );

        if (resultResponseCusrsoNome?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Nome do curso ${usuario?.nome} já cadastrado`,
                },
                registros: [],
            });
            return
        }


        // Cria a consulta SQL para inserir um novo curso
        const responseCreate = await executeQuery(
            `update cursos set nome = $1, horas_complementares = $2, ano_inicio = $3, updated_at = $4, campos_id = $5
                where id = $6`,
            [usuario?.nome, usuario?.horas_complementares, usuario?.ano_inicio, usuario?.created_at, usuario?.campos_id, usuario.curso_id]
        );

        // Retorna a resposta com os dados da curso criada
        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'curso alterado com sucesso',
                registros: responseCreate[0],
            }
        });
    } catch (error) {
        console.error('Erro ao alterar curso:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao alterar curso, tente novamente.',
                error: error.message,
            }
        });
    }
};

exports.deleteCurso = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const usuario = {
            id: req.usuario?.usuario_id,
            tipo: req.usuario?.tipo,
            curso_id: req.params.id
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
        const resultResponseCursoId = await executeQuery(
            'select * from cursos where id = $1 ORDER BY id ASC',
            [usuario?.curso_id]
        );

        if (resultResponseCursoId?.length < 1) {
            res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: `Curso ${usuario?.curso_id} não encontrado`,
                },
                registros: [],
            });
            return
        }


        await executeQuery(
            `delete from cursos where id = $1`,
            [usuario?.curso_id]
        );

        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Curso removido com sucesso',
                registros: [],
            }
        });
    } catch (error) {
        console.error('Erro ao remover curso:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao remover curso, tente novamente.',
                error: error.message,
            }
        });
    }
};