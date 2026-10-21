interface Registro {
  erros: number;
  bloqueadoAte: number;
}

/** Bloqueia temporariamente um IP depois de muitos PINs errados seguidos. */
export class ControleTentativas {
  private readonly registros = new Map<string, Registro>();
  private readonly maxErros: number;
  private readonly bloqueioMs: number;
  private readonly agora: () => number;

  constructor(maxErros = 5, bloqueioMs = 5 * 60_000, agora: () => number = Date.now) {
    this.maxErros = maxErros;
    this.bloqueioMs = bloqueioMs;
    this.agora = agora;
  }

  /** Milissegundos que ainda faltam de bloqueio (0 = liberado). */
  bloqueadoPor(ip: string): number {
    const registro = this.registros.get(ip);
    return registro ? Math.max(registro.bloqueadoAte - this.agora(), 0) : 0;
  }

  registrarErro(ip: string): void {
    const registro = this.registros.get(ip) ?? { erros: 0, bloqueadoAte: 0 };
    registro.erros++;
    if (registro.erros >= this.maxErros) {
      registro.bloqueadoAte = this.agora() + this.bloqueioMs;
      registro.erros = 0;
    }
    this.registros.set(ip, registro);
  }

  limpar(ip: string): void {
    this.registros.delete(ip);
  }
}
