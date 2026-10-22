import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarApp } from './app.js';
import { Atividade } from './atividade.js';
import { MonitorPresenca } from './presenca.js';
import { CaixaDeSaida } from './saida.js';

const PIN = '123456';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 3)]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);

let raiz: string;
let saida: CaixaDeSaida;
let encerramentos: number;
let presenca: MonitorPresenca;
let atividade: Atividade;
const CHAVE = 'c'.repeat(64);

beforeEach(async () => {
  raiz = mkdtempSync(path.join(tmpdir(), 'localdrop-saida-teste-'));
  writeFileSync(path.join(raiz, 'index.html'), '<!doctype html>');
  saida = new CaixaDeSaida(path.join(raiz, 'saida'));
  await saida.preparar();
  encerramentos = 0;
  atividade = new Atividade();
  presenca = new MonitorPresenca({ ocupado: () => atividade.emAndamento > 0, aoFecharTudo: () => {} });
});

afterEach(() => rmSync(raiz, { recursive: true, force: true }));

function app() {
  return criarApp({
    sessao: { pin: PIN, porta: 8787, ip: '192.168.0.42', interfaceNome: 'Wi-Fi' },
    pastaClient: raiz,
    pastaRecebidos: raiz,
    saida,
    atividade,
    pc: { chave: CHAVE, presenca, aoEncerrar: () => encerramentos++ },
  });
}

/** Envio pela tela do PC (localhost + header da página). */
function colocarNaSaida(servidor: ReturnType<typeof app>, conteudo: Buffer, nome: string) {
  return request(servidor)
    .post('/api/saida')
    .set('Host', 'localhost:8787')
    .set('X-LocalDrop', '1')
    .attach('arquivo', conteudo, nome);
}

const listarNoCelular = (servidor: ReturnType<typeof app>) =>
  request(servidor).get('/api/disponiveis').set('Host', '192.168.0.42:8787').set('X-LocalDrop-Pin', PIN);

const listarNoPc = (servidor: ReturnType<typeof app>) =>
  request(servidor).get('/api/saida').set('Host', 'localhost:8787');

describe('PC para o celular', () => {
  it('fluxo completo: PC coloca, celular lista e baixa, PC vê que foi baixado', async () => {
    const servidor = app();

    const envio = await colocarNaSaida(servidor, JPEG, 'férias.jpg');
    expect(envio.status).toBe(201);
    expect(envio.body).toEqual({ ok: true, nome: 'férias.jpg', tamanho: JPEG.length, id: expect.any(String) });

    const lista = await listarNoCelular(servidor);
    expect(lista.status).toBe(200);
    const [arquivo] = lista.body.arquivos;
    expect(arquivo).toMatchObject({ nome: 'férias.jpg', tamanho: JPEG.length });
    expect(arquivo.url).toMatch(/^\/api\/baixar\/[\w-]+\?t=[0-9a-f]{64}$/);

    const download = await request(servidor).get(arquivo.url).buffer(true);
    expect(download.status).toBe(200);
    expect(Buffer.from(download.body)).toEqual(JPEG);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['content-disposition']).toContain("filename*=UTF-8''f%C3%A9rias.jpg");
    expect(download.headers['cache-control']).toBe('no-store');

    const noPc = await listarNoPc(servidor);
    expect(noPc.body.arquivos).toEqual([{ id: arquivo.id, nome: 'férias.jpg', tamanho: JPEG.length, downloads: 1 }]);
  });

  it('a lista do PC não expõe o código dos links', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const noPc = await listarNoPc(servidor);
    expect(JSON.stringify(noPc.body)).not.toMatch(/[0-9a-f]{64}/);
  });

  it('celular sem PIN não vê a lista', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const res = await request(servidor).get('/api/disponiveis');
    expect(res.status).toBe(401);
  });

  it('link com código errado ou de outro arquivo não baixa', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'a.jpg');
    await colocarNaSaida(servidor, JPEG, 'b.jpg');
    const [a, b] = (await listarNoCelular(servidor)).body.arquivos;

    const tokenDeB = new URL(b.url, 'http://x').searchParams.get('t');
    expect((await request(servidor).get(`/api/baixar/${a.id}?t=${tokenDeB}`)).status).toBe(404);
    expect((await request(servidor).get(`/api/baixar/${a.id}?t=${'0'.repeat(64)}`)).status).toBe(404);
    expect((await request(servidor).get(`/api/baixar/${a.id}`)).status).toBe(404);
  });

  it('aceita retomar download (Range) sem contar como download novo', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const [arquivo] = (await listarNoCelular(servidor)).body.arquivos;

    const parte = await request(servidor).get(arquivo.url).set('Range', 'bytes=100-199').buffer(true);
    expect(parte.status).toBe(206);
    expect(Buffer.from(parte.body)).toEqual(JPEG.subarray(100, 200));
    expect((await listarNoPc(servidor)).body.arquivos[0].downloads).toBe(0);
  });

  it('usa a mesma lista branca e validação do outro sentido', async () => {
    const servidor = app();
    expect((await colocarNaSaida(servidor, JPEG, 'app.apk')).status).toBe(415);
    expect((await colocarNaSaida(servidor, EXE, 'falso.pdf')).status).toBe(415);
    expect((await listarNoCelular(servidor)).body.arquivos).toEqual([]);
  });

  it('nomes repetidos na saída ganham sufixo', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const nomes = (await listarNoCelular(servidor)).body.arquivos.map((a: { nome: string }) => a.nome);
    expect(nomes).toEqual(['foto.jpg', 'foto (1).jpg']);
  });

  it('remover tira da lista, apaga o arquivo e invalida o link', async () => {
    const servidor = app();
    const { body } = await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const [arquivo] = (await listarNoCelular(servidor)).body.arquivos;

    const res = await request(servidor)
      .delete(`/api/saida/${body.id}`)
      .set('Host', 'localhost:8787')
      .set('X-LocalDrop', '1');

    expect(res.status).toBe(200);
    expect((await listarNoCelular(servidor)).body.arquivos).toEqual([]);
    expect((await request(servidor).get(arquivo.url)).status).toBe(404);
    expect(readdirSync(saida.pasta)).toEqual([]);
  });

  it('celular cancela o recebimento: some da lista dele e da tela do PC', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const [arquivo] = (await listarNoCelular(servidor)).body.arquivos;

    const res = await request(servidor)
      .delete(`/api/disponiveis/${arquivo.id}`)
      .set('Host', '192.168.0.42:8787')
      .set('X-LocalDrop-Pin', PIN);

    expect(res.body).toEqual({ ok: true });
    expect((await listarNoCelular(servidor)).body.arquivos).toEqual([]);
    expect((await listarNoPc(servidor)).body.arquivos).toEqual([]);
    expect(readdirSync(saida.pasta)).toEqual([]);
  });

  it('cancelar recebimento exige o PIN', async () => {
    const servidor = app();
    await colocarNaSaida(servidor, JPEG, 'foto.jpg');
    const [arquivo] = (await listarNoCelular(servidor)).body.arquivos;

    const res = await request(servidor).delete(`/api/disponiveis/${arquivo.id}`).set('X-LocalDrop-Pin', '000000');
    expect(res.status).toBe(401);
    expect((await listarNoCelular(servidor)).body.arquivos).toHaveLength(1);
  });

  it.each([
    ['colocar pela rede', (s: ReturnType<typeof app>) => request(s).post('/api/saida').set('Host', '192.168.0.42:8787').set('X-LocalDrop', '1').attach('arquivo', JPEG, 'x.jpg')],
    ['colocar sem o header da página', (s: ReturnType<typeof app>) => request(s).post('/api/saida').set('Host', 'localhost:8787').attach('arquivo', JPEG, 'x.jpg')],
    ['listar do PC pela rede', (s: ReturnType<typeof app>) => request(s).get('/api/saida').set('Host', '192.168.0.42:8787')],
    ['remover sem o header da página', (s: ReturnType<typeof app>) => request(s).delete('/api/saida/x').set('Host', 'localhost:8787')],
  ])('recusa %s', async (_caso, fazer) => {
    expect((await fazer(app())).status).toBe(403);
  });

  it('esvaziar apaga a pasta temporária', async () => {
    await colocarNaSaida(app(), JPEG, 'foto.jpg');
    saida.esvaziar();
    expect(existsSync(saida.pasta)).toBe(false);
    expect(saida.listar()).toEqual([]);
  });
});

