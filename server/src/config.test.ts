import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { carregarConfig, lerPorta, PORTA_PADRAO, RAIZ_PROJETO, validarConfigArquivo } from './config.js';
import { LIMITES_PADRAO } from './tipos.js';

const pastaTeste = mkdtempSync(path.join(tmpdir(), 'localdrop-config-'));
afterAll(() => rmSync(pastaTeste, { recursive: true, force: true }));

function arquivoConfig(conteudo: string): string {
  const caminho = path.join(pastaTeste, `${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(caminho, conteudo);
  return caminho;
}

const SEM_ARQUIVO = path.join(pastaTeste, 'nao-existe.json');

describe('lerPorta', () => {
  it('aceita número ou texto', () => {
    expect(lerPorta('9000')).toBe(9000);
    expect(lerPorta(9000)).toBe(9000);
  });

  it.each(['0', '65536', 'abc', '80.5', '-1', 8787.5, null, true])('recusa %j', (valor) => {
    expect(() => lerPorta(valor)).toThrow(/inválida/);
  });
});

describe('carregarConfig', () => {
  it('usa os padrões quando não há arquivo nem variáveis', () => {
    const config = carregarConfig({}, SEM_ARQUIVO);
    expect(config.porta).toBe(PORTA_PADRAO);
    expect(config.pastaRecebidos).toBe(path.join(RAIZ_PROJETO, 'recebidos'));
    expect(config.limites).toEqual(LIMITES_PADRAO);
  });

  it('lê porta, pasta e limites do localdrop.json', () => {
    const arquivo = arquivoConfig('{ "porta": 9000, "pasta": "minha-pasta", "limitesMB": { "video": 8192 } }');
    const config = carregarConfig({}, arquivo);

    expect(config.porta).toBe(9000);
    expect(config.pastaRecebidos).toBe(path.join(RAIZ_PROJETO, 'minha-pasta'));
    expect(config.limites.video).toBe(8 * 1024 ** 3);
    expect(config.limites.imagem).toBe(LIMITES_PADRAO.imagem);
  });

  it('aceita pasta absoluta', () => {
    const outra = path.join(pastaTeste, 'fotos');
    const arquivo = arquivoConfig(JSON.stringify({ pasta: outra }));
    expect(carregarConfig({}, arquivo).pastaRecebidos).toBe(outra);
  });

  it('variáveis de ambiente têm prioridade sobre o arquivo', () => {
    const arquivo = arquivoConfig('{ "porta": 9000, "pasta": "do-arquivo" }');
    const outra = path.join(pastaTeste, 'do-ambiente');
    const config = carregarConfig({ LOCALDROP_PORTA: '9100', LOCALDROP_DIR: outra }, arquivo);

    expect(config.porta).toBe(9100);
    expect(config.pastaRecebidos).toBe(outra);
  });

  it('JSON quebrado gera mensagem clara', () => {
    expect(() => carregarConfig({}, arquivoConfig('{ "porta": 9000, }'))).toThrow(/não é um JSON válido/);
  });
});

describe('validarConfigArquivo', () => {
  it.each([
    [[], /precisa ser um objeto/],
    [{ prota: 9000 }, /opção desconhecida "prota"/],
    [{ porta: '9000a' }, /"porta" inválida/],
    [{ pasta: '' }, /"pasta" precisa ser um caminho/],
    [{ limitesMB: 50 }, /"limitesMB" precisa ser um objeto/],
    [{ limitesMB: { videos: 10 } }, /categoria desconhecida/],
    [{ limitesMB: { video: 0 } }, /entre 1 e 51200/],
    [{ limitesMB: { video: 999999 } }, /entre 1 e 51200/],
    [{ limitesMB: { video: '100' } }, /entre 1 e 51200/],
  ])('recusa %j', (conteudo, erro) => {
    expect(() => validarConfigArquivo(conteudo)).toThrow(erro);
  });

  it('aceita objeto vazio', () => {
    expect(validarConfigArquivo({})).toEqual({});
  });
});
