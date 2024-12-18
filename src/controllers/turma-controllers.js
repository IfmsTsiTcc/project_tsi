const executeQuery = require('../../pgsql.js');


exports.getTurmas = async (req, res, next) => {
    try {
        // Extrai os filtros de campos_id e curso_id da requisição
        const { campos_id, curso_id, page, limit } = req.query;

        // Verifica se os parâmetros de página e limite são válidos
        const pagina = page ? parseInt(page) : 1; // Página atual, padrão é 1
        const limite = limit ? parseInt(limit) : 10; // Limite de registros por página, padrão é 10

        console.log(`Página: ${pagina}, Limite: ${limite}`);

        // Monta a consulta base
        let query = `
            SELECT turmas.*, 
                   cursos.nome as curso_nome, 
                   campos.nome as campos_nome
            FROM turmas
            LEFT JOIN cursos ON turmas.curso_id = cursos.id
            LEFT JOIN campos ON cursos.campos_id = campos.id
        `;

        // Array para armazenar condições e valores dos filtros
        const conditions = [];
        const values = [];

        // Adiciona o filtro de campos_id, se fornecido
        if (campos_id) {
            conditions.push(`campos.id = $${values.length + 1}`);
            values.push(campos_id);
        }

        // Adiciona o filtro de curso_id, se fornecido
        if (curso_id) {
            conditions.push(`cursos.id = $${values.length + 1}`);
            values.push(curso_id);
        }

        // Adiciona as condições à consulta, se existirem
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        // Adiciona a ordenação
        query += ` ORDER BY turmas.created_at ASC`;

        // Calcula o OFFSET baseado na página e no limite
        const offset = (pagina - 1) * limite;

        // Adiciona os parâmetros de LIMIT e OFFSET ao array de valores
        query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limite, offset);

        // Exibe a consulta para depuração
        console.log("Consulta principal:", query);
        console.log("Valores:", values);

        // Executa a consulta com os valores dos filtros, limite e offset
        const result = await executeQuery(query, values);

        // Verifica se existem turmas na tabela
        if (result.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: 'Nenhuma turma encontrada.',
                },
                registros: [],
                paginaAtual: pagina,
                totalRegistros: 0,
                totalPaginas: 0,
            });
        }

        // Consulta para obter o total de registros sem o LIMIT
        let countQuery = `
            SELECT COUNT(*) as total
            FROM turmas
            LEFT JOIN cursos ON turmas.curso_id = cursos.id
            LEFT JOIN campos ON cursos.campos_id = campos.id
        `;

        // Array para armazenar os valores de contagem
        const countValues = [];

        // Adiciona as condições de filtros à consulta de contagem
        if (conditions.length > 0) {
            countQuery += ` WHERE ` + conditions.join(' AND ');
            countValues.push(...values.slice(0, conditions.length)); // Apenas os valores dos filtros
        }

        // Exibe a consulta de contagem para depuração
        console.log("Consulta de contagem:", countQuery);
        console.log("Valores de contagem:", countValues);

        // Executa a consulta para contar o total de registros
        const countResult = await executeQuery(countQuery, countValues);
        const totalRegistros = countResult[0].total;
        const totalPaginas = Math.ceil(totalRegistros / limite); // Calcula o total de páginas

        // Retorna a resposta com os dados das turmas encontradas e a paginação
        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: 'Turmas recuperadas com sucesso.',
            },
            registros: result,
            paginaAtual: pagina,
            totalRegistros: totalRegistros,
            totalPaginas: totalPaginas,
        });
    } catch (error) {
        console.error('Erro ao recuperar turmas:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao recuperar turmas, tente novamente.',
                error: error.message,
            },
        });
    }
};


exports.readOneTurmas = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await executeQuery(
            `SELECT turmas.*, cursos.nome as curso_nome FROM turmas 
                left join cursos on turmas.curso_id = cursos.id
                where turmas.id = $1
                ORDER BY created_at ASC`,
            [id]
        );

        // Verifica se existem turmas na tabela
        if (result.length < 1) {
            return res.status(404).send({
                status: 404,
                retorno: {
                    mensagem: 'Nenhuma turma encontrada.',
                },
                registros: [],
            });
        }

        // Retorna a resposta com os dados dos turmas encontrados
        res.status(200).send({
            status: 200,
            retorno: {
                mensagem: 'Turma recuperada com sucesso.',
            },
            registros: result,
        });
    } catch (error) {
        console.error('Erro ao recuperar turma:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao recuperar turma, tente novamente.',
                error: error.message,
            },
        });
    }
};

