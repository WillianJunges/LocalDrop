import { Transform } from 'node:stream';
import { BYTES_ASSINATURA, confereAssinatura, exigeAssinatura } from './assinatura.js';
import { type Categoria, formatarBytes, nomeCategoria } from './tipos.js';

/** Erro com mensagem pronta para mostrar no celular. */
export class ErroUpload extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroUpload';
  }
}

const EXTENSOES_TEXTO = new Set(['txt', 'csv']);

/**
 * Texto (UTF-8 ou ANSI do Windows) não tem byte nulo nem caracteres de controle,
 * fora tab, quebras de linha e form feed. Binários quase sempre têm.
 */
export function pareceTexto(parte: Buffer): boolean {
  for (const byte of parte) {
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d) return false;
  }
  return true;
}

export interface Fiscal {
  stream: Transform;
  totalBytes: () => number;
}

/**
 * Fica no meio do caminho entre o upload e o disco: conta bytes, corta ao passar
 * do limite e confere o conteúdo, sem guardar o arquivo na memória.
 */
export function criarFiscal(extensao: string, categoria: Categoria, limiteBytes: number): Fiscal {
  let total = 0;
  let inicio = Buffer.alloc(0);
  let assinaturaConferida = !exigeAssinatura(extensao);
  const validarTexto = EXTENSOES_TEXTO.has(extensao);
  const conteudoInvalido = () => new ErroUpload(415, `O conteúdo do arquivo não corresponde a um .${extensao}.`);

  const stream = new Transform({
    transform(parte: Buffer, _codificacao, feito) {
      total += parte.length;
      if (total > limiteBytes) {
        feito(
          new ErroUpload(
            413,
            `Arquivo maior que o limite de ${formatarBytes(limiteBytes)} para ${nomeCategoria(categoria)}.`,
          ),
        );
        return;
      }

      if (!assinaturaConferida) {
        inicio = Buffer.concat([inicio, parte]).subarray(0, BYTES_ASSINATURA);
        if (inicio.length >= BYTES_ASSINATURA) {
          if (!confereAssinatura(extensao, inicio)) {
            feito(conteudoInvalido());
            return;
          }
          assinaturaConferida = true;
        }
      }

      if (validarTexto && !pareceTexto(parte)) {
        feito(conteudoInvalido());
        return;
      }

      feito(null, parte);
    },

    flush(feito) {
      if (total === 0) {
        feito(new ErroUpload(400, 'O arquivo está vazio.'));
        return;
      }
      // Arquivo menor que BYTES_ASSINATURA: confere com o que chegou.
      if (!assinaturaConferida && !confereAssinatura(extensao, inicio)) {
        feito(conteudoInvalido());
        return;
      }
      feito();
    },
  });

  return { stream, totalBytes: () => total };
}
