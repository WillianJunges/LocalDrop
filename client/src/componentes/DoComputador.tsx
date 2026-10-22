import { useEffect, useState } from 'react';
import { categoriaDoNome, formatarBytes } from '../envio/regras';
import { ICONES } from './ItemArquivo';

interface Disponivel {
  id: string;
  nome: string;
  tamanho: number;
  url: string;
}

const ATUALIZAR_MS = 3000;

/** Lista do que o PC deixou para baixar, atualizada sozinha enquanto a página está visível. */
function useDisponiveis(pin: string, ativo: boolean) {
  const [arquivos, setArquivos] = useState<Disponivel[]>([]);
  const [semConexao, setSemConexao] = useState(false);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;

    const atualizar = async () => {
      if (document.visibilityState !== 'visible') return; // poupa bateria com a tela apagada
      try {
        const resposta = await fetch('/api/disponiveis', { headers: { 'X-LocalDrop-Pin': pin } });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const corpo = (await resposta.json()) as { arquivos: Disponivel[] };
        if (!cancelado) {
          setArquivos(corpo.arquivos);
          setSemConexao(false);
        }
      } catch {
        if (!cancelado) setSemConexao(true);
      }
    };

    void atualizar();
    const intervalo = setInterval(() => void atualizar(), ATUALIZAR_MS);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [pin, ativo]);

  const removerDaLista = (id: string) => setArquivos((atuais) => atuais.filter((a) => a.id !== id));
  return { arquivos, semConexao, removerDaLista };
}

export function DoComputador({ pin, ativo }: { pin: string; ativo: boolean }) {
  const { arquivos, semConexao, removerDaLista } = useDisponiveis(pin, ativo);
  const [baixados, setBaixados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelarRecebimento(id: string) {
    setErro(null);
    try {
      const resposta = await fetch(`/api/disponiveis/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-LocalDrop-Pin': pin },
      });
      // 404: o PC já tinha tirado da lista; o resultado é o mesmo.
      if (!resposta.ok && resposta.status !== 404) throw new Error(String(resposta.status));
      removerDaLista(id);
      setConfirmando(null);
    } catch {
      setErro('Não foi possível cancelar. Confira a conexão com o computador.');
    }
  }

  if (!ativo) return null;
  if (semConexao) {
    return (
      <p className="aviso aviso-erro" role="alert">
        Sem conexão com o computador. O LocalDrop pode ter sido fechado.
      </p>
    );
  }
  if (arquivos.length === 0) return null;

  return (
    <section className="do-computador" aria-labelledby="titulo-do-computador">
      <h2 id="titulo-do-computador">📥 Do computador ({arquivos.length})</h2>
      {erro && (
        <p className="aviso aviso-erro" role="alert">
          {erro}
        </p>
      )}
      <ul className="lista">
        {arquivos.map((arquivo) => {
          const categoria = categoriaDoNome(arquivo.nome);
          const baixado = baixados.has(arquivo.id);
          return (
            <li key={arquivo.id} className={`item item-recebivel ${baixado ? 'item-baixado' : ''}`}>
              <span className="miniatura miniatura-icone" aria-hidden="true">
                {categoria ? ICONES[categoria] : '📄'}
              </span>
              <div className="item-info">
                <p className="item-nome">{arquivo.nome}</p>
                <p className="item-detalhe">
                  {formatarBytes(arquivo.tamanho)}
                  {baixado && ' · ✓ Baixando: confira as notificações ou a pasta Downloads'}
                </p>
              </div>

              {confirmando === arquivo.id ? (
                <div className="item-acoes item-confirmar" role="alertdialog" aria-labelledby={`pergunta-${arquivo.id}`}>
                  <p id={`pergunta-${arquivo.id}`}>
                    Deseja mesmo cancelar o recebimento? O arquivo some também da tela do computador.
                  </p>
                  <button
                    type="button"
                    className="botao-acao botao-acao-perigo"
                    onClick={() => void cancelarRecebimento(arquivo.id)}
                  >
                    Sim, cancelar
                  </button>
                  <button type="button" className="botao-acao botao-acao-neutro" onClick={() => setConfirmando(null)}>
                    Não
                  </button>
                </div>
              ) : (
                <div className="item-acoes">
                  <a
                    className="botao-acao botao-acao-baixar"
                    href={arquivo.url}
                    download={arquivo.nome}
                    onClick={() => setBaixados((atuais) => new Set(atuais).add(arquivo.id))}
                  >
                    Baixar
                  </a>
                  <button
                    type="button"
                    className="botao-acao botao-acao-neutro"
                    onClick={() => setConfirmando(arquivo.id)}
                    aria-label={`Cancelar o recebimento de ${arquivo.nome}`}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
