import { Router } from "express";
import { validarAssinatura } from "../utils/validarAssinatura.js";
import { registrarEvento, adicionarNaFila } from "../services/webhookService.js";

const router = Router();

router.post("/", (req, res) => {
    const assinatura = req.get("X-Agora-Signature");

    const assinaturaValida = validarAssinatura(req.body, assinatura);

    if (!assinaturaValida) {
        return res.status(401).json({
            erro: "Assinatura ausente ou inválida",
        });
    }

    let evento;

    try {
        evento = JSON.parse(req.body.toString("utf8"));
    } catch {
        return res.status(400).json({
            erro: "Corpo da requisição contém JSON inválido",
        });
    }

    const resultado = registrarEvento(evento);

    if (!resultado.valido) {
        return res.status(400).json({
            erro: "Evento inválido: informe evento e dados.id",
        });
    }

    if (resultado.duplicado) {
        return res.status(200).json({
            mensagem: "Evento duplicado; nenhum novo processamento realizado",
        });
    }

    console.log("Novo evento recebido:", evento);

    // O evento validado e registrado como novo.
    adicionarNaFila(evento);

    return res.status(202).json({
        mensagem: "Evento aceito para processamento",
    });
});

export default router;