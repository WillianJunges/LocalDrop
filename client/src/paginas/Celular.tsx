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

export function Celular() {
  const [pin, setPin] = useState(lerPinInicial);
  const pinValido = /^\d{6}$/.test(pin);

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

      <p className="dica">O envio de arquivos chega na próxima etapa do projeto.</p>
    </main>
  );
}
