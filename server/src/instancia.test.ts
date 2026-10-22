import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { consultarInstancia, esperarPortaLivre, pedirEncerramento } from './instancia.js';

let servidor: http.Server | null = null;

afterEach(() => {
  servidor?.close();
  servidor = null;
});

/** Sobe um servidor falso numa porta livre e devolve a porta. */
async function servidorFalso(responder: http.RequestListener): Promise<number> {
  servidor = http.createServer(responder);
  await new Promise<void>((resolve) => servidor!.listen(0, 'localhost', resolve));
  return (servidor.address() as AddressInfo).port;
}

const json = (res: http.ServerResponse, status: number, corpo: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(corpo));
};

describe('consultarInstancia', () => {
  it('reconhece um LocalDrop e lê versão e transferências', async () => {
    const porta = await servidorFalso((_req, res) => json(res, 200, { pin: '123456', versao: 'abc123', transferencias: 2 }));
    expect(await consultarInstancia(porta)).toEqual({ versao: 'abc123', transferencias: 2 });
  });

  it('versão antiga, sem campo versao: devolve versao null', async () => {
    const porta = await servidorFalso((_req, res) => json(res, 200, { pin: '123456' }));
    expect(await consultarInstancia(porta)).toEqual({ versao: null, transferencias: 0 });
  });

  it.each([
    ['responde HTML', (_req: http.IncomingMessage, res: http.ServerResponse) => res.end('<html>')],
    ['responde 404', (_req: http.IncomingMessage, res: http.ServerResponse) => json(res, 404, {})],
    ['JSON sem PIN', (_req: http.IncomingMessage, res: http.ServerResponse) => json(res, 200, { nome: 'x' })],
  ])('outro programa que %s não é LocalDrop', async (_caso, responder) => {
    const porta = await servidorFalso(responder);
    expect(await consultarInstancia(porta)).toBeNull();
  });
});

describe('pedirEncerramento', () => {
  it('manda POST /api/encerrar com o header da página', async () => {
    let recebido: { metodo?: string; url?: string; header?: string } = {};
    const porta = await servidorFalso((req, res) => {
      recebido = { metodo: req.method, url: req.url, header: req.headers['x-localdrop'] as string };
      json(res, 200, { ok: true });
    });

    expect(await pedirEncerramento(porta)).toBe(true);
    expect(recebido).toEqual({ metodo: 'POST', url: '/api/encerrar', header: '1' });
  });

  it('versão sem a rota de encerrar: devolve false', async () => {
    const porta = await servidorFalso((_req, res) => json(res, 404, {}));
    expect(await pedirEncerramento(porta)).toBe(false);
  });
});

describe('esperarPortaLivre', () => {
  it('espera a porta liberar', async () => {
    const porta = await servidorFalso((_req, res) => res.end());
    setTimeout(() => servidor?.close(), 300);
    expect(await esperarPortaLivre(porta, 5000)).toBe(true);
  });

  it('desiste depois do limite', async () => {
    const porta = await servidorFalso((_req, res) => res.end());
    expect(await esperarPortaLivre(porta, 600)).toBe(false);
  });
});
