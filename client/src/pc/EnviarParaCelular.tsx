import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ICONES } from '../componentes/ItemArquivo';
import { DESTINO_SAIDA, enviarArquivo } from '../envio/api';
import { ACEITOS_ARQUIVOS, avaliarArquivo, categoriaDoNome, formatarBytes, type Limites } from '../envio/regras';

interface ArquivoNaSaida {
  id: string;
  nome: string;
  tamanho: number;
  downloads: number;
}

/** Arquivo sendo copiado do navegador para a caixa de saída do servidor. */
interface Copia {
  chave: number;
  arquivo: File;
  estado: 'aguardando' | 'copiando' | 'erro';
  bytesEnviados: number;
  erro: string | null;
}

const ATUALIZAR_MS = 3000;

function Icone({ nome }: { nome: string }) {
  const categoria = categoriaDoNome(nome);
  return (
    <span className="miniatura miniatura-icone" aria-hidden="true">
      {categoria ? ICONES[categoria] : '📄'}
    </span>
  );
}

/** Card da tela do PC: deixa arquivos disponíveis para o celular baixar. */
export function EnviarParaCelular({ limites }: { limites: Limites }) {
  const [naSaida, setNaSaida] = useState<ArquivoNaSaida[]>([]);
  const [copias, setCopias] = useState<Copia[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const proximaChave = useRef(1);
  const copiando = useRef(false);

  const atualizar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/saida');
      if (resposta.ok) setNaSaida(((await resposta.json()) as { arquivos: ArquivoNaSaida[] }).arquivos);
    } catch {
      // Servidor fechado: o aviso de desconexão da página já cobre isso.
    }
  }, []);

  // Mantém o "Baixado pelo celular" atualizado.
  useEffect(() => {
    void atualizar();
    const intervalo = setInterval(() => void atualizar(), ATUALIZAR_MS);
    return () => clearInterval(intervalo);
  }, [atualizar]);

  // Copia um arquivo por vez para a caixa de saída do servidor.
  useEffect(() => {
    const proxima = copias.find((c) => c.estado === 'aguardando');
    if (!proxima || copiando.current) return;
    copiando.current = true;

    const mudar = (mudanca: Partial<Copia>) =>
      setCopias((atuais) => atuais.map((c) => (c.chave === proxima.chave ? { ...c, ...mudanca } : c)));
    mudar({ estado: 'copiando' });
    const envio = enviarArquivo(proxima.arquivo, DESTINO_SAIDA, (bytes) => mudar({ bytesEnviados: bytes }));

    void envio.resultado.then(async (resultado) => {
      copiando.current = false;
      if (resultado.ok) {
        await atualizar();
        setCopias((atuais) => atuais.filter((c) => c.chave !== proxima.chave));
      } else {
        mudar({ estado: 'erro', erro: resultado.motivo });
      }
    });
  }, [copias, atualizar]);

  function adicionar(arquivos: File[]) {
    const novas = arquivos.map((arquivo): Copia => {
      const problema = avaliarArquivo(arquivo.name, arquivo.size, limites).problema;
      return {
        chave: proximaChave.current++,
        arquivo,
        estado: problema ? 'erro' : 'aguardando',
        bytesEnviados: 0,
        erro: problema,
      };
    });
    setCopias((atuais) => [...atuais, ...novas]);
  }

  async function remover(id: string) {
    await fetch(`/api/saida/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-LocalDrop': '1' } });
    await atualizar();
  }

  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    setArrastando(false);
    adicionar(Array.from(evento.dataTransfer.files));
  };

  return (
    <section className="cartao cartao-saida" aria-labelledby="titulo-saida">
      <h2 id="titulo-saida">Enviar para o celular</h2>

      <div
        className={`area-soltar ${arrastando ? 'arrastando' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
      >
        <p>Arraste arquivos para cá ou</p>
        <label className="botao-secundario">
          <input
            className="visualmente-oculto"
            type="file"
            multiple
            accept={ACEITOS_ARQUIVOS}
            onChange={(e) => {
              adicionar(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          Escolher arquivos
        </label>
        <p className="dica">No celular, eles aparecem em "Do computador" para baixar.</p>
      </div>

      {(copias.length > 0 || naSaida.length > 0) && (
        <ul className="lista" aria-live="polite">
          {copias.map((copia) => (
            <li key={`copia-${copia.chave}`} className={`item ${copia.erro ? 'item-recusado' : 'item-enviando'}`}>
              <Icone nome={copia.arquivo.name} />
              <div className="item-info">
                <p className="item-nome">{copia.arquivo.name}</p>
                <p className="item-detalhe">
                  {formatarBytes(copia.arquivo.size)} · {copia.estado === 'erro' ? '✗ Não pode ser enviado' : copia.estado === 'copiando' ? 'Preparando…' : 'Na fila'}
                </p>
                {copia.erro ? (
                  <p className="item-motivo">{copia.erro}</p>
                ) : (
                  <progress
                    className="item-progresso"
                    value={copia.bytesEnviados}
                    max={copia.arquivo.size}
                    aria-label={`Preparando ${copia.arquivo.name}`}
                  />
                )}
              </div>
              {copia.erro && (
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Dispensar ${copia.arquivo.name}`}
                  onClick={() => setCopias((atuais) => atuais.filter((c) => c.chave !== copia.chave))}
                >
                  ✕
                </button>
              )}
            </li>
          ))}

          {naSaida.map((arquivo) => (
            <li key={arquivo.id} className={`item ${arquivo.downloads > 0 ? 'item-baixado' : ''}`}>
              <Icone nome={arquivo.nome} />
              <div className="item-info">
                <p className="item-nome">{arquivo.nome}</p>
                <p className="item-detalhe">
                  {formatarBytes(arquivo.tamanho)} ·{' '}
                  {arquivo.downloads > 0
                    ? `✓ Baixado pelo celular${arquivo.downloads > 1 ? ` (${arquivo.downloads}x)` : ''}`
                    : 'Disponível no celular'}
                </p>
              </div>
              <button
                type="button"
                className="botao-icone"
                aria-label={`Tirar ${arquivo.nome} do celular`}
                onClick={() => void remover(arquivo.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
