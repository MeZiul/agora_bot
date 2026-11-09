import "dotenv/config";

import { createHmac, randomUUID } from "node:crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEBHOOK_URL = "http://localhost:3000/webhooks/agora";

if (!WEBHOOK_SECRET) {
    console.error("Erro: WEBHOOK_SECRET não configurado.");
    process.exit(1);
}

// Gera a assinatura HMAC SHA-256 a partir do corpo original.
function gerarAssinatura(corpo) {
    return createHmac("sha256", WEBHOOK_SECRET).update(corpo).digest("hex");
}

// Envia uma requisição HTTP ao webhook.
async function enviarRequisicao(corpo, assinatura) {
    const headers = {
        "Content-Type": "application/json"
    };

    if (assinatura !== undefined) {
        headers["X-Agora-Signature"] = assinatura;
    }

    const resposta = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers,
        body: corpo,
        signal: AbortSignal.timeout(10000)
    });

    return {
        status: resposta.status,
        body: await resposta.text()
    };
}

let testesAprovados = 0;
let testesExecutados = 0;

// Compara o status recebido com o esperado.
async function executarTeste(nome, statusEsperado, executar) {
    testesExecutados++;

    try {
        const resposta = await executar();
        const aprovado = resposta.status === statusEsperado;

        if (aprovado) {
            testesAprovados++;
        }

        console.log(`${aprovado ? "PASSOU" : "FALHOU"} | ${nome} | ` + `esperado ${statusEsperado}, recebido ${resposta.status}`);

        if (!aprovado) {
            console.log("Resposta:", resposta.body);
        }
    } catch (erro) {
        console.log(`FALHOU | ${nome} | ${erro.message}`);
    }
}

// Identificador único para evitar conflito com execuções anteriores.
const idEvento = randomUUID();

// Evento que não executa comandos nem envia mensagens à Ágora.
const evento = {
    evento: "teste.seguranca",
    conversationId: "conversa-teste-seguranca",
    dados: {
        id: idEvento,
        text: "Teste automatizado de segurança"
    },
    enviadoEm: new Date().toISOString()
};

const corpoValido = JSON.stringify(evento);
const assinaturaValida = gerarAssinatura(corpoValido);

console.log("\n=== TESTES DE SEGURANÇA DO WEBHOOK ===\n");

// TESTE 1: Requisição sem assinatura.
await executarTeste("Sem assinatura", 401, () => enviarRequisicao(corpoValido));

// TESTE 2: Requisição com assinatura incorreta.
await executarTeste("Assinatura incorreta", 401, () => enviarRequisicao(corpoValido, "0".repeat(64))
);

// TESTE 3: JSON inválido, mas com assinatura correta.
const corpoInvalido = '{"evento":';

await executarTeste("JSON inválido, assinatura válida", 400, () => enviarRequisicao(corpoInvalido, gerarAssinatura(corpoInvalido)));

// TESTE 4: Primeiro recebimento do evento válido.
await executarTeste("Evento novo válido", 202, () => enviarRequisicao(corpoValido, assinaturaValida));

// TESTE 5: Reenvio do mesmo evento.
await executarTeste("Evento duplicado", 200, () => enviarRequisicao(corpoValido, assinaturaValida));

console.log("\n=== RESULTADO FINAL ===");
console.log(`${testesAprovados}/${testesExecutados} testes aprovados.`);

if (testesAprovados !== testesExecutados) {
    process.exitCode = 1;
}
