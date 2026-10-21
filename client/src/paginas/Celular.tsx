import { useState } from 'react';

const CHAVE_PIN = 'localdrop:pin';

/**
 * Lê o PIN do fragmento (#pin=123456) e tira ele da barra de endereço,
 * para não ficar visível nem ir junto se o link for compartilhado.
 */
function lerPinInicial(): string {
  const doFragmento = new URLSearchParams(window.location.hash.slice(1)).get('pin');
  if (doFragmento && /^\d{6}$/.test(doFragmento)) {
    history.replaceState(null, '', window.location.pathname);
    guardarPin(doFragmento);
    return doFragmento;
  }
  try {
    return sessionStorage.getItem(CHAVE_PIN) ?? '';
  } catch {
    // Navegação privada pode bloquear o sessionStorage; o usuário digita o PIN.
    return '';
  }
}

function guardarPin(pin: string) {
  try {
    sessionStorage.setItem(CHAVE_PIN, pin);
  } catch {
    // Sem sessionStorage o PIN fica só na memória desta aba.
  }
}

interface Resultado {
  arquivo: string;
  ok: boolean;
  mensagem: string;
}

// Versão provisória (Fase 2): envia um por vez, sem barra de progresso. A Fase 3 refaz a interface.
async function enviarArquivo(arquivo: File, pin: string): Promise<Resultado> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  try {
    const resposta = await fetch('/api/upload', { method: 'POST', headers: { 'X-LocalDrop-Pin': pin }, body: corpo });
    const dados = (await resposta.json()) as { ok: boolean; nome?: string; motivo?: string };
    return dados.ok
      ? { arquivo: arquivo.name, ok: true, mensagem: `Salvo como ${dados.nome}` }
      : { arquivo: arquivo.name, ok: false, mensagem: dados.motivo ?? 'Erro desconhecido.' };
  } catch {
    return { arquivo: arquivo.name, ok: false, mensagem: 'Falha de conexão com o computador.' };
  }
}

export function Celular() {
  const [pin, setPin] = useState(lerPinInicial);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const pinValido = /^\d{6}$/.test(pin);

  async function enviar() {
    setEnviando(true);
    setResultados([]);
    for (const arquivo of arquivos) {
      const resultado = await enviarArquivo(arquivo, pin);
      setResultados((anteriores) => [...anteriores, resultado]);
    }
    setEnviando(false);
  }

  return (
    <main className="pagina pagina-celular">
      <h1>LocalDrop</h1>
      <p className="aviso aviso-ok" role="status">
        <strong>Conectado</strong> ao computador.
      </p>

      <label className="campo">
        PIN mostrado na tela do computador
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            const novo = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPin(novo);
            guardarPin(novo);
          }}
        />
      </label>
      <p className="dica">{pinValido ? 'PIN preenchido.' : 'Digite os 6 dígitos do PIN.'}</p>

      <label className="campo">
        Arquivos
        <input
          type="file"
          multiple
          disabled={enviando}
          onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
        />
      </label>

      <button type="button" className="botao" disabled={!pinValido || arquivos.length === 0 || enviando} onClick={enviar}>
        {enviando ? `Enviando ${resultados.length + 1} de ${arquivos.length}…` : 'Enviar'}
      </button>

      {resultados.length > 0 && (
        <ul className="resultados" aria-live="polite">
          {resultados.map((r, i) => (
            <li key={i} className={r.ok ? 'aviso aviso-ok' : 'aviso aviso-erro'}>
              <strong>{r.ok ? '✓ Enviado' : '✗ Falhou'}:</strong> {r.arquivo}
              <br />
              <span className="dica">{r.mensagem}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
