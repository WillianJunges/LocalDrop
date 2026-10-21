import { describe, expect, it } from 'vitest';
import { gerarPin, pinConfere } from './sessao.js';

describe('gerarPin', () => {
  it('gera sempre 6 dígitos, inclusive com zeros à esquerda', () => {
    for (let i = 0; i < 1000; i++) {
      expect(gerarPin()).toMatch(/^\d{6}$/);
    }
  });

  it('não repete o mesmo PIN o tempo todo', () => {
    const pins = new Set(Array.from({ length: 50 }, gerarPin));
    expect(pins.size).toBeGreaterThan(40);
  });
});

describe('pinConfere', () => {
  it('aceita o PIN correto', () => {
    expect(pinConfere('012345', '012345')).toBe(true);
  });

  it.each([
    ['errado', '012346'],
    ['curto', '01234'],
    ['longo', '0123456'],
    ['vazio', ''],
  ])('recusa PIN %s', (_caso, recebido) => {
    expect(pinConfere('012345', recebido)).toBe(false);
  });

  it('recusa valores que não são texto', () => {
    expect(pinConfere('012345', undefined)).toBe(false);
    expect(pinConfere('012345', 12345)).toBe(false);
    expect(pinConfere('012345', ['012345'])).toBe(false);
  });
});
