import type { ChangeEvent } from 'react';
import { ItemArquivo } from '../componentes/ItemArquivo';
import { formatarDuracao, formatarVelocidade } from '../envio/medidor';
import { ACEITOS_ARQUIVOS, ACEITOS_GALERIA, formatarBytes } from '../envio/regras';
import { type Lote, useFilaEnvio } from '../envio/useFilaEnvio';
import { type EstadoPin, usePin } from '../envio/usePin';

const TEXTO_PIN: Record<EstadoPin, string> = {
  incompleto: 'Digite os 6 dígitos mostrados na tela do computador.',
  conferindo: 'Conferindo…',
  confirmado: '✓ PIN confirmado.',
  errado: '✗ PIN incorreto.',
  bloqueado: '✗ Bloqueado por tentativas erradas.',
  'sem-conexao': '✗ Não foi possível falar com o computador.',
};

export function Celular() {
  const { pin, setPin, estado: estadoPin, mensagem: mensagemPin, limites } = usePin();
  const fila = useFilaEnvio(pin, limites);
  const enviando = fila.lote !== null;
  const pinOk = estadoPin === 'confirmado';
  const recusados = fila.itens.filter((item) => item.status === 'recusado').length;
  const bytesParaEnviar = fila.paraEnviar.reduce((soma, item) => soma + item.arquivo.size, 0);
  const soFalhas = fila.paraEnviar.length > 0 && fila.paraEnviar.every((item) => item.status === 'falhou');

  const aoEscolher = (evento: ChangeEvent<HTMLInputElement>) => {
    fila.adicionar(Array.from(evento.target.files ?? []));
    // Limpa o campo para permitir escolher os mesmos arquivos de novo depois.
    evento.target.value = '';
  };

  return (
    <main className="pagina pagina-celular">
      <h1>LocalDrop</h1>

      <section aria-labelledby="titulo-pin">
        <label className="campo" id="titulo-pin">
          PIN
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            disabled={enviando}
            aria-invalid={estadoPin === 'errado' || fila.aviso?.doPin === true}
            aria-describedby="estado-pin"
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        <p id="estado-pin" className={`dica estado-pin estado-pin-${estadoPin}`} role="status">
          {TEXTO_PIN[estadoPin]}
          {(estadoPin === 'bloqueado' || estadoPin === 'sem-conexao') && mensagemPin && ` ${mensagemPin}`}
        </p>
      </section>

      <section className="seletores" aria-label="Escolher arquivos">
        <label className={`botao-secundario ${enviando ? 'desativado' : ''}`}>
          <input
            className="visualmente-oculto"
            type="file"
            multiple
            accept={ACEITOS_GALERIA}
            disabled={enviando}
            onChange={aoEscolher}
          />
          <span aria-hidden="true">📷</span> Fotos e vídeos
        </label>
        <label className={`botao-secundario ${enviando ? 'desativado' : ''}`}>
          <input
            className="visualmente-oculto"
            type="file"
            multiple
            accept={ACEITOS_ARQUIVOS}
            disabled={enviando}
            onChange={aoEscolher}
          />
          <span aria-hidden="true">📁</span> Arquivos
        </label>
      </section>
      <p className="dica">
        Para marcar vários, <strong>toque e segure</strong> no primeiro arquivo e depois toque nos outros. Dá para
        escolher em várias rodadas: a lista vai somando.
      </p>

      {fila.aviso && (
        <div className={`aviso aviso-${fila.aviso.tipo}`} role="alert">
          <span>{fila.aviso.texto}</span>
          <button type="button" className="botao-texto" onClick={fila.fecharAviso}>
            Fechar
          </button>
        </div>
      )}

      {fila.lote && <ResumoLote lote={fila.lote} telaTravadaLigada={fila.telaTravadaLigada} />}

      {fila.itens.length > 0 && (
        <section aria-labelledby="titulo-lista">
          <div className="cabecalho-lista">
            <h2 id="titulo-lista">Para enviar ({fila.itens.length})</h2>
            {recusados > 0 && !enviando && (
              <button type="button" className="botao-texto" onClick={fila.removerRecusados}>
                Remover recusados
              </button>
            )}
          </div>
          <ul className="lista">
            {fila.itens.map((item) => (
              <ItemArquivo key={item.id} item={item} bloqueado={enviando} onRemover={fila.remover} />
            ))}
          </ul>
        </section>
      )}

      {fila.itens.length === 0 && fila.enviados.length === 0 && (
        <p className="vazio">Nenhum arquivo escolhido ainda.</p>
      )}

      <div className="acoes">
        {enviando ? (
          <button type="button" className="botao botao-perigo" onClick={fila.cancelar}>
            Cancelar envio
          </button>
        ) : (
          <button
            type="button"
            className="botao"
            disabled={!pinOk || fila.paraEnviar.length === 0}
            onClick={fila.enviarTodos}
          >
            {fila.paraEnviar.length === 0
              ? 'Enviar'
              : `${soFalhas ? 'Tentar de novo' : 'Enviar'} ${fila.paraEnviar.length} ${
                  fila.paraEnviar.length === 1 ? 'arquivo' : 'arquivos'
                } (${formatarBytes(bytesParaEnviar)})`}
          </button>
        )}
        {!pinOk && fila.paraEnviar.length > 0 && !enviando && (
          <p className="dica">Confirme o PIN para liberar o envio.</p>
        )}
      </div>

      {fila.enviados.length > 0 && (
        <section className="enviados" aria-labelledby="titulo-enviados">
          <details>
            <summary id="titulo-enviados">
              ✓ Enviados nesta sessão ({fila.enviados.length})
            </summary>
            <ul>
              {fila.enviados.map((enviado) => (
                <li key={enviado.id}>
                  {enviado.nomeSalvo}
                  {enviado.nomeSalvo !== enviado.nomeOriginal && (
                    <span className="dica"> (já existia um com o nome {enviado.nomeOriginal})</span>
                  )}
                  <span className="dica"> · {formatarBytes(enviado.tamanho)}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="botao-texto" onClick={fila.limparEnviados}>
              Limpar lista
            </button>
          </details>
        </section>
      )}
    </main>
  );
}

function ResumoLote({ lote, telaTravadaLigada }: { lote: Lote; telaTravadaLigada: boolean }) {
  const porcentagem = lote.totalBytes > 0 ? Math.floor((lote.bytesEnviados / lote.totalBytes) * 100) : 0;

  return (
    <section className="resumo-lote" aria-label="Progresso geral">
      <p className="resumo-titulo">
        Enviando {lote.posicao} de {lote.totalArquivos} · {porcentagem}%
      </p>
      <progress value={lote.bytesEnviados} max={lote.totalBytes} aria-label={`Progresso geral: ${porcentagem}%`} />
      <p className="dica">
        {formatarBytes(lote.bytesEnviados)} de {formatarBytes(lote.totalBytes)}
        {lote.bytesPorSegundo !== null && ` · ${formatarVelocidade(lote.bytesPorSegundo)}`}
        {lote.segundosRestantes !== null && ` · faltam cerca de ${formatarDuracao(lote.segundosRestantes)}`}
      </p>
      {!telaTravadaLigada && (
        <p className="dica">
          <strong>Mantenha a tela ligada e esta página aberta</strong> até terminar. Se o celular bloquear, o envio
          pode parar.
        </p>
      )}
    </section>
  );
}
