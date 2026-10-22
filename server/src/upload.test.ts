import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarApp, type OpcoesApp } from './app.js';
import { criarZip } from './teste/zip.js';
import { LIMITES_PADRAO } from './tipos.js';

const PIN = '123456';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]);
const DOCX = criarZip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' });
const DOCX_COM_MACRO = criarZip({
  '[Content_Types].xml': '<Types/>',
  'word/document.xml': '<w:document/>',
  'word/vbaProject.bin': 'macro',
});
const ZIP_COMUM = criarZip({ 'leia-me.txt': 'oi' });

let pasta: string;

beforeEach(() => {
  pasta = mkdtempSync(path.join(tmpdir(), 'localdrop-recebidos-'));
});

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

function app(upload?: OpcoesApp['upload']) {
  return criarApp({
    sessao: { pin: PIN, porta: 8787, ip: '192.168.0.42', interfaceNome: 'Wi-Fi' },
    pastaClient: pasta,
    pastaRecebidos: pasta,
    upload,
  });
}

function enviar(servidor: ReturnType<typeof app>, conteudo: Buffer, nome: string, pin: string | null = PIN) {
  const req = request(servidor).post('/api/upload');
  if (pin !== null) req.set('X-LocalDrop-Pin', pin);
  return req.attach('arquivo', conteudo, nome);
}

const arquivosNaPasta = () => readdirSync(pasta).sort();

describe('PIN', () => {
  it('recusa envio sem PIN', async () => {
    const res = await enviar(app(), JPEG, 'foto.jpg', null);
    expect(res.status).toBe(401);
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa PIN errado', async () => {
    const res = await enviar(app(), JPEG, 'foto.jpg', '000000');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, motivo: expect.stringContaining('PIN incorreto') });
  });

  it('bloqueia o IP depois de 5 PINs errados, mesmo que o próximo esteja certo', async () => {
    const servidor = app();
    for (let i = 0; i < 5; i++) {
      expect((await enviar(servidor, JPEG, 'foto.jpg', '000000')).status).toBe(401);
    }
    const res = await enviar(servidor, JPEG, 'foto.jpg');
    expect(res.status).toBe(429);
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('POST /api/pin confirma o PIN sem enviar arquivo', async () => {
    const servidor = app();
    expect((await request(servidor).post('/api/pin').set('X-LocalDrop-Pin', PIN)).body).toEqual({
      ok: true,
      limites: LIMITES_PADRAO,
    });
    expect((await request(servidor).post('/api/pin').set('X-LocalDrop-Pin', '999999')).status).toBe(401);
    expect((await request(servidor).post('/api/pin')).status).toBe(401);
  });

  it('erros em /api/pin e /api/upload somam para o bloqueio', async () => {
    const servidor = app();
    for (let i = 0; i < 3; i++) await request(servidor).post('/api/pin').set('X-LocalDrop-Pin', '000000');
    for (let i = 0; i < 2; i++) await enviar(servidor, JPEG, 'foto.jpg', '000000');

    expect((await request(servidor).post('/api/pin').set('X-LocalDrop-Pin', PIN)).status).toBe(429);
  });
});

describe('arquivos aceitos', () => {
  it('salva uma imagem e devolve nome e tamanho', async () => {
    const res = await enviar(app(), JPEG, 'foto.jpg');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, nome: 'foto.jpg', tamanho: JPEG.length });
    expect(readFileSync(path.join(pasta, 'foto.jpg'))).toEqual(JPEG);
  });

  it('salva PDF, docx, zip e txt', async () => {
    const servidor = app();
    for (const [conteudo, nome] of [
      [PDF, 'contrato.pdf'],
      [DOCX, 'relatorio.docx'],
      [ZIP_COMUM, 'pacote.zip'],
      [Buffer.from('nome;idade\nJoão;30\n'), 'planilha.csv'],
      [Buffer.from('caf\xe9', 'latin1'), 'ansi.txt'],
    ] as const) {
      const res = await enviar(servidor, conteudo, nome);
      expect(res.status, nome).toBe(201);
    }
    expect(arquivosNaPasta()).toEqual(['ansi.txt', 'contrato.pdf', 'pacote.zip', 'planilha.csv', 'relatorio.docx']);
  });

  it('mantém acentos e emoji no nome', async () => {
    const res = await enviar(app(), JPEG, 'férias 🌴.jpg');
    expect(res.body.nome).toBe('férias 🌴.jpg');
    expect(existsSync(path.join(pasta, 'férias 🌴.jpg'))).toBe(true);
  });

  it.runIf(process.platform === 'win32')('marca o arquivo como baixado da internet', async () => {
    await enviar(app(), PDF, 'contrato.pdf');
    const marca = readFileSync(path.join(pasta, 'contrato.pdf:Zone.Identifier'), 'utf8');
    expect(marca).toContain('ZoneId=3');
  });
});

