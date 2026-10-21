import { open } from 'node:fs/promises';
import path from 'node:path';

// Nomes que o Windows reserva para dispositivos, com ou sem extensão (CON, CON.txt...).
const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;
// Caracteres proibidos em nomes no Windows, mais caracteres de controle.
const PROIBIDOS = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
const TAMANHO_MAXIMO = 150;
const MAX_TENTATIVAS_NOME = 1000;

/**
 * Transforma o nome enviado pelo celular (dado não confiável) num nome seguro:
 * sem pastas, sem caracteres proibidos, sem nomes reservados e com tamanho limitado.
 */
export function sanitizarNome(original: string): string {
  // Fica só com a última parte: "../../x.jpg" e "C:\\x.jpg" viram "x.jpg".
  const semCaminho = original.split(/[/\\]/).pop() ?? '';
  const limpo = semCaminho
    .normalize('NFC')
    .replace(PROIBIDOS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '') // sem arquivos ocultos nem ".."
    .replace(/[. ]+$/, ''); // o Windows ignora ponto e espaço no final

  const ponto = limpo.lastIndexOf('.');
  let base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
  const extensao = ponto > 0 ? limpo.slice(ponto + 1) : '';

  if (!base) base = 'arquivo';
  if (RESERVADOS_WINDOWS.test(base.split('.')[0] ?? '')) base = `_${base}`;

  const espacoBase = TAMANHO_MAXIMO - (extensao ? extensao.length + 1 : 0);
  // Array.from corta por caractere, sem quebrar emojis no meio.
  base = Array.from(base).slice(0, Math.max(espacoBase, 1)).join('').trimEnd();

  return extensao ? `${base}.${extensao}` : base;
}

export function nomeComSufixo(nome: string, numero: number): string {
  const ponto = nome.lastIndexOf('.');
  return ponto > 0 ? `${nome.slice(0, ponto)} (${numero})${nome.slice(ponto)}` : `${nome} (${numero})`;
}

/**
 * Reserva um nome livre criando um arquivo vazio com a flag "wx" (falha se já existir).
 * É atômico: dois uploads com o mesmo nome ao mesmo tempo nunca pegam o mesmo arquivo.
 */
export async function reservarNomeLivre(pasta: string, nome: string): Promise<string> {
  for (let n = 0; n < MAX_TENTATIVAS_NOME; n++) {
    const caminho = caminhoDentroDe(pasta, n === 0 ? nome : nomeComSufixo(nome, n));
    try {
      const arquivo = await open(caminho, 'wx');
      await arquivo.close();
      return caminho;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'EEXIST') throw erro;
    }
  }
  throw new Error(`Sem nome livre para "${nome}" após ${MAX_TENTATIVAS_NOME} tentativas.`);
}

/** Segunda barreira contra path traversal: o caminho final precisa estar dentro da pasta. */
export function caminhoDentroDe(pasta: string, nome: string): string {
  const caminho = path.resolve(pasta, nome);
  const relativo = path.relative(path.resolve(pasta), caminho);
  if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) {
    throw new Error(`Nome de arquivo fora da pasta de destino: "${nome}"`);
  }
  return caminho;
}
