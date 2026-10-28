import { createHmac, timingSafeEqual } from "node:crypto";

export function validarAssinatura(corpoOriginal, assinaturaRecebida) {
    const segredo = process.env.WEBHOOK_SECRET;

    // Sem segredo, não valida o webhook.
    if (!segredo || !Buffer.isBuffer(corpoOriginal)) {
        return false;
    }

    if (typeof assinaturaRecebida !== "string") {
        return false;
    }

    // Calcula a assinatura HMAC-SHA256 do corpo original.
    const assinaturaEsperada = createHmac("sha256", segredo)
        .update(corpoOriginal)
        .digest();

    // Aceita o formato hexadecimal, com ou sem o prefixo sha256=.
    const assinaturaHex = assinaturaRecebida.replace(/^sha256=/i, "");

    // Uma assinatura hexadecimal SHA-256 deve ter 64 caracteres.
    if (!/^[a-f0-9]{64}$/i.test(assinaturaHex)) {
        return false;
    }

    const assinaturaBuffer = Buffer.from(assinaturaHex, "hex");

    // Compara as assinaturas sem uma comparação simples de strings.
    return (
        assinaturaBuffer.length === assinaturaEsperada.length &&
        timingSafeEqual(assinaturaBuffer, assinaturaEsperada)
    );
}