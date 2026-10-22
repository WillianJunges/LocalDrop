import { describe, expect, it } from 'vitest';
import { Atividade } from './atividade.js';
import { MonitorPresenca } from './presenca.js';

function criarMonitor(ocupado = () => false) {
  const relogio = { agora: 0 };
  let encerrou = 0;
  const monitor = new MonitorPresenca({
    semSinalMs: 180_000,
    esperaAoFecharMs: 15_000,
    ocupado,
    aoFecharTudo: () => encerrou++,
    agora: () => relogio.agora,
  });
  /** Avança o relógio verificando a cada 5 s, como o servidor faz. */
  const avancar = (ms: number) => {
    const fim = relogio.agora + ms;
    while (relogio.agora < fim) {
      relogio.agora = Math.min(relogio.agora + 5000, fim);
      monitor.verificar();
    }
  };
  return { monitor, relogio, avancar, encerrou: () => encerrou };
}

describe('MonitorPresenca', () => {
  it('nunca encerra se nenhuma aba do PC abriu (npm start sem navegador)', () => {
    const { avancar, encerrou } = criarMonitor();
    avancar(60 * 60_000);
    expect(encerrou()).toBe(0);
  });

  it('encerra 15 s depois que a aba avisa que fechou', () => {
    const { monitor, avancar, encerrou } = criarMonitor();
    monitor.sinal('aba-1');
    monitor.fechou('aba-1');

    avancar(10_000);
    expect(encerrou()).toBe(0);
    avancar(5000);
    expect(encerrou()).toBe(1);
  });

  it('um F5 (fecha e manda sinal de novo) não encerra', () => {
    const { monitor, avancar, encerrou } = criarMonitor();
    monitor.sinal('aba-1');
    monitor.fechou('aba-1');
    avancar(2000);
    monitor.sinal('aba-2'); // a página recarregada é uma aba nova

    avancar(60_000);
    expect(encerrou()).toBe(0);
  });

  it('aba que some sem avisar: encerra depois de 3 min sem sinal', () => {
    const { monitor, avancar, encerrou } = criarMonitor();
    monitor.sinal('aba-1');

    avancar(170_000);
    expect(encerrou()).toBe(0);
    avancar(10_000);
    expect(encerrou()).toBe(1);
  });

  it('com duas abas, só encerra quando as duas fecham', () => {
    const { monitor, avancar, encerrou } = criarMonitor();
    monitor.sinal('aba-1');
    monitor.sinal('aba-2');
    monitor.fechou('aba-1');

    avancar(30_000);
    expect(encerrou()).toBe(0);
    expect(monitor.abasAbertas).toBe(1);

    monitor.fechou('aba-2');
    avancar(15_000);
    expect(encerrou()).toBe(1);
  });

  it('não encerra durante uma transferência; encerra quando ela termina', () => {
    const atividade = new Atividade();
    const { monitor, avancar, encerrou } = criarMonitor(() => atividade.emAndamento > 0);
    const terminar = atividade.iniciar();
    monitor.sinal('aba-1');
    monitor.fechou('aba-1');

    avancar(10 * 60_000);
    expect(encerrou()).toBe(0);

    terminar();
    avancar(5000);
    expect(encerrou()).toBe(1);
  });

  it('PC suspenso por 1 hora: dá novo prazo às abas em vez de encerrar ao acordar', () => {
    const { monitor, relogio, avancar, encerrou } = criarMonitor();
    monitor.sinal('aba-1');

    relogio.agora += 60 * 60_000; // o processo ficou parado
    monitor.verificar();
    expect(encerrou()).toBe(0);

    monitor.sinal('aba-1'); // a aba volta a mandar sinal
    avancar(60_000);
    expect(encerrou()).toBe(0);
  });

  it('pede o encerramento uma vez só', () => {
    const { monitor, avancar, encerrou } = criarMonitor();
    monitor.sinal('aba-1');
    monitor.fechou('aba-1');
    avancar(60_000);
    expect(encerrou()).toBe(1);
  });
});

describe('Atividade', () => {
  it('conta transferências e ignora fim chamado duas vezes', () => {
    const atividade = new Atividade();
    const fimA = atividade.iniciar();
    const fimB = atividade.iniciar();
    expect(atividade.emAndamento).toBe(2);

    fimA();
    fimA();
    expect(atividade.emAndamento).toBe(1);
    fimB();
    expect(atividade.emAndamento).toBe(0);
  });
});
