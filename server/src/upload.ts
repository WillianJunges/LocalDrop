import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import type { Request, RequestHandler, Response } from 'express';
import { caminhoTemporario, espacoLivre, marcarComoDaInternet, mover } from './armazenamento.js';
import { reservarNomeLivre, sanitizarNome } from './nomes.js';
import { ehOffice, motivoOfficeInvalido } from './office.js';
import { pinConfere } from './sessao.js';
import { ControleTentativas } from './tentativas.js';
import { type Categoria, categoriaDe, extensaoDe, LIMITES_PADRAO } from './tipos.js';
import { criarFiscal, ErroUpload } from './validacao.js';

export interface OpcoesUpload {
  pin: string;
  pasta: string;
  limites?: Readonly<Record<Categoria, number>>;
  maxSimultaneos?: number;
  /** Tempo máximo sem receber nenhum byte antes de derrubar o envio. */
  inatividadeMs?: number;
  /** Espaço que sempre deve sobrar no disco, além do arquivo. */
  reservaDiscoBytes?: number;
  tentativas?: ControleTentativas;
}

export interface ArquivoSalvo {
  nome: string;
  tamanho: number;
}

// Cabeçalhos do multipart (boundary, nome do campo etc.) somam bem menos que isso.
const FOLGA_MULTIPART = 64 * 1024;

export function criarRotaUpload(opcoes: OpcoesUpload): RequestHandler {
  const limites = opcoes.limites ?? LIMITES_PADRAO;
  const maiorLimite = Math.max(...Object.values(limites));
  const maxSimultaneos = opcoes.maxSimultaneos ?? 3;
  const inatividadeMs = opcoes.inatividadeMs ?? 60_000;
  const reservaDisco = opcoes.reservaDiscoBytes ?? 100 * 1024 ** 2;
  const tentativas = opcoes.tentativas ?? new ControleTentativas();
  let ativos = 0;

  return async (req, res) => {
    const ip = req.socket.remoteAddress ?? 'desconhecido';

    const bloqueio = tentativas.bloqueadoPor(ip);
    if (bloqueio > 0) {
      responderErro(res, 429, `Muitas tentativas com PIN errado. Tente de novo em ${Math.ceil(bloqueio / 60_000)} min.`);
      return;
    }
    if (!pinConfere(opcoes.pin, req.get('x-localdrop-pin'))) {
      tentativas.registrarErro(ip);
      responderErro(res, 401, 'PIN incorreto. Confira o PIN na tela do computador.');
      return;
    }
    tentativas.limpar(ip);

    if (!req.is('multipart/form-data')) {
      responderErro(res, 400, 'Envio inválido.');
      return;
    }
    const tamanhoDeclarado = Number(req.get('content-length'));
    if (tamanhoDeclarado > maiorLimite + FOLGA_MULTIPART) {
      responderErro(res, 413, 'Arquivo grande demais.');
      return;
    }
    if (ativos >= maxSimultaneos) {
      responderErro(res, 503, 'Muitos envios ao mesmo tempo. Aguarde e tente de novo.');
      return;
    }

    ativos++;
    try {
      if (Number.isFinite(tamanhoDeclarado) && (await espacoLivre(opcoes.pasta)) < tamanhoDeclarado + reservaDisco) {
        throw new ErroUpload(507, 'Espaço insuficiente no disco do computador.');
      }
      // Sem limite de duração total (um vídeo grande demora), mas derruba conexão parada.
      req.setTimeout(inatividadeMs, () => req.destroy(new Error('Envio parado por inatividade.')));

      const salvo = await receberArquivo(req, opcoes.pasta, limites, maiorLimite);
      res.status(201).json({ ok: true, ...salvo });
    } catch (erro) {
      if (erro instanceof ErroUpload) {
        responderErro(res, erro.status, erro.message);
      } else {
        console.error('[upload]', erro);
        responderErro(res, 500, 'Não foi possível salvar o arquivo.');
      }
    } finally {
      ativos--;
    }
  };
}

/**
 * Se a resposta sai antes do corpo terminar de chegar (PIN errado, arquivo recusado),
 * a conexão é fechada em vez de reaproveitada, para não misturar com o resto do envio.
 */
function responderErro(res: Response, status: number, motivo: string): void {
  if (res.headersSent || res.destroyed) return;
  res.set('Connection', 'close').status(status).json({ ok: false, motivo });
}

function receberArquivo(
  req: Request,
  pasta: string,
  limites: Readonly<Record<Categoria, number>>,
  maiorLimite: number,
): Promise<ArquivoSalvo> {
  return new Promise((resolve, reject) => {
    let leitor: busboy.Busboy;
    try {
      leitor = busboy({
        headers: req.headers,
        defParamCharset: 'utf8', // nomes com acento e emoji
        limits: { files: 1, fields: 0, parts: 1, fileSize: maiorLimite + 1 },
      });
    } catch {
      reject(new ErroUpload(400, 'Envio inválido.'));
      return;
    }

    let arquivoAtual: Readable | null = null;

    leitor.once('file', (_campo, arquivo, info) => {
      arquivoAtual = arquivo;
      salvarArquivo(arquivo, info.filename ?? '', pasta, limites).then(resolve, reject);
    });
    leitor.on('error', () => {
      const erro = new ErroUpload(400, 'Envio inválido ou interrompido.');
      arquivoAtual?.destroy(erro);
      reject(erro);
    });
    leitor.on('close', () => {
      if (!arquivoAtual) reject(new ErroUpload(400, 'Nenhum arquivo foi enviado.'));
    });

    // Celular perdeu o Wi-Fi ou cancelou: encerra a gravação para o .part ser apagado.
    req.on('close', () => {
      if (!req.complete) arquivoAtual?.destroy(new ErroUpload(400, 'A conexão caiu durante o envio.'));
    });

    req.pipe(leitor);
  });
}

async function salvarArquivo(
  arquivo: Readable,
  nomeOriginal: string,
  pasta: string,
  limites: Readonly<Record<Categoria, number>>,
): Promise<ArquivoSalvo> {
  const nome = sanitizarNome(nomeOriginal);
  const extensao = extensaoDe(nome);
  const categoria = categoriaDe(extensao);
  if (!categoria) {
    arquivo.resume(); // descarta o conteúdo
    throw new ErroUpload(415, `Tipo de arquivo não permitido${extensao ? ` (.${extensao})` : ''}.`);
  }

  const temporario = caminhoTemporario(pasta);
  let reservado: string | null = null;
  try {
    const fiscal = criarFiscal(extensao, categoria, limites[categoria]);
    await pipeline(arquivo, fiscal.stream, createWriteStream(temporario, { flags: 'wx' }));

    if (ehOffice(extensao)) {
      const motivo = await motivoOfficeInvalido(temporario, extensao);
      if (motivo) throw new ErroUpload(415, motivo);
    }

    reservado = await reservarNomeLivre(pasta, nome);
    await mover(temporario, reservado);
    const final = reservado;
    reservado = null;
    await marcarComoDaInternet(final);

    return { nome: path.basename(final), tamanho: fiscal.totalBytes() };
  } catch (erro) {
    await rm(temporario, { force: true });
    if (reservado) await rm(reservado, { force: true });
    throw erro;
  }
}
