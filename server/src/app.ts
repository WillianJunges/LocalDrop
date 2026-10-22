import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { Atividade } from './atividade.js';
import { cabecalhosSeguranca, exigirPaginaDoLocalDrop } from './cabecalhos.js';
import { somenteNoPc } from './loopback.js';
import { exigirPin } from './pin.js';
import { MonitorPresenca } from './presenca.js';
import { CaixaDeSaida } from './saida.js';
import { segredoConfere } from './sessao.js';
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

export interface OpcoesTelaPc {
  /** Segredo das abas da tela do PC (vem de /api/sessao, que só responde no próprio PC). */
  chave: string;
  presenca: MonitorPresenca;
  aoEncerrar: () => void;
}

export interface OpcoesApp {
  sessao: InfoSessao;
  pastaClient: string;
  pastaRecebidos: string;
  /** Limites por categoria e, nos testes, tempo de inatividade etc. */
  upload?: Omit<OpcoesUpload, 'pasta' | 'atividade' | 'aoSalvar' | 'marcarDaInternet'>;
  /** Trocado nos testes para não abrir o Explorer de verdade. */
  abrirPasta?: (pasta: string) => boolean;
  /** Arquivos que o PC deixou para o celular baixar. */
  saida?: CaixaDeSaida;
  /** Transferências em andamento (o LocalDrop não fecha durante). */
  atividade?: Atividade;
  pc?: OpcoesTelaPc;
  /** Identifica o build (versao.ts); o atalho compara para substituir uma versão antiga aberta. */
  versao?: string;
}

