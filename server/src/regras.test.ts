import { describe, expect, it } from 'vitest';
import { confereAssinatura, exigeAssinatura } from './assinatura.js';
import { nomeComSufixo, sanitizarNome } from './nomes.js';
import { ControleTentativas } from './tentativas.js';
import { categoriaDe, extensaoDe, formatarBytes } from './tipos.js';
import { pareceTexto } from './validacao.js';

describe('tipos', () => {
  it('reconhece extensões aceitas sem diferenciar maiúsculas', () => {
    expect(categoriaDe(extensaoDe('FOTO.JPG'))).toBe('imagem');
    expect(categoriaDe(extensaoDe('video.mp4'))).toBe('video');
    expect(categoriaDe(extensaoDe('a.tar.zip'))).toBe('compactado');
  });

  it.each(['exe', 'constructor', '__proto__', 'toString', ''])('recusa "%s"', (ext) => {
    expect(categoriaDe(ext)).toBeNull();
  });

  it('arquivo oculto sem extensão não tem extensão', () => {
    expect(extensaoDe('.jpg')).toBe('');
  });

  it('formata tamanhos', () => {
    expect(formatarBytes(50 * 1024 ** 2)).toBe('50 MB');
    expect(formatarBytes(4 * 1024 ** 3)).toBe('4 GB');
    expect(formatarBytes(1536)).toBe('1.5 KB');
  });
});

describe('assinatura', () => {
  const b = (...bytes: number[]) => Buffer.from(bytes);
  const s = (texto: string) => Buffer.from(texto, 'latin1');

  it.each([
    ['jpg', b(0xff, 0xd8, 0xff, 0xdb)],
    ['png', b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['gif', s('GIF89a')],
    ['webp', s('RIFF\x10\x00\x00\x00WEBP')],
    ['pdf', s('%PDF-1.4')],
    ['mp3', s('ID3\x04')],
    ['mp3', b(0xff, 0xfb, 0x90)],
    ['mp4', s('\x00\x00\x00\x18ftypmp42')],
    ['m4a', s('\x00\x00\x00\x20ftypM4A ')],
    ['zip', s('PK\x03\x04')],
  ])('aceita %s legítimo', (ext, inicio) => {
    expect(confereAssinatura(ext, inicio)).toBe(true);
  });

  it.each([
    ['jpg', s('MZ\x90\x00')],
    ['pdf', s('PK\x03\x04')],
    ['png', s('GIF89a')],
    ['webp', s('RIFF\x10\x00\x00\x00AVI ')],
    ['mp4', s('MZ\x90\x00\x00\x00\x00\x00')],
    ['zip', s('PK\x05\x06')], // zip vazio
  ])('recusa %s falso', (ext, inicio) => {
    expect(confereAssinatura(ext, inicio)).toBe(false);
  });

  it('txt e csv não usam assinatura', () => {
    expect(exigeAssinatura('txt')).toBe(false);
    expect(exigeAssinatura('csv')).toBe(false);
    expect(exigeAssinatura('pdf')).toBe(true);
  });
});

describe('pareceTexto', () => {
  it('aceita UTF-8, ANSI, tabs e quebras de linha', () => {
    expect(pareceTexto(Buffer.from('olá\tmundo\r\n'))).toBe(true);
    expect(pareceTexto(Buffer.from('caf\xe9', 'latin1'))).toBe(true);
  });

  it('recusa byte nulo e caracteres de controle', () => {
    expect(pareceTexto(Buffer.from([0x61, 0x00, 0x62]))).toBe(false);
    expect(pareceTexto(Buffer.from([0x61, 0x07]))).toBe(false);
  });
});

describe('sanitizarNome', () => {
  it.each([
    ['foto.jpg', 'foto.jpg'],
    ['../../segredo.jpg', 'segredo.jpg'],
    ['..\\..\\Windows\\system.pdf', 'system.pdf'],
    ['a<b>c:d"e|f?g*.txt', 'a_b_c_d_e_f_g_.txt'],
    ['  espaços   demais  .pdf', 'espaços demais.pdf'],
    ['final com ponto.pdf...', 'final com ponto.pdf'],
    ['.oculto', 'oculto'],
    ['..', 'arquivo'],
    ['', 'arquivo'],
    ['NUL.txt', '_NUL.txt'],
    ['com1.tar.zip', '_com1.tar.zip'],
    ['console.txt', 'console.txt'],
    ['linha\nquebrada.txt', 'linha_quebrada.txt'],
  ])('%j vira %j', (entrada, esperado) => {
    expect(sanitizarNome(entrada)).toBe(esperado);
  });

  it('limita o tamanho sem perder a extensão nem quebrar emoji', () => {
    const nome = sanitizarNome(`${'🌴'.repeat(300)}.jpg`);
    expect(nome.endsWith('.jpg')).toBe(true);
    expect(Array.from(nome).length).toBeLessThanOrEqual(150);
    expect(nome).not.toContain('�');
  });

  it('coloca o sufixo antes da extensão', () => {
    expect(nomeComSufixo('foto.jpg', 2)).toBe('foto (2).jpg');
    expect(nomeComSufixo('LEIAME', 1)).toBe('LEIAME (1)');
  });
});

describe('ControleTentativas', () => {
  it('bloqueia após 5 erros e libera depois do tempo', () => {
    let agora = 0;
    const controle = new ControleTentativas(5, 60_000, () => agora);

    for (let i = 0; i < 4; i++) controle.registrarErro('ip');
    expect(controle.bloqueadoPor('ip')).toBe(0);

    controle.registrarErro('ip');
    expect(controle.bloqueadoPor('ip')).toBe(60_000);
    expect(controle.bloqueadoPor('outro-ip')).toBe(0);

    agora = 60_000;
    expect(controle.bloqueadoPor('ip')).toBe(0);
  });

  it('acerto zera a contagem', () => {
    const controle = new ControleTentativas(2, 1000, () => 0);
    controle.registrarErro('ip');
    controle.limpar('ip');
    controle.registrarErro('ip');
    expect(controle.bloqueadoPor('ip')).toBe(0);
  });
});
