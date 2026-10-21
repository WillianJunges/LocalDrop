export type TipoFalha = 'pin' | 'bloqueado' | 'recusado' | 'rede' | 'cancelado' | 'servidor';

export type ResultadoEnvio = { ok: true; nome: string } | { ok: false; tipo: TipoFalha; motivo: string };

export interface EnvioEmAndamento {
  resultado: Promise<ResultadoEnvio>;
  cancelar: () => void;
}

interface RespostaServidor {
  ok?: boolean;
  nome?: string;
  motivo?: string;
}

function tipoPorStatus(status: number): TipoFalha {
  if (status === 401) return 'pin';
  if (status === 429) return 'bloqueado';
  if (status === 0) return 'rede';
  if (status >= 500) return 'servidor';
  return 'recusado';
}

const MENSAGEM_REDE = 'A conexão com o computador caiu. Confira se o celular continua no mesmo Wi-Fi.';

/** Confere o PIN sem enviar arquivo (POST /api/pin). */
export async function conferirPin(pin: string): Promise<ResultadoEnvio> {
  try {
    const resposta = await fetch('/api/pin', { method: 'POST', headers: { 'X-LocalDrop-Pin': pin } });
    if (resposta.ok) return { ok: true, nome: '' };
    const corpo = (await resposta.json().catch(() => ({}))) as RespostaServidor;
    return { ok: false, tipo: tipoPorStatus(resposta.status), motivo: corpo.motivo ?? 'PIN não confirmado.' };
  } catch {
    return { ok: false, tipo: 'rede', motivo: MENSAGEM_REDE };
  }
}

/**
 * Envia um arquivo com XMLHttpRequest: diferente do fetch, ele informa o
 * progresso do upload, que é o que alimenta a barra.
 */
export function enviarArquivo(arquivo: File, pin: string, aoProgredir: (bytesEnviados: number) => void): EnvioEmAndamento {
  const xhr = new XMLHttpRequest();

  const resultado = new Promise<ResultadoEnvio>((resolve) => {
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('X-LocalDrop-Pin', pin);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (evento) => {
      if (!evento.lengthComputable || evento.total === 0) return;
      // O total inclui os cabeçalhos do multipart; converte para bytes do arquivo.
      aoProgredir(Math.min(arquivo.size, Math.round((evento.loaded / evento.total) * arquivo.size)));
    };

    xhr.onload = () => {
      const corpo = xhr.response as RespostaServidor | null;
      if (xhr.status === 201 && corpo?.ok && corpo.nome) {
        resolve({ ok: true, nome: corpo.nome });
        return;
      }
      resolve({
        ok: false,
        tipo: tipoPorStatus(xhr.status),
        motivo: corpo?.motivo ?? 'O computador não conseguiu salvar o arquivo.',
      });
    };
    xhr.onerror = () => resolve({ ok: false, tipo: 'rede', motivo: MENSAGEM_REDE });
    xhr.onabort = () => resolve({ ok: false, tipo: 'cancelado', motivo: 'Envio cancelado.' });

    const corpo = new FormData();
    corpo.append('arquivo', arquivo);
    xhr.send(corpo);
  });

  return { resultado, cancelar: () => xhr.abort() };
}