exports.createTurma = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const created_at = new Date();
        const usuario = {
            nome: req.body.nome,
            ano_inicio: req.body.ano_inicio,
            ano_fim: req.body.ano_fim,
            periodo: req.body.periodo,
            curso_id: req.body.curso_id,
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
        if (!usuario?.nome || !usuario?.ano_inicio || !usuario?.curso_id) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: 'Dados obrigatórios não fornecidos. Verifique se os campos nome e descricao estão presentes.',
                }
            });
        }

        // Verificação de nome já cadastrado
        const resultResponseTurmaNome = await executeQuery(
            'select * from turmas where nome = $1 ORDER BY id ASC',
            [usuario?.nome]
        );

        if (resultResponseTurmaNome?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Turma ${usuario?.nome} já cadastrada`,
                },
                registros: [],
            });
            return
        }


        const responseCreate = await executeQuery(
            `INSERT INTO turmas (nome, ano_inicio, ano_fim, periodo, curso_id, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [usuario?.nome, usuario?.ano_inicio, usuario?.ano_fim, usuario?.periodo, usuario?.curso_id, usuario?.created_at, usuario?.created_at]
        );

        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Turma criada com sucesso',
                registros: responseCreate[0],
            }
        });
    } catch (error) {
        console.error('Erro ao criar turma:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao criar turma, tente novamente.',
                error: error.message,
            }
        });
    }
};

exports.updateTurma = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const created_at = new Date();
        const usuario = {
            nome: req.body.nome,
            ano_inicio: req.body.ano_inicio,
            ano_fim: req.body.ano_fim,
            turma_id: req.params.id,
            periodo: req.body.periodo,
            curso_id: req.body.curso_id,
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
        if (!usuario?.nome || !usuario?.ano_inicio || !usuario?.curso_id) {
            return res.status(400).send({
                status: 400,
                retorno: {
                    mensagem: 'Dados obrigatórios não fornecidos. Verifique se os campos nome e descricao estão presentes.',
                }
            });
        }

        // Verificação de nome já cadastrado
        const resultResponseTurmaNome = await executeQuery(
            'select * from turmas where nome = $1 and id != $2 ORDER BY id ASC',
            [usuario?.nome, usuario?.turma_id]
        );

        if (resultResponseTurmaNome?.length > 0) {
            res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: `Turma ${usuario?.nome} ${usuario?.turma_id} já cadastrada`,
                },
                registros: [],
            });
            return
        }


        const responseCreate = await executeQuery(
            `update turmas set nome = $1, ano_inicio = $2, ano_fim = $3, periodo = $4, curso_id = $5, updated_at = $6 where id = $7`,
            [usuario?.nome, usuario?.ano_inicio, usuario?.ano_fim, usuario?.periodo, usuario?.curso_id, usuario?.created_at, usuario?.turma_id]
        );

        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Turma alterada com sucesso',
                registros: responseCreate[0],
            }
        });
    } catch (error) {
        console.error('Erro ao alterar turma:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao alterar turma, tente novamente.',
                error: error.message,
            }
        });
    }
};

exports.deleteTurma = async (req, res, next) => {
    try {
        // Obtém os dados da requisição
        const usuario = {
            id: req.usuario?.usuario_id,
            tipo: req.usuario?.tipo,
            turma_id: req.params.id
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
        const resultResponseTurmaId = await executeQuery(
            'select * from turmas where id = $1 ORDER BY id ASC',
            [usuario?.turma_id]
        );

        if (resultResponseTurmaId?.length < 1) {
            res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: `Turma ${usuario?.turma_id} não encontrada`,
                },
                registros: [],
            });
            return
        }


        await executeQuery(
            `delete from turmas where id = $1`,
            [usuario?.turma_id]
        );

        res.status(201).send({
            status: 201,
            retorno: {
                mensagem: 'Turma removida com sucesso',
                registros: [],
            }
        });
    } catch (error) {
        console.error('Erro ao remover turma:', error);
        res.status(500).send({
            status: 500,
            retorno: {
                mensagem: 'Erro ao remover turma, tente novamente.',
                error: error.message,
            }
        });
    }
};