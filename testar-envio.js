import "dotenv/config";

const baseUrl = (process.env.AGORA_URL || "https://api.agora.fslab.dev").replace(/\/+$/, "");
const token = process.env.AGORA_BOT_TOKEN;
const conversationId = process.argv[2];
const text = process.argv.slice(3).join(" ") || "Teste de envio do bot: a API da Ágora recebeu esta mensagem.";

if (!token) {
    console.error("Erro: AGORA_BOT_TOKEN não está configurado.");
    process.exit(1);
}

if (!conversationId) {
    console.error("Uso: node testar-envio.js <conversationId> [mensagem]");
    console.error('Exemplo: node testar-envio.js "ID_DA_CONVERSA" "Olá! Teste de envio."');
    process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
    console.log(`Enviando mensagem para a conversa: ${conversationId}`);
    console.log(`API: ${baseUrl}/bot/messages`);

    const response = await fetch(`${baseUrl}/bot/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-bot-token": token,
        },
        body: JSON.stringify({ conversationId, text }),
        signal: controller.signal,
    });

    const responseBody = await response.text();
    console.log(`Status HTTP: ${response.status}`);

    if (responseBody) {
        // Não exibe cabeçalhos nem o token. Limita a resposta para evitar logs excessivos.
        console.log(`Resposta da API: ${responseBody.slice(0, 1000)}`);
    }

    if (!response.ok) {
        console.error("Falha no envio. Confira o status HTTP e a configuração do bot.");
        process.exitCode = 1;
    } else {
        console.log("A API aceitou a requisição. Confirme se a mensagem apareceu na conversa.");
    }
} catch (error) {
    if (error.name === "AbortError") {
        console.error("Erro: a requisição excedeu o tempo limite de 15 segundos.");
    } else {
        console.error(`Erro ao enviar: ${error.message}`);
    }
    process.exitCode = 1;
} finally {
    clearTimeout(timeout);
}