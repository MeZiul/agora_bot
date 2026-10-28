import "dotenv/config";
import express from "express";
import webhookRoutes from "./src/routes/webhookRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Não inicia o serviço sem o segredo
if (!process.env.WEBHOOK_SECRET) {
    console.error("Erro: a variável WEBHOOK_SECRET não foi configurada.");
    process.exit(1);
}

// Rota de saúde.
app.get("/saude", (req, res) => {
    return res.status(200).json({
        status: "ok",
        mensagem: "Serviço webhook-receptor funcionando",
    });
});

// Preserva os bytes originais do corpo para validar o HMAC.
// O limite evita aceitar corpos excessivamente grandes.
app.use("/webhooks/agora", express.raw({
    type: "application/json",
    limit: "1mb",
}), webhookRoutes);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});