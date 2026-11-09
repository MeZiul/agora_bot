# Ágora Bot — Integração com Webhooks

Serviço desenvolvido em **Node.js e Express** para integração bidirecional com a plataforma Ágora, permitindo receber eventos por webhooks, interpretar comandos enviados em conversas e responder automaticamente utilizando a API de bots.

O projeto utiliza autenticação HMAC SHA-256, deduplicação de eventos, processamento assíncrono em fila, retentativas com intervalos progressivos e registro de falhas esgotadas.

## 1. Tecnologias utilizadas

- Node.js
- Express
- JavaScript (ES Modules)
- Docker e Docker Compose
- API de Bots da Ágora
- HMAC SHA-256 (módulo `node:crypto`)
- Variáveis de ambiente com `dotenv`

## 2. Endereço público

**Aplicação:** https://agora-bot-luiz.app.fslab.dev

**Verificação de funcionamento:**

https://agora-bot-luiz.app.fslab.dev/saude

O endpoint `/saude` retorna uma resposta JSON indicando que o serviço está em funcionamento.

## 3. Funcionalidades

### Recebimento de webhooks

O serviço recebe eventos da Ágora por meio do endpoint:

`POST /webhooks/agora`

Cada requisição passa pelas seguintes etapas:

1. Recebimento do corpo original da requisição.
2. Verificação da assinatura HMAC SHA-256.
3. Validação do JSON recebido.
4. Identificação de eventos duplicados.
5. Registro e encaminhamento do evento para a fila de processamento.
6. Retorno HTTP imediato ao remetente.

**Códigos HTTP utilizados:**

| Código | Significado |
|---|---|
| 202 | Evento novo aceito para processamento |
| 200 | Evento duplicado já recebido |
| 400 | Corpo JSON inválido |
| 401 | Assinatura ausente ou inválida |

### Comandos do bot

O bot interpreta comandos enviados em conversas da Ágora.

| Comando | Descrição |
|---|---|
| `!ajuda` | Lista os comandos disponíveis |
| `!eventos` | Mostra os últimos eventos recebidos |
| `!contar` | Informa quantos eventos foram recebidos |
| Comando desconhecido | Orienta o usuário a utilizar `!ajuda` |

Mensagens comuns que não começam com `!` não geram respostas automáticas.

### Envio de mensagens

As respostas são enviadas pela API da Ágora:

`POST https://api.agora.fslab.dev/bot/messages`

A autenticação é realizada pelo cabeçalho `x-bot-token`.

O corpo enviado contém o identificador da conversa e o texto da mensagem.

### Processamento assíncrono

Eventos novos são aceitos com HTTP 202 e encaminhados para uma fila de processamento em memória.

Isso permite que a resposta HTTP do webhook seja enviada sem aguardar o processamento completo do evento.

### Retentativas e registro de falhas

Quando ocorre uma falha durante o processamento, o serviço realiza até quatro tentativas.

Os intervalos entre as tentativas são progressivos:

- Primeira retentativa: 1 segundo.
- Segunda retentativa: 2 segundos.
- Terceira retentativa: 4 segundos.

Se todas as tentativas falharem, o evento é registrado na lista de falhas esgotadas.

Os registros podem ser consultados pelo endpoint:

`GET /falhas`

## 4. Segurança

### Validação HMAC SHA-256

O serviço valida a assinatura recebida no cabeçalho:

`X-Agora-Signature`

A assinatura esperada é calculada utilizando o corpo original da requisição e o segredo configurado em `WEBHOOK_SECRET`.

A comparação utiliza `timingSafeEqual`, reduzindo riscos associados à comparação de assinaturas por tempo de execução.

Requisições sem assinatura válida são rejeitadas com HTTP 401.

### Proteção de credenciais

As credenciais são configuradas por variáveis de ambiente.

O arquivo `.env` contém informações sensíveis e não deve ser enviado ao repositório ou incluído no ZIP de entrega.

O projeto disponibiliza um arquivo `.env.example` com os nomes das variáveis necessárias.

### Deduplicação

Os eventos são identificados pela combinação do tipo de evento e do identificador `dados.id`.

Eventos já recebidos retornam HTTP 200, evitando que sejam adicionados novamente à fila.

### Prevenção de loops

O serviço interpreta apenas mensagens que começam com `!`.

As respostas geradas pelo bot não começam com esse prefixo, evitando que mensagens comuns produzidas pelo próprio bot iniciem novos comandos.

## 5. Estrutura do projeto

```text
agora_bot/
├── src/
│   ├── routes/
│   │   └── webhookRoutes.js
│   ├── services/
│   │   └── webhookService.js
│   └── utils/
│       └── validarAssinatura.js
├── evidencias/
├── .dockerignore
├── .env.example
├── .gitignore
├── compose.teste.yaml
├── compose.yaml
├── Dockerfile
├── package-lock.json
├── package.json
├── server.js
├── testar-webhook.js
├── testar-envio.js
├── testar-seguranca.js
├── testar-falhas.js
└── README.md
```

O arquivo `compose.teste.yaml`, quando presente, é utilizado exclusivamente para testes isolados de falhas e retentativas.

## 6. Configuração do ambiente

### Pré-requisitos

- Docker
- Docker Compose
- Acesso à API da Ágora
- Token de bot da Ágora
- Segredo do webhook

### Configurar variáveis de ambiente

Crie um arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Configure:

