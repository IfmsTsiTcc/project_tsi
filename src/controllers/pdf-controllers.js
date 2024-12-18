const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const executeQuery = require('../../pgsql.js');

const s3Client = new S3Client({
    region: "us-east-2", // Substitua pela região correta
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Substitua pela sua chave
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Substitua pela sua chave secreta
    },
});

exports.postPdf = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).send({
                retorno: {
                    status: 400,
                    mensagem: "Nenhum arquivo foi enviado",
                },
                registros: [],
            });
        }

        const filePath = req.file.path;
        const fileName = path.basename(filePath);
        const fileStream = fs.createReadStream(filePath);
        const created_at = new Date();

        const usuario = {
            id: req.usuario?.usuario_id,
            descricao: req.body.descricao,
            data_emissao: req.body.data_emissao,
            validade: req.body.validade,
            status: 0,
            created_at: created_at,
            updated_at: created_at,
        }
        console.log(usuario);

        const params = {
            Bucket: "project-tsi",
            Key: `pdfs/${usuario.id}/${fileName}`,
            Body: fileStream,
            ContentType: "application/pdf",
        };

        // Enviar o arquivo para o S3
        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        // URL gerada para acessar o arquivo
        const s3_url = `https://project-tsi.s3.us-east-2.amazonaws.com/${params.Key}`;

        // Inserir o URL no banco de dados
        const result = await executeQuery(
            'INSERT INTO certificados (descricao, s3_url, data_emissao, validade, status, created_at, updated_at, usuario_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [usuario?.descricao, s3_url, usuario?.data_emissao, usuario?.validade, usuario?.status, created_at, created_at, usuario.id]
        );

        // Remover o arquivo local após o envio bem-sucedido
        fs.unlinkSync(filePath);

        // Responder ao cliente com o sucesso
        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Arquivo enviado e URL salva com sucesso",
            },
            registros: {
                url: s3_url,
            },
        });
    } catch (error) {
        console.error("Erro ao enviar certificado:", error);

        // Remover o arquivo local em caso de falha (opcional, para evitar acúmulo de arquivos com erro)
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error("Erro ao remover arquivo local:", unlinkError);
            }
        }

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao enviar certificado, tente novamente",
            },
            registros: [],
        });
    }
};

exports.updatePdf = async (req, res, next) => {
    try {
        const { id } = req.params; // ID do registro no banco de dados
        const usuario = {
            id: req.usuario?.usuario_id,
            descricao: req.body?.descricao,
            data_emissao: req.body?.data_emissao,
            validade: req.body?.validade
        };

        if (!req.file) {
            return res.status(400).send({
                retorno: {
                    status: 400,
                    mensagem: "Nenhum arquivo foi enviado",
                },
                registros: [],
            });
        }

        // Recuperar o registro atual do banco
        const result = await executeQuery('SELECT * FROM certificados WHERE id = $1 AND usuario_id = $2 ORDER BY id ASC', [id, usuario.id]);
        if (result.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Registro não encontrado ou usuário não autorizado",
                },
                registros: [],
            });
        }

        const registroAtual = result[0];
        const filePath = req.file.path;
        const fileName = path.basename(filePath);
        const fileStream = fs.createReadStream(filePath);

        // Substituir o arquivo no S3
        const params = {
            Bucket: "project-tsi",
            Key: `pdfs/${usuario.id}/${fileName}`, // Aqui pode usar a mesma Key ou criar uma nova.
            Body: fileStream,
            ContentType: "application/pdf",
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        // Remover o arquivo antigo (opcional, caso tenha mudado a Key)
        if (params.Key !== registroAtual.s3_url.split('.com/')[1]) {
            const deleteParams = {
                Bucket: "project-tsi",
                Key: registroAtual.s3_url.split('.com/')[1],
            };
            const deleteCommand = new DeleteObjectCommand(deleteParams);
            await s3Client.send(deleteCommand);
        }

        // Atualizar o banco de dados
        const updated_at = new Date();
        const newS3Url = `https://project-tsi.s3.us-east-2.amazonaws.com/${params.Key}`;
        await executeQuery(
            'UPDATE certificados SET s3_url = $1, descricao = $2, data_emissao = $3, validade = $4, updated_at = $5 WHERE id = $6 and usuario_id = $7',
            [newS3Url, usuario?.descricao, usuario?.data_emissao, usuario?.validade, updated_at, id, usuario?.id]
        );

        // Remover o arquivo local após o envio
        fs.unlinkSync(filePath);

        // Responder ao cliente
        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Arquivo atualizado com sucesso",
            },
            registros: {
                url: newS3Url,
            },
        });
    } catch (error) {
        console.error("Erro ao atualizar certificado:", error);

        // Remover o arquivo local em caso de falha
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error("Erro ao remover arquivo local:", unlinkError);
            }
        }

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao atualizar certificado, tente novamente",
            },
            registros: [],
        });
    }
};

