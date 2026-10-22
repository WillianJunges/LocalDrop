import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { cabecalhosSeguranca, exigirPaginaDoLocalDrop } from './cabecalhos.js';
import { somenteNoPc } from './loopback.js';
import { exigirPin } from './pin.js';
import { abrirPasta as abrirPastaNoWindows } from './sistema.js';
import { ControleTentativas } from './tentativas.js';
import { LIMITES_PADRAO } from './tipos.js';
import { criarRotaUpload, type OpcoesUpload } from './upload.js';

export interface InfoSessao {
  pin: string;
  porta: number;
  ip: string | null;
  interfaceNome: string | null;
}

export interface OpcoesApp {
  sessao: InfoSessao;
  pastaClient: string;
  pastaRecebidos: string;
  /** Limites por categoria e, nos testes, tempo de inatividade etc. */
  upload?: Omit<OpcoesUpload, 'pasta'>;
  /** Trocado nos testes para não abrir o Explorer de verdade. */
  abrirPasta?: (pasta: string) => boolean;
}

export function criarApp({ sessao, pastaClient, pastaRecebidos, upload, abrirPasta = abrirPastaNoWindows }: OpcoesApp) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cabecalhosSeguranca);

  const limites = upload?.limites ?? LIMITES_PADRAO;

  app.get('/api/sessao', somenteNoPc, (_req, res) => {
    const enderecoCelular = sessao.ip ? `http://${sessao.ip}:${sessao.porta}` : null;
    res.json({
      pin: sessao.pin,
      enderecoCelular,
      // O PIN vai no fragmento (#): o navegador não envia essa parte ao servidor.
      urlQrCode: enderecoCelular ? `${enderecoCelular}/#pin=${sessao.pin}` : null,
      interfaceNome: sessao.interfaceNome,
      pasta: pastaRecebidos,
    });
  });

  app.post('/api/abrir-pasta', somenteNoPc, exigirPaginaDoLocalDrop, (_req, res) => {
    if (abrirPasta(pastaRecebidos)) {
      res.json({ ok: true });
    } else {
      res.status(501).json({ erro: 'Abrir a pasta só funciona no Windows.' });
    }
  });

  // A mesma contagem de PINs errados vale para as duas rotas.
  const pinObrigatorio = exigirPin(sessao.pin, new ControleTentativas());

  // Checagem rápida, sem arquivo: o celular confirma o PIN antes de começar um envio grande
  // e recebe os limites configurados, para avisar já na seleção.
  app.post('/api/pin', pinObrigatorio, (_req, res) => {
    res.json({ ok: true, limites });
  });
  app.post('/api/upload', pinObrigatorio, criarRotaUpload({ ...upload, pasta: pastaRecebidos }));

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
