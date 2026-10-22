// Mesmas regras do servidor (arquivo único, sem cópia). O servidor continua validando de verdade;
// aqui é só para avisar o usuário antes de gastar tempo enviando.
import {
  type Categoria,
  categoriaDe,
  EXTENSOES_ACEITAS,
  extensaoDe,
  formatarBytes,
  LIMITES_PADRAO,
  nomeCategoria,
} from '../../../server/src/tipos';

export { type Categoria, formatarBytes, LIMITES_PADRAO };

export type Limites = Readonly<Record<Categoria, number>>;

/** Botão "Arquivos": abre o gerenciador de arquivos já filtrado pela lista branca. */
export const ACEITOS_ARQUIVOS = Object.keys(EXTENSOES_ACEITAS)
  .map((extensao) => `.${extensao}`)
  .join(',');

/** Botão "Fotos e vídeos": no Android abre a galeria, onde marcar vários é mais fácil. */
export const ACEITOS_GALERIA = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';

export interface Avaliacao {
  categoria: Categoria | null;
  /** Motivo para não enviar, ou null se pode enviar. */
  problema: string | null;
}

export function avaliarArquivo(nome: string, tamanho: number, limites: Limites = LIMITES_PADRAO): Avaliacao {
  const extensao = extensaoDe(nome);
  const categoria = categoriaDe(extensao);
  if (!categoria) {
    return { categoria: null, problema: `Tipo de arquivo não permitido${extensao ? ` (.${extensao})` : ''}.` };
  }
  if (tamanho === 0) return { categoria, problema: 'O arquivo está vazio.' };

  const limite = limites[categoria];
  if (tamanho > limite) {
    return { categoria, problema: `Maior que o limite de ${formatarBytes(limite)} para ${nomeCategoria(categoria)}.` };
  }
  return { categoria, problema: null };
}
