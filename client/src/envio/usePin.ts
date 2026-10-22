import { useEffect, useState } from 'react';
import { conferirPin } from './api';
import { LIMITES_PADRAO, type Limites } from './regras';

const CHAVE_PIN = 'localdrop:pin';

export type EstadoPin = 'incompleto' | 'conferindo' | 'confirmado' | 'errado' | 'bloqueado' | 'sem-conexao';

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

export function usePin() {
  const [pin, setPinBruto] = useState(lerPinInicial);
  const [estado, setEstado] = useState<EstadoPin>('incompleto');
  const [mensagem, setMensagem] = useState('');
  const [limites, setLimites] = useState<Limites>(LIMITES_PADRAO);

  // Confere assim que os 6 dígitos estão preenchidos (vindo do QR Code ou digitados).
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) {
      setEstado('incompleto');
      return;
    }
    let ignorar = false;
    setEstado('conferindo');
    conferirPin(pin).then((resultado) => {
      if (ignorar) return;
      if (resultado.ok) {
        setEstado('confirmado');
        setLimites(resultado.limites);
      } else {
        setEstado(resultado.tipo === 'pin' ? 'errado' : resultado.tipo === 'bloqueado' ? 'bloqueado' : 'sem-conexao');
        setMensagem(resultado.motivo);
      }
    });
    return () => {
      ignorar = true;
    };
  }, [pin]);

  const setPin = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 6);
    setPinBruto(limpo);
    guardarPin(limpo);
  };

  return { pin, setPin, estado, mensagem, limites };
}
