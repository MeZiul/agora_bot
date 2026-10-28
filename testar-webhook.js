import "dotenv/config";
import { createHmac } from "node:crypto";

const segredo = process.env.WEBHOOK_SECRET;

if (!segredo) {
    throw new Error("WEBHOOK_SECRET não configurado");
}

const corpo = JSON.stringify({
    evento: "message.created",
    conversationId: "conversa-teste-123",
    dados: {
        id: "mensagem-00",
        senderId: "usuario-teste",
        type: "text",
        text: "!ajuda",
        createdAt: new Date().toISOString(),
    },
    enviadoEm: new Date().toISOString(),
});

const assinatura = createHmac("sha256", segredo)
    .update(Buffer.from(corpo, "utf8"))
    .digest("hex");

const resposta = await fetch("http://localhost:3000/webhooks/agora", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-Agora-Signature": assinatura,
    },
    body: corpo,
});

console.log("Status HTTP:", resposta.status);
console.log("Resposta:", await resposta.json());