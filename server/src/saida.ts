import { randomBytes, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { segredoConfere } from './sessao.js';

export interface ItemSaida {
  id: string;
  nome: string;
  tamanho: number;
  caminho: string;
  /** Código do link de download. Só quem sabe o PIN recebe a lista com ele. */
  token: string;
  downloads: number;
}

/**
 * Arquivos que o PC deixou disponíveis para o celular baixar. Ficam numa pasta
 * temporária só do LocalDrop, apagada ao iniciar e ao encerrar.
 */
export class CaixaDeSaida {
  readonly pasta: string;
  private readonly itens = new Map<string, ItemSaida>();

  constructor(pasta: string) {
    this.pasta = pasta;
  }

  /** Começa vazia: apaga sobras de uma execução anterior. */
  async preparar(): Promise<void> {
    await rm(this.pasta, { recursive: true, force: true });
    await mkdir(this.pasta, { recursive: true });
  }

  adicionar(caminho: string, nome: string, tamanho: number): ItemSaida {
    const item: ItemSaida = {
      id: randomUUID(),
      nome,
      tamanho,
      caminho,
      token: randomBytes(32).toString('hex'),
      downloads: 0,
    };
    this.itens.set(item.id, item);
    return item;
  }

  listar(): ItemSaida[] {
    return [...this.itens.values()];
  }

  /** Devolve o item só se o código do link estiver certo (comparação em tempo constante). */
  buscar(id: string, token: string): ItemSaida | null {
    const item = this.itens.get(id);
    return item && segredoConfere(item.token, token) ? item : null;
  }

  registrarDownload(id: string): void {
    const item = this.itens.get(id);
    if (item) item.downloads++;
  }

  async remover(id: string): Promise<boolean> {
    const item = this.itens.get(id);
    if (!item) return false;
    this.itens.delete(id);
    try {
      await rm(item.caminho, { force: true });
    } catch (erro) {
      // Se o celular estiver baixando agora, o Windows pode segurar o arquivo; ele some ao encerrar.
      console.warn(`[aviso] "${item.nome}" será apagado ao encerrar:`, (erro as Error).message);
    }
    return true;
  }

  /** Síncrono para funcionar também no encerramento do processo. */
  esvaziar(): void {
    this.itens.clear();
    try {
      rmSync(this.pasta, { recursive: true, force: true });
    } catch (erro) {
      console.warn('[aviso] Não foi possível apagar a pasta temporária de envio:', (erro as Error).message);
    }
  }
}
