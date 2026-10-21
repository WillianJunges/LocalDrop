import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { somenteNoPc } from './loopback.js';

export interface InfoSessao {
  pin: string;
  porta: number;
  ip: string | null;
  interfaceNome: string | null;
}

export interface OpcoesApp {
  sessao: InfoSessao;
  pastaClient: string;
}

export function criarApp({ sessao, pastaClient }: OpcoesApp) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/sessao', somenteNoPc, (_req, res) => {
    const enderecoCelular = sessao.ip ? `http://${sessao.ip}:${sessao.porta}` : null;
    res.json({
      pin: sessao.pin,
      enderecoCelular,
      // O PIN vai no fragmento (#): o navegador não envia essa parte ao servidor.
      urlQrCode: enderecoCelular ? `${enderecoCelular}/#pin=${sessao.pin}` : null,
      interfaceNome: sessao.interfaceNome,
    });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
  });

  const indexHtml = path.join(pastaClient, 'index.html');
  const enviarInterface = (_req: Request, res: Response) => {
    if (!existsSync(indexHtml)) {
      res.status(503).type('text/plain; charset=utf-8').send('Interface não compilada. Rode "npm run build" e reinicie.');
      return;
    }
    res.sendFile(indexHtml);
  };

  app.use('/assets', express.static(path.join(pastaClient, 'assets'), { fallthrough: false, index: false }));
  app.get('/pc', somenteNoPc, enviarInterface);
  app.get('/', enviarInterface);

  app.use((_req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send('Página não encontrada.');
  });

  app.use(tratarErro);
  return app;
}

// Nunca devolve stack trace ou caminhos do PC para o cliente.
const tratarErro: ErrorRequestHandler = (erro: unknown, _req, res, _next) => {
  const status = typeof erro === 'object' && erro !== null && 'status' in erro ? Number(erro.status) : 500;
  if (status >= 500) console.error('[erro]', erro);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    erro: status === 404 ? 'Não encontrado.' : 'Erro interno no LocalDrop.',
  });
};
