import { useEffect, useState } from 'react';

const INTERVALO_MS = 10_000;

/**
 * Avisa o servidor que esta aba da tela do PC está aberta. Quando todas as abas
 * fecham, o LocalDrop encerra sozinho (sem ninguém precisar mexer no terminal).
 */
export function usePresenca(chave: string | null, ativo: boolean) {
  const [transferencias, setTransferencias] = useState(0);
  const [conectado, setConectado] = useState(true);

  useEffect(() => {
    if (!chave || !ativo) return;
    // localhost é contexto seguro, então randomUUID existe aqui (no celular, por HTTP, não).
    const aba = crypto.randomUUID();
    const corpo = (fechou = false) => JSON.stringify({ aba, chave, fechou });

    const mandarSinal = async () => {
      try {
        const resposta = await fetch('/api/pc/presenca', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: corpo(),
        });
        if (!resposta.ok) throw new Error(String(resposta.status));
        setTransferencias(((await resposta.json()) as { transferencias: number }).transferencias);
        setConectado(true);
      } catch {
        setConectado(false);
      }
    };

    // Ao fechar a aba, fetch comum pode ser cortado; sendBeacon é entregue mesmo assim.
    const avisarQueFechou = () => navigator.sendBeacon('/api/pc/presenca', new Blob([corpo(true)], { type: 'text/plain' }));
    const aoFicarVisivel = () => {
      if (document.visibilityState === 'visible') void mandarSinal();
    };

    void mandarSinal();
    const intervalo = setInterval(() => void mandarSinal(), INTERVALO_MS);
    window.addEventListener('pagehide', avisarQueFechou);
    window.addEventListener('pageshow', aoFicarVisivel);
    document.addEventListener('visibilitychange', aoFicarVisivel);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('pagehide', avisarQueFechou);
      window.removeEventListener('pageshow', aoFicarVisivel);
      document.removeEventListener('visibilitychange', aoFicarVisivel);
    };
  }, [chave, ativo]);

  return { transferencias, conectado };
}