describe('fechar sem terminal', () => {
  const presencaReq = (servidor: ReturnType<typeof app>, corpo: unknown, host = 'localhost:8787') =>
    request(servidor)
      .post('/api/pc/presenca')
      .set('Host', host)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(corpo));

  it('sinal de presença com a chave certa registra a aba', async () => {
    const res = await presencaReq(app(), { aba: 'aba-1', chave: CHAVE });
    expect(res.body).toEqual({ ok: true, transferencias: 0 });
    expect(presenca.abasAbertas).toBe(1);
  });

  it('aviso de aba fechada (sendBeacon) é aceito', async () => {
    const servidor = app();
    await presencaReq(servidor, { aba: 'aba-1', chave: CHAVE });
    const res = await presencaReq(servidor, { aba: 'aba-1', chave: CHAVE, fechou: true });
    expect(res.status).toBe(200);
  });

  it.each([
    ['chave errada', { aba: 'aba-1', chave: 'x'.repeat(64) }, 'localhost:8787'],
    ['sem chave', { aba: 'aba-1' }, 'localhost:8787'],
    ['aba inválida', { aba: '', chave: CHAVE }, 'localhost:8787'],
    ['vindo da rede', { aba: 'aba-1', chave: CHAVE }, '192.168.0.42:8787'],
  ])('recusa presença com %s', async (_caso, corpo, host) => {
    expect((await presencaReq(app(), corpo, host)).status).toBe(403);
    expect(presenca.abasAbertas).toBe(0);
  });

  it('recusa corpo que não é JSON', async () => {
    const res = await request(app())
      .post('/api/pc/presenca')
      .set('Host', 'localhost:8787')
      .set('Content-Type', 'text/plain')
      .send('não é json');
    expect(res.status).toBe(403);
  });

  it('botão Encerrar: responde e só depois encerra', async () => {
    const res = await request(app()).post('/api/encerrar').set('Host', 'localhost:8787').set('X-LocalDrop', '1');
    expect(res.body).toEqual({ ok: true });
    expect(encerramentos).toBe(1);
  });

  it.each([
    ['sem o header da página', 'localhost:8787', false],
    ['pela rede', '192.168.0.42:8787', true],
  ])('Encerrar recusa pedido %s', async (_caso, host, comHeader) => {
    const req = request(app()).post('/api/encerrar').set('Host', host);
    if (comHeader) req.set('X-LocalDrop', '1');
    expect((await req).status).toBe(403);
    expect(encerramentos).toBe(0);
  });

  it('a presença informa transferências em andamento (para o Encerrar confirmar)', async () => {
    const servidor = app();
    const terminar = atividade.iniciar();
    const res = await presencaReq(servidor, { aba: 'aba-1', chave: CHAVE });
    expect(res.body.transferencias).toBe(1);
    terminar();
  });
});
