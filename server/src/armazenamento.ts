import { randomUUID } from 'node:crypto';
import { readdir, rename, rm, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

const PREFIXO_TEMPORARIO = '.localdrop-';
const SUFIXO_TEMPORARIO = '.part';

/** Arquivo temporário na própria pasta de destino, para o rename final ser instantâneo. */
export function caminhoTemporario(pasta: string): string {
  return path.join(pasta, `${PREFIXO_TEMPORARIO}${randomUUID()}${SUFIXO_TEMPORARIO}`);
}

/** Apaga .part que sobraram se o LocalDrop foi fechado no meio de um envio. */
export async function limparTemporarios(pasta: string): Promise<number> {
  const sobras = (await readdir(pasta)).filter(
    (nome) => nome.startsWith(PREFIXO_TEMPORARIO) && nome.endsWith(SUFIXO_TEMPORARIO),
  );
  await Promise.all(sobras.map((nome) => rm(path.join(pasta, nome), { force: true })));
  return sobras.length;
}

export async function espacoLivre(pasta: string): Promise<number> {
  const info = await statfs(pasta);
  return info.bavail * info.bsize;
}

/**
 * No Windows, o antivírus pode segurar um arquivo recém-criado por alguns
 * milissegundos (EPERM/EBUSY). Tenta de novo algumas vezes antes de desistir.
 */
export async function mover(origem: string, destino: string, tentativas = 5): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await rename(origem, destino);
      return;
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException).code;
      if (i >= tentativas || (codigo !== 'EPERM' && codigo !== 'EBUSY')) throw erro;
      await esperar(100 * i);
    }
  }
}

/**
 * Grava a marca "baixado da internet" (Zone.Identifier), como o navegador faz.
 * Assim o Word abre em Modo Protegido e o Windows avisa antes de abrir algo suspeito.
 */
export async function marcarComoDaInternet(caminho: string): Promise<void> {
  if (process.platform !== 'win32') return;
  try {
    await writeFile(`${caminho}:Zone.Identifier`, '[ZoneTransfer]\r\nZoneId=3\r\n');
  } catch (erro) {
    // Pendrives em FAT32/exFAT não suportam essa marca; o arquivo continua salvo.
    console.warn(`[aviso] Não foi possível marcar "${path.basename(caminho)}":`, (erro as Error).message);
  }
}
