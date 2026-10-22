import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { calcularVersao } from './versao.js';

const raiz = mkdtempSync(path.join(tmpdir(), 'localdrop-versao-'));
mkdirSync(path.join(raiz, 'server', 'dist'), { recursive: true });
mkdirSync(path.join(raiz, 'client', 'dist'), { recursive: true });
writeFileSync(path.join(raiz, 'server', 'dist', 'app.js'), 'console.log(1)');
writeFileSync(path.join(raiz, 'client', 'dist', 'index.html'), '<script src="/assets/index-abc.js"></script>');
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

describe('calcularVersao', () => {
  it('é estável para o mesmo build', () => {
    expect(calcularVersao(raiz)).toBe(calcularVersao(raiz));
    expect(calcularVersao(raiz)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('muda quando o servidor muda', () => {
    const antes = calcularVersao(raiz);
    writeFileSync(path.join(raiz, 'server', 'dist', 'app.js'), 'console.log(2)');
    expect(calcularVersao(raiz)).not.toBe(antes);
  });

  it('muda quando o front muda', () => {
    const antes = calcularVersao(raiz);
    writeFileSync(path.join(raiz, 'client', 'dist', 'index.html'), '<script src="/assets/index-def.js"></script>');
    expect(calcularVersao(raiz)).not.toBe(antes);
  });

  it('ignora arquivos que não são .js no servidor', () => {
    const antes = calcularVersao(raiz);
    writeFileSync(path.join(raiz, 'server', 'dist', 'notas.txt'), 'qualquer coisa');
    expect(calcularVersao(raiz)).toBe(antes);
  });
});