```env
PORT=3000
WEBHOOK_SECRET=seu_segredo_do_webhook
AGORA_URL=https://api.agora.fslab.dev
AGORA_BOT_TOKEN=seu_token_do_bot
```

**Importante:** a variável `AGORA_URL` deve apontar para a API, sem o sufixo `/docs`.

### Executar com Docker

Na pasta do projeto:

```bash
docker compose up -d --build
```

Verificar os contêineres:

```bash
docker compose ps
```

Acompanhar os logs:

```bash
docker compose logs -f
```

Verificar a aplicação:

```bash
curl http://localhost:3000/saude
```

Resposta esperada:

```json
{
  "status": "ok",
  "mensagem": "Serviço webhook-receptor funcionando"
}
```

## 7. Endpoints

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/saude` | Verificar o funcionamento do serviço |
| POST | `/webhooks/agora` | Receber eventos da Ágora |
| GET | `/eventos` | Consultar informações dos eventos recebidos |
| GET | `/falhas` | Consultar eventos com tentativas esgotadas |

Os endpoints de consulta fazem parte da implementação atual e devem ser utilizados considerando os cuidados de acesso e exposição de dados do ambiente.

## 8. Testes realizados

### Teste de comunicação bidirecional

Foi validado o recebimento de eventos `message.created`, a interpretação dos comandos e o envio de respostas para conversas reais da Ágora.

Os comandos `!ajuda`, `!eventos`, `!contar` e um comando desconhecido foram testados pela interface da plataforma.

As respostas apareceram na conversa.

### Testes automatizados de segurança

Arquivo: `testar-seguranca.js`

Executar:

```bash
docker compose exec webhook-receptor node testar-seguranca.js
```

Cenários testados:

| Cenário | HTTP esperado |
|---|---|
| Requisição sem assinatura | 401 |
| Assinatura incorreta | 401 |
| JSON inválido com assinatura válida | 400 |
| Evento novo válido | 202 |
| Evento duplicado | 200 |

Os cinco cenários foram executados com sucesso.

### Teste de envio direto

Arquivo: `testar-envio.js`

Exemplo:

```bash
docker compose exec webhook-receptor node testar-envio.js "ID_DA_CONVERSA" "Mensagem de teste"
```

O script utiliza o token configurado no ambiente para realizar uma requisição diretamente à API de bots da Ágora.

Substitua `ID_DA_CONVERSA` por um identificador válido.

### Teste de falhas e retentativas

Arquivo: `testar-falhas.js`

O teste foi realizado em um contêiner Docker isolado, utilizando uma URL de API propositalmente inacessível.

Foram observados:

1. Aceitação do evento com HTTP 202.
2. Falha na primeira tentativa.
3. Retentativas após 1, 2 e 4 segundos.
4. Encerramento após quatro tentativas.
5. Registro do evento no endpoint `/falhas`.

A consulta retornou um registro com `tentativas: 4` e erro `fetch failed`.

O ambiente de teste foi separado do contêiner principal, evitando interferências na integração real.

## 9. Limitações conhecidas

### Armazenamento em memória

A fila de eventos, o histórico, a deduplicação e os registros de falhas são mantidos em memória.

Consequentemente, esses dados podem ser perdidos quando o processo ou o contêiner é reiniciado.

Para um ambiente de produção com maior exigência de persistência, seria recomendável utilizar um banco de dados e uma fila persistente.

### Mensagens criptografadas

Alguns eventos podem chegar com `encrypted: true` e `text: null`.

Nesses casos, o serviço não consegue interpretar comandos a partir do campo `text`.

Os testes demonstraram que também podem ocorrer eventos com `encrypted: true` e texto legível. A interpretação atual depende da disponibilidade do campo `text`.

### Retentativas

O serviço realiza até quatro tentativas, mas não possui uma interface administrativa para reprocessar automaticamente os eventos após o esgotamento das tentativas.

## 10. Implantação

A aplicação foi implantada em uma máquina virtual Linux no ambiente FSLab, utilizando Docker Compose.

O contêiner principal executa o serviço na porta 3000.

O endereço público HTTPS é disponibilizado pela infraestrutura de publicação do ambiente:

https://agora-bot-luiz.app.fslab.dev

A comunicação pública utiliza HTTPS, enquanto o serviço Node.js recebe conexões HTTP internamente.

## 11. Evidências

A pasta `evidencias/` deve conter capturas que demonstrem:

- Serviço funcionando pelo endpoint público `/saude`.
- Configuração do webhook na Ágora, sem exposição de segredos.
- Comando `!ajuda` e resposta do bot.
- Comandos `!eventos` e `!contar`.
- Tratamento de comando desconhecido.
- Resultado dos testes automatizados de segurança.
- Logs das quatro tentativas de envio.
- Resposta do endpoint `/falhas` com uma falha registrada.
- Contêiner principal em execução.

## 12. Entrega

O projeto deve ser compactado em ZIP contendo o código-fonte, o `README.md`, os arquivos de configuração de exemplo e as evidências.

Não incluir:

- `.env` com credenciais reais.
- `node_modules/`.
- Arquivos temporários ou logs com informações sensíveis.

O serviço implantado deve permanecer em funcionamento e acessível pelo endereço público durante o período de avaliação.

---

**Projeto:** Ágora Bot — Integração com Webhooks

**Repositório:** https://github.com/MeZiul/agora_bot

**Plataforma integrada:** Ágora / FSLab
