import { formatarBytes } from './regras';

interface Amostra {
  tempo: number;
  bytes: number;
}

/**
 * Velocidade média dos últimos segundos. Uma janela curta reage a mudanças no Wi-Fi
 * sem ficar pulando a cada evento de progresso.
 */
export class MedidorVelocidade {
  private amostras: Amostra[] = [];
  private readonly janelaMs: number;

  constructor(janelaMs = 3000) {
    this.janelaMs = janelaMs;
  }

  registrar(tempo: number, bytesEnviados: number): void {
    this.amostras.push({ tempo, bytes: bytesEnviados });
    while (this.amostras.length > 2 && (this.amostras[0]?.tempo ?? tempo) < tempo - this.janelaMs) {
      this.amostras.shift();
    }
  }

  /** Bytes por segundo, ou null enquanto não há dados suficientes. */
  bytesPorSegundo(): number | null {
    const primeira = this.amostras[0];
    const ultima = this.amostras.at(-1);
    if (!primeira || !ultima) return null;

    const intervalo = ultima.tempo - primeira.tempo;
    if (intervalo < 500) return null;
    return Math.max(ultima.bytes - primeira.bytes, 0) / (intervalo / 1000);
  }

  reiniciar(): void {
    this.amostras = [];
  }
}

/** Segundos que faltam, ou null se ainda não dá para estimar. */
export function tempoRestante(bytesFaltando: number, bytesPorSegundo: number | null): number | null {
  if (!bytesPorSegundo || bytesPorSegundo <= 0) return null;
  return Math.ceil(bytesFaltando / bytesPorSegundo);
}

export function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min ${String(segundos % 60).padStart(2, '0')} s`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

export function formatarVelocidade(bytesPorSegundo: number): string {
  return `${formatarBytes(Math.round(bytesPorSegundo))}/s`;
}
