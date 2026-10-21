import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { carregarConfig, lerPorta, PORTA_PADRAO } from './config.js';

describe('lerPorta', () => {
  it('usa a porta padrão quando não configurada', () => {
    expect(lerPorta(undefined)).toBe(PORTA_PADRAO);
    expect(lerPorta('  ')).toBe(PORTA_PADRAO);
  });

  it('aceita uma porta válida', () => {
    expect(lerPorta('9000')).toBe(9000);
  });

  it.each(['0', '65536', 'abc', '80.5', '-1'])('recusa "%s"', (valor) => {
    expect(() => lerPorta(valor)).toThrow(/LOCALDROP_PORTA inválida/);
  });
});

describe('carregarConfig', () => {
  it('salva em recebidos/ na raiz do projeto por padrão', () => {
    const config = carregarConfig({});
    expect(path.basename(config.pastaRecebidos)).toBe('recebidos');
    expect(path.dirname(config.pastaRecebidos)).toBe(path.dirname(path.dirname(config.pastaClient)));
  });

  it('permite trocar a pasta com LOCALDROP_DIR', () => {
    const outra = path.resolve('outra-pasta');
    expect(carregarConfig({ LOCALDROP_DIR: outra }).pastaRecebidos).toBe(outra);
  });
});
