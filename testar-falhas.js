import { createHmac, randomUUID } from "node:crypto";

const URL = "http://localhost:3001/webhooks/agora";
const SEGREDO = "segredo-exclusivo-para-teste";

const evento = {
    evento: "message.created",
    conversationId: "conversa-teste-falhas",
    dados: {
        id: randomUUID(),
        conversationId: "conversa-teste-falhas",
        text: "!ajuda",
        encrypted: false,
    },
    enviadoEm: new Date().toISOString(),
};

const corpo = JSON.stringify(evento);

const assinatura = createHmac("sha256", SEGREDO).update(corpo).digest("hex");

try {
    const resposta = await fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Agora-Signature": assinatura
        },
        body: corpo,
        signal: AbortSignal.timeout(10000)
    });

    console.log("HTTP:", resposta.status);
    console.log("Resposta:", await resposta.text());

    if (resposta.status !== 202) {
        process.exitCode = 1;
    }
} catch (erro) {
    console.error("Erro:", erro.message);
    process.exitCode = 1;
}
