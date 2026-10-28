const eventosProcessados = new Set();
const filaEventos = [];
const falhasEsgotadas = [];

let processandoFila = false;

const MAX_TENTATIVAS = 4;
const TEMPO_ESPERA_INICIAL = 1000;

// Verifica se um evento já foi recebido.
export function registrarEvento(evento) {
    const tipoEvento = evento?.evento;
    const idEvento = evento?.dados?.id;

    if (
        typeof tipoEvento !== "string" ||
        tipoEvento.length === 0 ||
        idEvento === undefined ||
        idEvento === null ||
        !["string", "number"].includes(typeof idEvento)
    ) {
        return {
            valido: false,
            duplicado: false,
        };
    }

    const chave = JSON.stringify([tipoEvento, idEvento]);

    if (eventosProcessados.has(chave)) {
        return {
            valido: true,
            duplicado: true,
        };
    }

    eventosProcessados.add(chave);

    return {
        valido: true,
        duplicado: false,
    };
}

// Adiciona um evento à fila de processamento.
export function adicionarNaFila(evento) {
    filaEventos.push({
        evento,
        tentativas: 0,
    });

    // Agenda o processamento sem bloquear a resposta HTTP.
    setImmediate(() => {
        processarFila();
    });
}

// Processa os eventos em segundo plano.
async function processarFila() {
    if (processandoFila) {
        return;
    }

    processandoFila = true;

    try {
        while (filaEventos.length > 0) {
            const tarefa = filaEventos.shift();

            await executarTarefa(tarefa);
        }
    } finally {
        processandoFila = false;

        // Evita deixar tarefas pendentes se outra foi adicionada
        // durante a finalização do processamento.
        if (filaEventos.length > 0) {
            setImmediate(() => {
                processarFila();
            });
        }
    }
}

// Executa uma tarefa e tenta novamente em caso de falha
async function executarTarefa(tarefa) {
    while (tarefa.tentativas < MAX_TENTATIVAS) {
        tarefa.tentativas++;

        try {
            await processarEvento(tarefa.evento);

            console.log(`Evento processado com sucesso após ${tarefa.tentativas} tentativa(s)`);

            return;
        } catch (erro) {
            console.error(`Falha na tentativa ${tarefa.tentativas}:`, erro.message);

            if (tarefa.tentativas >= MAX_TENTATIVAS) {
                falhasEsgotadas.push({
                    evento: tarefa.evento,
                    tentativas: tarefa.tentativas,
                    erro: erro.message,
                    data: new Date().toISOString(),
                });

                console.error("Evento com tentativas esgotadas:", tarefa.evento);

                return;
            }

            const tempoEspera = TEMPO_ESPERA_INICIAL * 2 ** (tarefa.tentativas - 1);

            console.log(`Nova tentativa em ${tempoEspera / 1000} segundo(s).`);

            await new Promise((resolve) => {
                setTimeout(resolve, tempoEspera);
            });
        }
    }
}

// Guarda os eventos recentes para o comando !eventos.
const historicoEventos = [];

// Conta os eventos novos aceitos pelo serviço.
let totalEventosRecebidos = 0;

const LIMITE_HISTORICO = 10;

// Registra um evento novo no histórico.
// Deve ser chamado apenas para eventos válidos e não duplicados.
export function registrarNoHistorico(evento) {
    totalEventosRecebidos++;

    historicoEventos.push({
        tipo: evento.evento,
        id: evento.dados.id,
        texto: evento.dados.text ?? "",
        data: evento.enviadoEm ?? new Date().toISOString(),
    });

    // Mantém somente os dez eventos mais recentes.
    if (historicoEventos.length > LIMITE_HISTORICO) {
        historicoEventos.shift();
    }
}

// Envia uma mensagem para a conversa original no Ágora.
async function enviarMensagem(conversationId, text) {
    const agoraUrl = process.env.AGORA_URL;
    const botToken = process.env.AGORA_BOT_TOKEN;

    // Sem as credenciais, não fingimos que a mensagem foi enviada.
    if (!agoraUrl || !botToken) {
        console.log(`[modo seco] responderia em ${conversationId}: ${text}`);

        return;
    }

    const resposta = await fetch(`${agoraUrl.replace(/\/+$/, "")}/bot/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-bot-token": botToken,
        },
        body: JSON.stringify({
            conversationId,
            text,
        }),
        signal: AbortSignal.timeout(10000),
    }
    );

    if (!resposta.ok) {
        throw new Error(`Ágora respondeu com HTTP ${resposta.status}`);
    }
}

// Monta a resposta de cada comando.

function interpretarComando(texto) {
    const comando = texto.trim().split(/\s+/)[0].toLowerCase();

    switch (comando) {
        case "!ajuda":
            return [
                "Comandos disponíveis:",
                "!ajuda - lista os comandos",
                "!eventos - mostra os últimos eventos recebidos",
                "!contar - mostra quantos eventos foram recebidos",
            ].join("\n");

        case "!eventos": {
            if (historicoEventos.length === 0) {
                return "Ainda não há eventos registrados.";
            }

            const ultimosEventos = historicoEventos
                .slice(-5)
                .reverse()
                .map((evento) => {
                    const resumo = evento.texto
                        ? ` — ${evento.texto}`
                        : "";

                    return `• ${evento.tipo} (${evento.id})${resumo}`;
                });

            return `Últimos eventos recebidos:\n${ultimosEventos.join("\n")}`;
        }

        case "!contar":
            return `O serviço recebeu ${totalEventosRecebidos} evento(s) novo(s) desde que foi iniciado.`;

        default:
            return "Comando desconhecido. Digite !ajuda para ver os comandos disponíveis.";
    }
}

// Consulta as falhas que esgotaram as tentativas.
export function listarFalhasEsgotadas() {
    return [...falhasEsgotadas];
}