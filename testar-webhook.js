import "dotenv/config";
import { createHmac } from "node:crypto";

const segredo = process.env.WEBHOOK_SECRET;

if (!segredo) {
    throw new Error("WEBHOOK_SECRET não configurado");
}

const corpo = JSON.stringify({
    evento: "mensagem",
    dados: {
        id: "123",
        texto: "!ajuda",
    },
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