describe('arquivos recusados', () => {
  it.each(['programa.exe', 'script.bat', 'script.ps1', 'app.apk', 'macro.docm', 'sem-extensao'])(
    'recusa %s pela extensão',
    async (nome) => {
      const res = await enviar(app(), JPEG, nome);
      expect(res.status).toBe(415);
      expect(res.body.motivo).toMatch(/Tipo de arquivo não permitido/);
      expect(arquivosNaPasta()).toEqual([]);
    },
  );

  it('recusa um .exe renomeado para .pdf', async () => {
    const res = await enviar(app(), EXE, 'boleto.pdf');
    expect(res.status).toBe(415);
    expect(res.body.motivo).toBe('O conteúdo do arquivo não corresponde a um .pdf.');
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa um zip comum renomeado para .docx', async () => {
    const res = await enviar(app(), ZIP_COMUM, 'documento.docx');
    expect(res.status).toBe(415);
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa docx com macro', async () => {
    const res = await enviar(app(), DOCX_COM_MACRO, 'documento.docx');
    expect(res.status).toBe(415);
    expect(res.body.motivo).toBe('Documentos com macros não são aceitos.');
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa txt com bytes nulos (binário disfarçado)', async () => {
    const res = await enviar(app(), EXE, 'notas.txt');
    expect(res.status).toBe(415);
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa arquivo vazio', async () => {
    const res = await enviar(app(), Buffer.alloc(0), 'vazio.txt');
    expect(res.status).toBe(400);
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa arquivo acima do limite da categoria e não deixa sobras', async () => {
    const servidor = app({ limites: { ...LIMITES_PADRAO, imagem: 100 } });
    const res = await enviar(servidor, JPEG, 'grande.jpg');

    expect(res.status).toBe(413);
    expect(res.body.motivo).toBe('Arquivo maior que o limite de 100 bytes para imagens.');
    expect(arquivosNaPasta()).toEqual([]);
  });

  it('recusa envio sem arquivo', async () => {
    const res = await request(app()).post('/api/upload').set('X-LocalDrop-Pin', PIN).field('x', 'y');
    expect(res.status).toBe(400);
  });

  it('recusa envio que não é multipart', async () => {
    const res = await request(app()).post('/api/upload').set('X-LocalDrop-Pin', PIN).send({ a: 1 });
    expect(res.status).toBe(400);
  });
});

describe('nomes', () => {
  it.each(['../../fora.jpg', '..\\..\\fora.jpg', 'C:\\Windows\\fora.jpg', '/etc/fora.jpg'])(
    'impede path traversal em %s',
    async (nome) => {
      const res = await enviar(app(), JPEG, nome);
      expect(res.status).toBe(201);
      expect(res.body.nome).toBe('fora.jpg');
      expect(arquivosNaPasta()).toEqual(['fora.jpg']);
    },
  );

  it('nunca sobrescreve: nomes repetidos ganham sufixo', async () => {
    const servidor = app();
    const nomes = [];
    for (let i = 0; i < 3; i++) nomes.push((await enviar(servidor, JPEG, 'foto.jpg')).body.nome);

    expect(nomes).toEqual(['foto.jpg', 'foto (1).jpg', 'foto (2).jpg']);
  });

  it('trata nomes reservados do Windows', async () => {
    const res = await enviar(app(), Buffer.from('oi'), 'CON.txt');
    expect(res.body.nome).toBe('_CON.txt');
  });
});