export function criarApp(opcoes: OpcoesApp) {
  const { sessao, pastaClient, pastaRecebidos, upload, abrirPasta = abrirPastaNoWindows } = opcoes;
  const atividade = opcoes.atividade ?? new Atividade();
  const saida = opcoes.saida ?? new CaixaDeSaida(path.join(tmpdir(), `localdrop-saida-${randomUUID()}`));
  const pc = opcoes.pc ?? {
    chave: randomBytes(32).toString('hex'),
    presenca: new MonitorPresenca({ ocupado: () => atividade.emAndamento > 0, aoFecharTudo: () => {} }),
    aoEncerrar: () => {},
  };
  const limites = upload?.limites ?? LIMITES_PADRAO;

  const app = express();
  app.disable('x-powered-by');
  app.use(cabecalhosSeguranca);

  // ---- Tela do PC (só no próprio computador) ----

  app.get('/api/sessao', somenteNoPc, (_req, res) => {
    const enderecoCelular = sessao.ip ? `http://${sessao.ip}:${sessao.porta}` : null;
    res.json({
      pin: sessao.pin,
      enderecoCelular,
      // O PIN vai no fragmento (#): o navegador não envia essa parte ao servidor.
      urlQrCode: enderecoCelular ? `${enderecoCelular}/#pin=${sessao.pin}` : null,
      interfaceNome: sessao.interfaceNome,
      pasta: pastaRecebidos,
      chavePc: pc.chave,
      limites,
      versao: opcoes.versao ?? 'dev',
      transferencias: atividade.emAndamento,
    });
  });

  app.post('/api/abrir-pasta', somenteNoPc, exigirPaginaDoLocalDrop, (_req, res) => {
    if (abrirPasta(pastaRecebidos)) {
      res.json({ ok: true });
    } else {
      res.status(501).json({ erro: 'Abrir a pasta só funciona no Windows.' });
    }
  });

  // Sinal de vida das abas do PC. Aceita texto puro porque, ao fechar a aba, o aviso vai por
  // navigator.sendBeacon, que não manda headers customizados; a chave no corpo faz esse papel.
  app.post('/api/pc/presenca', somenteNoPc, express.text({ type: () => true, limit: '1kb' }), (req, res) => {
    let dados: { aba?: unknown; chave?: unknown; fechou?: unknown } = {};
    try {
      dados = JSON.parse(typeof req.body === 'string' ? req.body : '') as typeof dados;
    } catch {
      // corpo inválido: cai na recusa abaixo
    }
    const { aba, chave, fechou } = dados;
    if (typeof aba !== 'string' || aba.length === 0 || aba.length > 64 || !segredoConfere(pc.chave, chave)) {
      res.status(403).json({ erro: 'Requisição não permitida.' });
      return;
    }
    if (fechou === true) pc.presenca.fechou(aba);
    else pc.presenca.sinal(aba);
    res.json({ ok: true, transferencias: atividade.emAndamento });
  });

  app.post('/api/encerrar', somenteNoPc, exigirPaginaDoLocalDrop, (_req, res) => {
    res.on('finish', () => pc.aoEncerrar());
    res.json({ ok: true });
  });

  // ---- PC para o celular ----

  const rotaSaida = criarRotaUpload({
    ...upload,
    pasta: saida.pasta,
    atividade,
    marcarDaInternet: false,
    aoSalvar: (salvo) => ({ id: saida.adicionar(salvo.caminho, salvo.nome, salvo.tamanho).id }),
  });
  app.post(
    '/api/saida',
    somenteNoPc,
    exigirPaginaDoLocalDrop,
    async (_req, _res, next) => {
      await mkdir(saida.pasta, { recursive: true });
      next();
    },
    rotaSaida,
  );

  app.get('/api/saida', somenteNoPc, (_req, res) => {
    res.json({
      arquivos: saida.listar().map(({ id, nome, tamanho, downloads }) => ({ id, nome, tamanho, downloads })),
    });
  });

  app.delete('/api/saida/:id', somenteNoPc, exigirPaginaDoLocalDrop, async (req, res) => {
    const removido = await saida.remover(String(req.params.id));
    res.status(removido ? 200 : 404).json({ ok: removido });
  });

  // ---- Celular ----

  // A mesma contagem de PINs errados vale para todas as rotas do celular.
  const pinObrigatorio = exigirPin(sessao.pin, new ControleTentativas());

  // Checagem rápida, sem arquivo: o celular confirma o PIN antes de começar um envio grande
  // e recebe os limites configurados, para avisar já na seleção.
  app.post('/api/pin', pinObrigatorio, (_req, res) => {
    res.json({ ok: true, limites });
  });
  app.post('/api/upload', pinObrigatorio, criarRotaUpload({ ...upload, pasta: pastaRecebidos, atividade }));

  app.get('/api/disponiveis', pinObrigatorio, (_req, res) => {
    res.json({
      arquivos: saida.listar().map(({ id, nome, tamanho, token }) => ({
        id,
        nome,
        tamanho,
        // Um link de download não consegue mandar o header do PIN; o código no link substitui.
        url: `/api/baixar/${id}?t=${token}`,
      })),
    });
  });

  // O celular desistiu de receber: tira o arquivo da caixa de saída (some também da tela do PC).
  app.delete('/api/disponiveis/:id', pinObrigatorio, async (req, res) => {
    const removido = await saida.remover(String(req.params.id));
    res.status(removido ? 200 : 404).json({ ok: removido });
  });

  app.get('/api/baixar/:id', (req, res) => {
    const token = typeof req.query.t === 'string' ? req.query.t : '';
    const item = saida.buscar(String(req.params.id), token);
    if (!item) {
      res.status(404).json({ erro: 'Arquivo não encontrado. Ele pode ter sido removido no computador.' });
      return;
    }

    const fimAtividade = atividade.iniciar();
    res.on('close', fimAtividade);
    res.set('Cache-Control', 'no-store');
    // res.download manda como anexo (com nome em UTF-8) e aceita retomar downloads (Range).
    res.download(item.caminho, item.nome, (erro) => {
      if (erro) {
        if (!res.headersSent) res.status(404).json({ erro: 'Arquivo não encontrado.' });
        return;
      }
      // Pedaços de um download retomado não contam como um download novo.
      if (!req.headers.range) saida.registrarDownload(item.id);
    });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
  });

  // ---- Páginas ----

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
