export type Categoria = 'imagem' | 'documento' | 'audio' | 'video' | 'compactado';

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export const LIMITES_PADRAO: Readonly<Record<Categoria, number>> = {
  imagem: 50 * MB,
  documento: 50 * MB,
  audio: 200 * MB,
  video: 4 * GB,
  compactado: 2 * GB,
};

/** Lista branca: o que não está aqui é recusado. */
export const EXTENSOES_ACEITAS: Readonly<Record<string, Categoria>> = {
  jpg: 'imagem',
  jpeg: 'imagem',
  png: 'imagem',
  webp: 'imagem',
  gif: 'imagem',
  pdf: 'documento',
  docx: 'documento',
  xlsx: 'documento',
  pptx: 'documento',
  txt: 'documento',
  csv: 'documento',
  mp3: 'audio',
  m4a: 'audio',
  mp4: 'video',
  zip: 'compactado',
};

const NOMES_CATEGORIA: Readonly<Record<Categoria, string>> = {
  imagem: 'imagens',
  documento: 'documentos',
  audio: 'áudios',
  video: 'vídeos',
  compactado: 'arquivos zip',
};

/** Extensão em minúsculas, sem o ponto. Nome sem extensão (ou só ".algo") devolve ''. */
export function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : '';
}

export function categoriaDe(extensao: string): Categoria | null {
  // hasOwn evita que "constructor" ou "__proto__" sejam tratados como extensão.
  return Object.hasOwn(EXTENSOES_ACEITAS, extensao) ? (EXTENSOES_ACEITAS[extensao] ?? null) : null;
}

export function nomeCategoria(categoria: Categoria): string {
  return NOMES_CATEGORIA[categoria];
}

export function formatarBytes(bytes: number): string {
  if (bytes >= GB) return `${+(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${+(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${+(bytes / 1024).toFixed(1)} KB`;
  return bytes === 1 ? '1 byte' : `${bytes} bytes`;
}
