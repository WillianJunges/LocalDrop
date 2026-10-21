import path from 'node:path';

export const PORTA_PADRAO = 8787;

// server/src e server/dist ficam dois níveis abaixo da raiz do projeto,
// então o caminho funciona tanto em dev (tsx) quanto no build.
const RAIZ_PROJETO = path.resolve(import.meta.dirname, '..', '..');

export interface Config {
  porta: number;
  pastaRecebidos: string;
  pastaClient: string;
}

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    porta: lerPorta(env.LOCALDROP_PORTA),
    pastaRecebidos: path.resolve(env.LOCALDROP_DIR ?? path.join(RAIZ_PROJETO, 'recebidos')),
    pastaClient: path.join(RAIZ_PROJETO, 'client', 'dist'),
  };
}

export function lerPorta(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === '') return PORTA_PADRAO;

  const porta = Number(valor);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error(`LOCALDROP_PORTA inválida: "${valor}". Use um número entre 1 e 65535.`);
  }
  return porta;
}
