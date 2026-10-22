/** Conta transferências em andamento (envios e downloads), para o LocalDrop não fechar no meio de uma. */
export class Atividade {
  private ativas = 0;

  /** Marca o início de uma transferência; chame a função devolvida ao terminar (pode chamar mais de uma vez). */
  iniciar(): () => void {
    this.ativas++;
    let encerrada = false;
    return () => {
      if (encerrada) return;
      encerrada = true;
      this.ativas--;
    };
  }

  get emAndamento(): number {
    return this.ativas;
  }
}
