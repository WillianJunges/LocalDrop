import { useEffect, useState } from 'react';
import type { Item } from '../envio/fila';
import { type Categoria, formatarBytes } from '../envio/regras';

const ICONES: Record<Categoria, string> = {
  imagem: '🖼️',
  documento: '📄',
  audio: '🎵',
  video: '🎬',
  compactado: '🗜️',
};

function Miniatura({ arquivo, categoria }: { arquivo: File; categoria: Item['categoria'] }) {
  const [url, setUrl] = useState<string | null>(null);

  // Só imagens ganham miniatura; o link temporário é liberado quando o item sai da tela.
  useEffect(() => {
    if (categoria !== 'imagem') return;
    const link = URL.createObjectURL(arquivo);
    setUrl(link);
    return () => URL.revokeObjectURL(link);
  }, [arquivo, categoria]);

  if (url) return <img className="miniatura" src={url} alt="" width={48} height={48} decoding="async" />;
  return (
    <span className="miniatura miniatura-icone" aria-hidden="true">
      {categoria ? ICONES[categoria] : '⛔'}
    </span>
  );
}

function textoStatus(item: Item): string {
  switch (item.status) {
    case 'pronto':
      return 'Aguardando envio';
    case 'enviando':
      return item.bytesEnviados >= item.arquivo.size ? 'Finalizando no computador…' : 'Enviando…';
    case 'falhou':
      return '⚠ Falhou: dá para tentar de novo';
    case 'recusado':
      return '✗ Não pode ser enviado';
  }
}

interface Props {
  item: Item;
  bloqueado: boolean;
  onRemover: (id: number) => void;
}

export function ItemArquivo({ item, bloqueado, onRemover }: Props) {
  const { arquivo } = item;
  const porcentagem = arquivo.size > 0 ? Math.floor((item.bytesEnviados / arquivo.size) * 100) : 0;

  return (
    <li className={`item item-${item.status}`}>
      <Miniatura arquivo={arquivo} categoria={item.categoria} />

      <div className="item-info">
        <p className="item-nome" title={arquivo.name}>
          {arquivo.name}
        </p>
        <p className="item-detalhe">
          {formatarBytes(arquivo.size)} · {textoStatus(item)}
        </p>

        {item.status === 'enviando' && (
          <progress
            className="item-progresso"
            value={item.bytesEnviados}
            max={arquivo.size}
            aria-label={`Progresso de ${arquivo.name}: ${porcentagem}%`}
          />
        )}
        {item.motivo && <p className="item-motivo">{item.motivo}</p>}
      </div>

      {item.status !== 'enviando' && (
        <button
          type="button"
          className="botao-icone"
          onClick={() => onRemover(item.id)}
          disabled={bloqueado}
          aria-label={`Remover ${arquivo.name}`}
        >
          ✕
        </button>
      )}
    </li>
  );
}
