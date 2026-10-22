import { spawn } from 'node:child_process';

/**
 * Abre um caminho ou URL com o programa padrão do Windows (pasta no Explorer,
 * URL no navegador). O argumento vai direto para o explorer.exe, sem passar
 * por um shell, então não há como injetar comandos.
 */
function abrirNoWindows(alvo: string): boolean {
  if (process.platform !== 'win32') return false;
  const processo = spawn('explorer.exe', [alvo], { detached: true, stdio: 'ignore' });
  processo.on('error', (erro) => console.warn(`[aviso] Não foi possível abrir "${alvo}":`, erro.message));
  processo.unref();
  return true;
}

export const abrirPasta = (pasta: string) => abrirNoWindows(pasta);
export const abrirNavegador = (url: string) => abrirNoWindows(url);
