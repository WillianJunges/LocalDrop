import http from 'node:http';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';

// Tudo aqui usa node:http e não fetch: no Windows, process.exit() logo após um fetch
// derruba o Node com "Assertion failed ... async.c" (bug do Node).

export interface InstanciaAberta {
  /** null em versões antigas, que ainda não informavam a versão. */
  versao: string | null;
  transferencias: number;
}

function requisitar(porta: number, metodo: 'GET' | 'POST', caminho: string): Promise<{ status: number; corpo: string } | null> {
  return new Promise((resolve) => {
    const requisicao = http.request(
      {
        host: 'localhost',
        port: porta,
        method: metodo,
        path: caminho,
        timeout: 2000,
        agent: false,
        headers: { 'X-LocalDrop': '1' },
      },
      (resposta) => {
        let corpo = '';
        resposta.on('data', (parte: Buffer) => (corpo += parte.toString()));
        resposta.on('end', () => resolve({ status: resposta.statusCode ?? 0, corpo }));
      },
    );
    requisicao.on('timeout', () => requisicao.destroy());
    requisicao.on('error', () => resolve(null));
    requisicao.end();
  });
}

/** Se quem está na porta é um LocalDrop, devolve a versão dele; se é outro programa, null. */
export async function consultarInstancia(porta: number): Promise<InstanciaAberta | null> {
  const resposta = await requisitar(porta, 'GET', '/api/sessao');
  if (resposta?.status !== 200) return null;
  try {
    const dados = JSON.parse(resposta.corpo) as { pin?: unknown; versao?: unknown; transferencias?: unknown };
    if (typeof dados.pin !== 'string') return null;
    return {
      versao: typeof dados.versao === 'string' ? dados.versao : null,
      transferencias: typeof dados.transferencias === 'number' ? dados.transferencias : 0,
    };
  } catch {
    return null; // respondeu algo que não é JSON: é outro programa
  }
}

/** Pede para o LocalDrop aberto encerrar (o mesmo que o botão "Encerrar LocalDrop"). */
export async function pedirEncerramento(porta: number): Promise<boolean> {
  const resposta = await requisitar(porta, 'POST', '/api/encerrar');
  return resposta?.status === 200;
}

function portaEmUso(porta: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conexao = net.connect({ host: 'localhost', port: porta });
    conexao.once('connect', () => {
      conexao.destroy();
      resolve(true);
    });
    conexao.once('error', () => resolve(false));
  });
}

export async function esperarPortaLivre(porta: number, limiteMs: number): Promise<boolean> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (!(await portaEmUso(porta))) return true;
    await esperar(250);
  }
  return false;
}
