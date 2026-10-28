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

//Aapenas registra o evento.
async function processarEvento(evento) {
    console.log("Processando evento:", evento);
}

// Consulta as falhas que esgotaram as tentativas.
export function listarFalhasEsgotadas() {
    return [...falhasEsgotadas];
}