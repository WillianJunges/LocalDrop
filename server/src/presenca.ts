export interface OpcoesPresenca {
  /** Tempo sem nenhum sinal de uma aba para considerá-la fechada (navegador fechado à força etc.). */
  semSinalMs?: number;
  /** Espera depois que a aba avisa que fechou; um F5 manda sinal de novo antes disso. */
  esperaAoFecharMs?: number;
  /** Enquanto houver transferência, nunca encerra. */
  ocupado: () => boolean;
  aoFecharTudo: () => void;
  agora?: () => number;
}

/** Intervalo em que verificar() deve ser chamado. Uma pausa bem maior indica PC suspenso. */
export const INTERVALO_VERIFICACAO_MS = 5000;
const PAUSA_SUSPENSAO_MS = 60_000;

/**
 * Acompanha as abas da tela do PC. Quando todas fecham (e nada está sendo
 * transferido), avisa para o LocalDrop encerrar. Sem nenhuma aba desde o início
 * (ex.: npm start sem abrir o navegador), nunca encerra sozinho.
 */
export class MonitorPresenca {
  private readonly prazos = new Map<string, number>();
  private readonly semSinalMs: number;
  private readonly esperaAoFecharMs: number;
  private readonly ocupado: () => boolean;
  private readonly aoFecharTudo: () => void;
  private readonly agora: () => number;
  private jaTeveAba = false;
  private encerrado = false;
  private ultimaVerificacao: number;

  constructor(opcoes: OpcoesPresenca) {
    this.semSinalMs = opcoes.semSinalMs ?? 3 * 60_000;
    this.esperaAoFecharMs = opcoes.esperaAoFecharMs ?? 15_000;
    this.ocupado = opcoes.ocupado;
    this.aoFecharTudo = opcoes.aoFecharTudo;
    this.agora = opcoes.agora ?? Date.now;
    this.ultimaVerificacao = this.agora();
  }

  sinal(aba: string): void {
    this.prazos.set(aba, this.agora() + this.semSinalMs);
    this.jaTeveAba = true;
  }

  fechou(aba: string): void {
    if (this.prazos.has(aba)) this.prazos.set(aba, this.agora() + this.esperaAoFecharMs);
  }

  get abasAbertas(): number {
    return this.prazos.size;
  }

  /** Chamar a cada INTERVALO_VERIFICACAO_MS. Devolve true quando pediu o encerramento. */
  verificar(): boolean {
    if (this.encerrado) return true;
    const agora = this.agora();

    // O PC estava suspenso: o servidor "pulou" no tempo e as abas ainda não tiveram
    // chance de mandar sinal. Dá um novo prazo a todas em vez de encerrar.
    if (agora - this.ultimaVerificacao > PAUSA_SUSPENSAO_MS) {
      for (const aba of this.prazos.keys()) this.prazos.set(aba, agora + this.semSinalMs);
    }
    this.ultimaVerificacao = agora;

    for (const [aba, prazo] of this.prazos) {
      if (prazo <= agora) this.prazos.delete(aba);
    }

    if (this.jaTeveAba && this.prazos.size === 0 && !this.ocupado()) {
      this.encerrado = true;
      this.aoFecharTudo();
      return true;
    }
    return false;
  }
}
