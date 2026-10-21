import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { conferirPin, enviarArquivo } from './api';
import { type Acao, FILA_VAZIA, itensParaEnviar, reduzirFila } from './fila';
import { MedidorVelocidade, tempoRestante } from './medidor';

export interface Lote {
  totalArquivos: number;
  /** Posição do arquivo atual (1 = primeiro). */
  posicao: number;
  totalBytes: number;
  bytesEnviados: number;
  bytesPorSegundo: number | null;
  segundosRestantes: number | null;
}

export interface Aviso {
  tipo: 'ok' | 'alerta' | 'erro';
  texto: string;
  /** Erro de PIN: a página destaca o campo. */
  doPin?: boolean;
}

export function useFilaEnvio(pin: string) {
  const [estado, despacharBruto] = useReducer(reduzirFila, FILA_VAZIA);
  const [lote, setLote] = useState<Lote | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [telaTravadaLigada, setTelaTravadaLigada] = useState(false);

  // O laço de envio é assíncrono: lê o estado atual por ref, não pelo valor capturado.
  const estadoRef = useRef(estado);
  const cancelarAtual = useRef<(() => void) | null>(null);
  const parar = useRef(false);
  const medidor = useRef(new MedidorVelocidade());

  const despachar = useCallback((acao: Acao) => {
    estadoRef.current = reduzirFila(estadoRef.current, acao);
    despacharBruto(acao);
  }, []);

  const enviando = lote !== null;

  const enviarTodos = useCallback(async () => {
    if (lote) return;
    const itens = itensParaEnviar(estadoRef.current);
    if (itens.length === 0) return;

    setAviso(null);
    const conferencia = await conferirPin(pin);
    if (!conferencia.ok) {
      setAviso({ tipo: 'erro', texto: conferencia.motivo, doPin: conferencia.tipo === 'pin' });
      return;
    }

    parar.current = false;
    medidor.current.reiniciar();
    const totalBytes = itens.reduce((soma, item) => soma + item.arquivo.size, 0);
    let bytesConcluidos = 0;
    let sucessos = 0;
    let falhas = 0;
    let erroGeral: Aviso | null = null;

    setLote({
      totalArquivos: itens.length,
      posicao: 1,
      totalBytes,
      bytesEnviados: 0,
      bytesPorSegundo: null,
      segundosRestantes: null,
    });

    for (const [indice, item] of itens.entries()) {
      if (parar.current) break;
      despachar({ tipo: 'iniciar', id: item.id });

      const envio = enviarArquivo(item.arquivo, pin, (bytes) => {
        despachar({ tipo: 'progresso', id: item.id, bytesEnviados: bytes });
        const enviadosNoLote = bytesConcluidos + bytes;
        medidor.current.registrar(performance.now(), enviadosNoLote);
        const velocidade = medidor.current.bytesPorSegundo();
        setLote((atual) =>
          atual && {
            ...atual,
            posicao: indice + 1,
            bytesEnviados: enviadosNoLote,
            bytesPorSegundo: velocidade,
            segundosRestantes: tempoRestante(totalBytes - enviadosNoLote, velocidade),
          },
        );
      });
      cancelarAtual.current = envio.cancelar;
      const resultado = await envio.resultado;
      cancelarAtual.current = null;
      bytesConcluidos += item.arquivo.size;

      if (resultado.ok) {
        despachar({ tipo: 'concluir', id: item.id, nomeSalvo: resultado.nome });
        sucessos++;
      } else if (resultado.tipo === 'cancelado') {
        despachar({ tipo: 'devolver', id: item.id });
        break;
      } else if (resultado.tipo === 'pin' || resultado.tipo === 'bloqueado') {
        despachar({ tipo: 'devolver', id: item.id });
        erroGeral = { tipo: 'erro', texto: resultado.motivo, doPin: resultado.tipo === 'pin' };
        break;
      } else if (resultado.tipo === 'rede') {
        // Sem Wi-Fi os próximos falhariam também: para e deixa o usuário tentar de novo.
        despachar({ tipo: 'falhar', id: item.id, motivo: resultado.motivo, definitivo: false });
        falhas++;
        erroGeral = { tipo: 'erro', texto: `${resultado.motivo} Depois, toque em "Tentar de novo".` };
        break;
      } else {
        despachar({
          tipo: 'falhar',
          id: item.id,
          motivo: resultado.motivo,
          definitivo: resultado.tipo === 'recusado',
        });
        falhas++;
      }
    }

    setLote(null);
    if (erroGeral) {
      setAviso(erroGeral);
    } else if (parar.current) {
      setAviso({ tipo: 'erro', texto: 'Envio cancelado. Os arquivos que faltaram continuam na lista.' });
    } else if (sucessos > 0) {
      const texto = `${sucessos} ${sucessos === 1 ? 'arquivo enviado' : 'arquivos enviados'}`;
      setAviso({
        tipo: falhas > 0 ? 'alerta' : 'ok',
        texto: falhas > 0 ? `${texto}, ${falhas} com problema (veja abaixo).` : `Pronto! ${texto}.`,
      });
    } else if (falhas > 0) {
      setAviso({ tipo: 'erro', texto: 'Nenhum arquivo foi enviado. Veja os motivos abaixo.' });
    }
  }, [despachar, lote, pin]);

  const cancelar = useCallback(() => {
    parar.current = true;
    cancelarAtual.current?.();
  }, []);

  // Durante o envio: tenta manter a tela ligada e avisa antes de fechar a página.
  useEffect(() => {
    if (!enviando) return;
    let trava: WakeLockSentinel | null = null;

    // A Wake Lock API só existe em HTTPS. Pela rede local (HTTP) ela não está disponível,
    // então a página mostra o aviso "mantenha a tela ligada".
    if (window.isSecureContext && 'wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((t) => {
          trava = t;
          setTelaTravadaLigada(true);
        })
        .catch(() => setTelaTravadaLigada(false));
    }

    const avisarAoSair = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisarAoSair);
    return () => {
      window.removeEventListener('beforeunload', avisarAoSair);
      void trava?.release();
      setTelaTravadaLigada(false);
    };
  }, [enviando]);

  return {
    itens: estado.itens,
    enviados: estado.enviados,
    paraEnviar: itensParaEnviar(estado),
    lote,
    aviso,
    telaTravadaLigada,
    adicionar: (arquivos: File[]) => despachar({ tipo: 'adicionar', arquivos }),
    remover: (id: number) => despachar({ tipo: 'remover', id }),
    removerRecusados: () => despachar({ tipo: 'removerRecusados' }),
    limparEnviados: () => despachar({ tipo: 'limparEnviados' }),
    fecharAviso: () => setAviso(null),
    enviarTodos,
    cancelar,
  };
}