// Função para retornar os registros de PDFs
exports.getPdfs = async (req, res, next) => {
    try {
        const { usuario_id } = req.params; // ID do registro no banco de dados

        const usuario = {
            tipo: req.usuario?.tipo,
            id: req.usuario?.usuario_id
        }
        // Consulta para pegar todos os registros da tabela pdf
        let result = [];

        if (usuario?.tipo == 1) {
            result = await executeQuery('SELECT certificados.*, usuarios.nome as usuarios_nome FROM certificados left join usuarios on usuarios.id = certificados.usuario_id where certificados.usuario_id = $1 ORDER BY certificados.id ASC', [usuario_id]);
        } else if (usuario?.tipo == 0) {
            result = await executeQuery('SELECT certificados.*, usuarios.nome as usuarios_nome FROM certificados left join usuarios on usuarios.id = certificados.usuario_id where certificados.usuario_id = $1 ORDER BY certificados.id ASC', [usuario?.id]);
        }

        if (result.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Nenhum certificado encontrado",
                },
                registros: [],
            });
        }

        // Enviar os registros ao cliente
        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Registros de certificados encontrados",
            },
            registros: result,
        });
    } catch (error) {
        console.error("Erro ao ler registros de certificado:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao ler registros de certificado, tente novamente",
            },
            registros: [],
        });
    }
};


// Função para retornar 1 registros de PDF
exports.getOnePdf = async (req, res, next) => {
    try {
        const { id, usuario_id } = req.params; // ID do registro no banco de dados
        const usuario = {
            tipo: req.usuario?.tipo,
            id: req.usuario?.usuario_id
        }
        let result = [];

        // Consulta para pegar todos os registros da tabela pdf
        if (usuario?.tipo == 1) {
            result = await executeQuery('SELECT * FROM certificados where id = $1 and usuario_id = $2 ORDER BY id ASC', [id, usuario_id]);
        } else if (usuario?.tipo == 0) {
            result = await executeQuery('SELECT * FROM certificados where id = $1 and usuario_id = $2 ORDER BY id ASC', [id, usuario?.id]);
        }

        if (result.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Nenhum certificado encontrado",
                },
                registros: [],
            });
        }

        // Enviar os registros ao cliente
        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Registros de certificados encontrados",
            },
            registros: result,
        });
    } catch (error) {
        console.error("Erro ao ler registros de certificado:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao ler registros de certificado, tente novamente",
            },
            registros: [],
        });
    }
};


exports.deletePdf = async (req, res, next) => {
    try {
        const { id } = req.params; // Pegando o ID do registro no banco de dados que será deletado
        const usuario = {
            id: req.usuario?.usuario_id
        }
        // Primeiro, buscar a URL do S3 associada ao id
        const result = await executeQuery(
            'SELECT s3_url FROM certificados WHERE id = $1 and usuario_id = $2 ORDER BY id ASC',
            [id, usuario?.id]
        );

        if (result.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Arquivo não encontrado no banco de dados ou usuário não autorizado",
                },
                registros: [],
            });
        }

        const s3Url = result[0].s3_url;
        const key = s3Url.replace("https://project-tsi.s3.us-east-2.amazonaws.com/", ""); // Extraímos a chave do S3

        // 1. Deletar o arquivo do S3
        const deleteParams = {
            Bucket: "project-tsi",
            Key: key, // Chave do arquivo que será deletado
        };

        const command = new DeleteObjectCommand(deleteParams);
        await s3Client.send(command);

        // 2. Deletar o registro do banco de dados
        await executeQuery(
            'DELETE FROM certificados WHERE id = $1 and usuario_id = $2',
            [id, usuario?.id]
        );

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Arquivo e registro deletados com sucesso",
            },
            registros: [],
        });
    } catch (error) {
        console.error("Erro ao deletar certificado:", error);

        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao deletar o certificado, tente novamente",
            },
            registros: [],
        });
    }
};
