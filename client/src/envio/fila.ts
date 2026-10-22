import { avaliarArquivo, type Categoria, type Limites } from './regras';

/**
 * pronto: aguardando envio · enviando: em andamento
 * falhou: pode tentar de novo (rede, cancelado, erro no PC) · recusado: não adianta reenviar
 */
export type StatusItem = 'pronto' | 'enviando' | 'falhou' | 'recusado';

export interface Item {
  id: number;
  arquivo: File;
  categoria: Categoria | null;
  status: StatusItem;
  bytesEnviados: number;
  motivo: string | null;
}

export interface Enviado {
  id: number;
  nomeOriginal: string;
  nomeSalvo: string;
  tamanho: number;
}

export interface EstadoFila {
  itens: Item[];
  /** Enviados com sucesso saem da lista e ficam só neste resumo. */
  enviados: Enviado[];
  proximoId: number;
}

export type Acao =
  | { tipo: 'adicionar'; arquivos: File[]; limites?: Limites }
  | { tipo: 'remover'; id: number }
  | { tipo: 'removerRecusados' }
  | { tipo: 'iniciar'; id: number }
  | { tipo: 'progresso'; id: number; bytesEnviados: number }
  | { tipo: 'concluir'; id: number; nomeSalvo: string }
  | { tipo: 'falhar'; id: number; motivo: string; definitivo: boolean }
  | { tipo: 'devolver'; id: number }
  | { tipo: 'limparEnviados' };

export const FILA_VAZIA: EstadoFila = { itens: [], enviados: [], proximoId: 1 };

const mesmoArquivo = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function atualizar(estado: EstadoFila, id: number, mudanca: Partial<Item>): EstadoFila {
  return { ...estado, itens: estado.itens.map((item) => (item.id === id ? { ...item, ...mudanca } : item)) };
}

export function reduzirFila(estado: EstadoFila, acao: Acao): EstadoFila {
  switch (acao.tipo) {
    case 'adicionar': {
      let proximoId = estado.proximoId;
      const novos: Item[] = [];
      for (const arquivo of acao.arquivos) {
        // Escolher a mesma foto duas vezes não duplica a lista.
        if ([...estado.itens, ...novos].some((item) => mesmoArquivo(item.arquivo, arquivo))) continue;
        const { categoria, problema } = avaliarArquivo(arquivo.name, arquivo.size, acao.limites);
        novos.push({
          id: proximoId++,
          arquivo,
          categoria,
          status: problema ? 'recusado' : 'pronto',
          bytesEnviados: 0,
          motivo: problema,
        });
      }
      return { ...estado, itens: [...estado.itens, ...novos], proximoId };
    }

    case 'remover':
      return {
        ...estado,
        itens: estado.itens.filter((item) => item.id !== acao.id || item.status === 'enviando'),
      };

    case 'removerRecusados':
      return { ...estado, itens: estado.itens.filter((item) => item.status !== 'recusado') };

    case 'iniciar':
      return atualizar(estado, acao.id, { status: 'enviando', bytesEnviados: 0, motivo: null });

    case 'progresso':
      return atualizar(estado, acao.id, { bytesEnviados: acao.bytesEnviados });

    case 'concluir': {
      const item = estado.itens.find((i) => i.id === acao.id);
      if (!item) return estado;
      return {
        ...estado,
        itens: estado.itens.filter((i) => i.id !== acao.id),
        enviados: [
          ...estado.enviados,
          { id: item.id, nomeOriginal: item.arquivo.name, nomeSalvo: acao.nomeSalvo, tamanho: item.arquivo.size },
        ],
      };
    }

    case 'falhar':
      return atualizar(estado, acao.id, {
        status: acao.definitivo ? 'recusado' : 'falhou',
        bytesEnviados: 0,
        motivo: acao.motivo,
      });

    case 'devolver':
      return atualizar(estado, acao.id, { status: 'pronto', bytesEnviados: 0 });

    case 'limparEnviados':
      return { ...estado, enviados: [] };
  }
}

/** O que o botão principal vai enviar: pendentes e os que falharam por motivo temporário. */
export function itensParaEnviar(estado: EstadoFila): Item[] {
  return estado.itens.filter((item) => item.status === 'pronto' || item.status === 'falhou');
}
