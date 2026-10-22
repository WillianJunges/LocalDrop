import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type Categoria, EXTENSOES_ACEITAS, LIMITES_PADRAO } from './tipos.js';

export const PORTA_PADRAO = 8787;

// server/src e server/dist ficam dois níveis abaixo da raiz do projeto,
// então o caminho funciona tanto em dev (tsx) quanto no build.
export const RAIZ_PROJETO = path.resolve(import.meta.dirname, '..', '..');
export const ARQUIVO_CONFIG = path.join(RAIZ_PROJETO, 'localdrop.json');

const MB = 1024 ** 2;
// Teto para um limite configurado: protege contra um zero a mais por engano.
const LIMITE_MAXIMO_MB = 50 * 1024;
const CATEGORIAS = new Set<string>(Object.values(EXTENSOES_ACEITAS));
const CHAVES_ACEITAS = new Set(['porta', 'pasta', 'limitesMB']);

export interface Config {
  porta: number;
  pastaRecebidos: string;
  pastaClient: string;
  limites: Readonly<Record<Categoria, number>>;
}

/**
 * Ordem de prioridade: variáveis de ambiente > localdrop.json > padrões.
 * O arquivo é opcional; se existir, é validado e qualquer erro impede a inicialização
 * (melhor parar com uma mensagem clara do que rodar com um valor inesperado).
 */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env, arquivo = ARQUIVO_CONFIG): Config {
  const doArquivo = existsSync(arquivo) ? lerArquivoConfig(arquivo) : {};

  const pastaArquivo = doArquivo.pasta ? path.resolve(RAIZ_PROJETO, doArquivo.pasta) : undefined;
  const portaEnv = env.LOCALDROP_PORTA?.trim();

  return {
    porta: portaEnv ? lerPorta(portaEnv, 'LOCALDROP_PORTA') : (doArquivo.porta ?? PORTA_PADRAO),
    pastaRecebidos: path.resolve(env.LOCALDROP_DIR || pastaArquivo || path.join(RAIZ_PROJETO, 'recebidos')),
    pastaClient: path.join(RAIZ_PROJETO, 'client', 'dist'),
    limites: { ...LIMITES_PADRAO, ...doArquivo.limites },
  };
}

interface ConfigArquivo {
  porta?: number;
  pasta?: string;
  limites?: Partial<Record<Categoria, number>>;
}

function lerArquivoConfig(arquivo: string): ConfigArquivo {
  let conteudo: unknown;
  try {
    conteudo = JSON.parse(readFileSync(arquivo, 'utf8'));
  } catch (erro) {
    throw new Error(`localdrop.json não é um JSON válido: ${(erro as Error).message}`);
  }
  return validarConfigArquivo(conteudo);
}

export function validarConfigArquivo(conteudo: unknown): ConfigArquivo {
  if (typeof conteudo !== 'object' || conteudo === null || Array.isArray(conteudo)) {
    throw new Error('localdrop.json precisa ser um objeto, por exemplo { "porta": 8787 }.');
  }
  const dados = conteudo as Record<string, unknown>;
  for (const chave of Object.keys(dados)) {
    if (!CHAVES_ACEITAS.has(chave)) {
      throw new Error(`localdrop.json: opção desconhecida "${chave}". Use: ${[...CHAVES_ACEITAS].join(', ')}.`);
    }
  }

  const config: ConfigArquivo = {};
  if (dados.porta !== undefined) config.porta = lerPorta(dados.porta, 'localdrop.json: "porta"');

  if (dados.pasta !== undefined) {
    if (typeof dados.pasta !== 'string' || dados.pasta.trim() === '') {
      throw new Error('localdrop.json: "pasta" precisa ser um caminho, por exemplo "recebidos".');
    }
    config.pasta = dados.pasta;
  }

  if (dados.limitesMB !== undefined) {
    const limites = dados.limitesMB;
    if (typeof limites !== 'object' || limites === null || Array.isArray(limites)) {
      throw new Error('localdrop.json: "limitesMB" precisa ser um objeto, por exemplo { "video": 8192 }.');
    }
    config.limites = {};
    for (const [categoria, valor] of Object.entries(limites)) {
      if (!CATEGORIAS.has(categoria)) {
        throw new Error(
          `localdrop.json: categoria desconhecida em "limitesMB": "${categoria}". Use: ${[...CATEGORIAS].join(', ')}.`,
        );
      }
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > LIMITE_MAXIMO_MB) {
        throw new Error(
          `localdrop.json: limite de "${categoria}" precisa ser um número de MB entre 1 e ${LIMITE_MAXIMO_MB}.`,
        );
      }
      config.limites[categoria as Categoria] = Math.round(valor * MB);
    }
  }
  return config;
}

export function lerPorta(valor: unknown, origem = 'LOCALDROP_PORTA'): number {
  const porta = typeof valor === 'string' ? Number(valor) : valor;
  if (typeof porta !== 'number' || !Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error(`${origem} inválida: "${String(valor)}". Use um número entre 1 e 65535.`);
  }
  return porta;
}