describe('envios grandes e interrompidos', () => {
  async function ouvir(servidor: ReturnType<typeof app>) {
    const http_ = servidor.listen(0);
    await new Promise((r) => http_.once('listening', r));
    return { http: http_, porta: (http_.address() as AddressInfo).port };
  }

  function iniciarEnvioManual(porta: number, nome: string, tamanhoDeclarado: number) {
    const fronteira = 'fronteiraLocalDrop';
    const cabecalho = Buffer.from(
      `--${fronteira}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    );
    const rodape = Buffer.from(`\r\n--${fronteira}--\r\n`);
    const req = http.request({
      port: porta,
      method: 'POST',
      path: '/api/upload',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${fronteira}`,
        'Content-Length': cabecalho.length + tamanhoDeclarado + rodape.length,
        'X-LocalDrop-Pin': PIN,
      },
    });
    req.on('error', () => {}); // a conexão é derrubada de propósito em alguns testes
    req.write(cabecalho);
    return { req, rodape };
  }

  async function esperarAte(condicao: () => boolean, ms = 3000) {
    const limite = Date.now() + ms;
    while (!condicao()) {
      if (Date.now() > limite) throw new Error('condição não atingida a tempo');
      await esperar(20);
    }
  }

  it('apaga o .part quando a conexão cai no meio do envio', async () => {
    const { http: servidor, porta } = await ouvir(app());
    try {
      const { req } = iniciarEnvioManual(porta, 'video.mp4', 10 * 1024 ** 2);
      const inicioMp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(1024 ** 2)]);
      req.write(inicioMp4);

      await esperarAte(() => arquivosNaPasta().some((n) => n.endsWith('.part')));
      req.destroy();

      await esperarAte(() => arquivosNaPasta().length === 0);
      expect(arquivosNaPasta()).toEqual([]);
    } finally {
      servidor.close();
    }
  });

  it('derruba envio parado por inatividade', async () => {
    const { http: servidor, porta } = await ouvir(app({ inatividadeMs: 200 }));
    try {
      const { req } = iniciarEnvioManual(porta, 'video.mp4', 1024 ** 2);
      req.write(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom')]));

      await esperarAte(() => arquivosNaPasta().some((n) => n.endsWith('.part')));
      await esperarAte(() => arquivosNaPasta().length === 0);
      expect(arquivosNaPasta()).toEqual([]);
      req.destroy();
    } finally {
      servidor.close();
    }
  });

  it('recusa novos envios além do limite simultâneo', async () => {
    const { http: servidor, porta } = await ouvir(app({ maxSimultaneos: 1 }));
    try {
      const { req } = iniciarEnvioManual(porta, 'video.mp4', 1024 ** 2);
      req.write(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom')]));
      await esperarAte(() => arquivosNaPasta().some((n) => n.endsWith('.part')));

      const res = await enviar(app({ maxSimultaneos: 1 }), JPEG, 'foto.jpg');
      expect(res.status).toBe(201); // outra instância não é afetada

      const segundo = await request(servidor).post('/api/upload').set('X-LocalDrop-Pin', PIN).attach('arquivo', JPEG, 'foto.jpg');
      expect(segundo.status).toBe(503);
      req.destroy();
    } finally {
      servidor.close();
    }
  });

  it('grava 300 MB em streaming sem carregar o arquivo na memória', { timeout: 60_000 }, async () => {
    const tamanho = 300 * 1024 ** 2;
    const pedaco = Buffer.alloc(1024 ** 2, 7);
    const { http: servidor, porta } = await ouvir(app());
    try {
      const memoriaAntes = process.memoryUsage().rss;
      let picoMemoria = memoriaAntes;

      const { req, rodape } = iniciarEnvioManual(porta, 'grande.mp4', tamanho);
      const resposta = new Promise<{ status: number; corpo: string }>((resolve) => {
        req.on('response', (res) => {
          let corpo = '';
          res.on('data', (c: Buffer) => (corpo += c.toString()));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, corpo }));
        });
      });

      const primeiro = Buffer.from(pedaco);
      primeiro.write('\x00\x00\x00\x18ftypisom', 0, 'latin1');
      for (let enviado = 0; enviado < tamanho; enviado += pedaco.length) {
        const ok = req.write(enviado === 0 ? primeiro : pedaco);
        if (!ok) await new Promise((r) => req.once('drain', r));
        picoMemoria = Math.max(picoMemoria, process.memoryUsage().rss);
      }
      req.end(rodape);

      const { status, corpo } = await resposta;
      expect(status, corpo).toBe(201);
      expect(statSync(path.join(pasta, 'grande.mp4')).size).toBe(tamanho);
      // Se o arquivo fosse para a memória, o pico passaria de 300 MB.
      expect(picoMemoria - memoriaAntes).toBeLessThan(100 * 1024 ** 2);
    } finally {
      servidor.close();
    }
  });
});
