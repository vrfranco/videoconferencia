// Minimal amount of secure websocket server
var fs = require('fs');
var url = require('url');
var path = require('path');

// read ssl certificate
var privateKey = fs.readFileSync('./certificados/privkey1.pem', 'utf8');
var certificate = fs.readFileSync('./certificados/cert1.pem', 'utf8');
var ca = fs.readFileSync('./certificados/chain1.pem', 'utf8');

var credentials = { key: privateKey, cert: certificate, ca: ca };

var https = require('https');
//var http = require('http');
var express = require('express');
var app = express();
var httpsServer = https.createServer(credentials);
//var httpsServer = http.createServer();
var httpsClient = https.createServer(credentials, app);
//var httpsClient = http.createServer(app);

app.use(express.static('public', { dotfiles: 'allow' } ));

app.get('*', (req,res) => {
    res.sendFile(
        path.join(__dirname+'/public/index.html')
    );
});


httpsClient.listen(3000);
httpsServer.listen(8443);

var WebSocketServer = require('ws').Server;

var wss = new WebSocketServer({
    server: httpsServer
});

let inscricoes = [];

let posicao = 0;

let selecionado = null;

wss.on('connection', (conn, request) =>
{
    // configurando

    let alvo;

    let parametros = url.parse(request.url, true);

    let inscricao = {

        conexao: conn,
        
        nome: parametros.query.nome,
        
        cor: parametros.query.cor,

        id: posicao++,

    };

    inscricoes.push(inscricao);

    // identificando
    if (inscricao.conexao.readyState === 1)
    {
        inscricao.conexao.send(
            JSON.stringify({
                id: inscricao.id,
                evento: 'identificacao',
            })
        );
    }

    // enviando sinal de criação se tiver mais que 1 conexão

    if (posicao > 1)
    {
        // enviando essa nova conexão para as outras conexoes

        inscricoes.filter((item) =>
        {
            return item.id !== inscricao.id;

        }).forEach((item) =>
        {
            // conexão existente
            if (item.conexao.readyState === 1)
            {
                item.conexao.send(
                    JSON.stringify({
                        id: inscricao.id,
                        nome: inscricao.nome,
                        cor: inscricao.cor,
                        evento: 'criacao',
                    })
                );
            }
            
            // essa nova conexão
            if (inscricao.conexao.readyState === 1)
            {
                inscricao.conexao.send(
                    JSON.stringify({
                        id: item.id,
                        nome: item.nome,
                        cor: item.cor,
                        evento: 'criacao',
                    })
                );
            }
        });
        
    }

    // enviando o selecionado

    setTimeout(() =>
    {
        if (!selecionado)
        {
            selecionado = inscricao.id;
            
        } else {
            
            outro = inscricoes.find((item) => {
                return item.id === selecionado;
            });
            
            if(!outro)
            {
                selecionado = inscricoes[0].id
            }
            
        }
        
        inscricoes.forEach((item) =>
        {
            // conexão existente
            if (item.conexao.readyState === 1)
            {
                item.conexao.send(
                    JSON.stringify({
                        id: selecionado,
                        evento: 'selecionado',
                    })
                );
            }
        });

    }, 1000);
        
    // recenbendo mensagens

    conn.on('message', (response) =>
    {
        parametros = JSON.parse(response);

        switch (parametros.evento)
        {
            case 'oferta':

                alvo = inscricoes.find((item) => {
                    return item.id === parametros.id
                });

                if (alvo.conexao.readyState === 1)
                {
                    alvo.conexao.send(
                        JSON.stringify({
                            evento: 'oferta',
                            oferta: parametros.oferta,
                            id: inscricao.id,
                        })
                    );
                }

                break;

            case 'resposta':

                alvo = inscricoes.find((item) => {
                    return item.id === parametros.id
                });

                if (alvo.conexao.readyState === 1)
                {
                    alvo.conexao.send(
                        JSON.stringify({
                            evento: 'resposta',
                            resposta: parametros.resposta,
                            id: inscricao.id,
                        })
                    );
                }

                break;

            case 'candidato':

                alvo = inscricoes.find((item) => {
                    return item.id === parametros.id
                });

                if (alvo.conexao.readyState === 1)
                {
                    alvo.conexao.send(
                        JSON.stringify({
                            evento: 'candidato',
                            candidato: parametros.candidato,
                            id: inscricao.id,
                        })
                    );
                }

                break;

            case 'selecionado':

                selecionado = parametros.id;

                inscricoes.forEach((item) =>
                {
                    // conexão existente
                    if (item.conexao.readyState === 1)
                    {
                        item.conexao.send(
                            JSON.stringify({
                                id: selecionado,
                                evento: 'selecionado',
                            })
                        );
                    }
                });
            
                break;
        }

    });

    // fechando

    conn.on('close', (conexao) =>
    {
        indice = inscricoes.findIndex((item) =>
        {
            return item.id === inscricao.id
        });
        
        inscricoes.splice(indice, 1);

        // removendo de todas as conexões

        inscricoes.filter((item) =>
        {
            return item.id !== inscricao.id;

        }).forEach((item) =>
        {
            // conexão existente
            if (item.conexao.readyState === 1)
            {
                item.conexao.send(
                    JSON.stringify({
                        id: inscricao.id,
                        evento: 'desconectado',
                    })
                );
            }
        });
        
    });

});