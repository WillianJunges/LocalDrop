import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ_PROJETO } from './config.js';

/**
 * Identifica o build atual (servidor + interface): muda sempre que o código é
 * recompilado com alguma alteração. O atalho usa para perceber que o LocalDrop
 * aberto é de uma versão antiga e precisa ser substituído.
 */
export function calcularVersao(raiz = RAIZ_PROJETO): string {
  const pastaServidor = path.join(raiz, 'server', 'dist');
  const arquivos = [
    ...(existsSync(pastaServidor)
      ? readdirSync(pastaServidor)
          .filter((nome) => nome.endsWith('.js'))
          .map((nome) => path.join(pastaServidor, nome))
      : []),
    // O index.html cita os arquivos do front pelo hash do conteúdo: muda quando o front muda.
    path.join(raiz, 'client', 'dist', 'index.html'),
  ].sort();

  const hash = createHash('sha256');
  for (const arquivo of arquivos) {
    if (!existsSync(arquivo)) continue;
    hash.update(path.relative(raiz, arquivo));
    hash.update(readFileSync(arquivo));
  }
  return hash.digest('hex').slice(0, 12);
}
