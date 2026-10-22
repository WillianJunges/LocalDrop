import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { criarApp } from './app.js';
import { LIMITES_PADRAO } from './tipos.js';

const pastaClient = mkdtempSync(path.join(tmpdir(), 'localdrop-client-'));
writeFileSync(path.join(pastaClient, 'index.html'), '<!doctype html><title>LocalDrop</title>');

const app = criarApp({
  sessao: { pin: '123456', porta: 8787, ip: '192.168.0.42', interfaceNome: 'Wi-Fi' },
  pastaClient,
  pastaRecebidos: pastaClient,
});

afterAll(() => rmSync(pastaClient, { recursive: true, force: true }));

describe('GET /api/sessao', () => {
  it('devolve PIN e endereços para o próprio PC', async () => {
    const res = await request(app).get('/api/sessao').set('Host', 'localhost:8787');

    expect(res.status).toBe(200);
    expect(res.body.chavePc).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body).toEqual({
      chavePc: res.body.chavePc,
      pin: '123456',
      enderecoCelular: 'http://192.168.0.42:8787',
      urlQrCode: 'http://192.168.0.42:8787/#pin=123456',
      interfaceNome: 'Wi-Fi',
      pasta: pastaClient,
      limites: LIMITES_PADRAO,
    });
  });

  it('recusa Host desconhecido (proteção contra DNS rebinding)', async () => {
    const res = await request(app).get('/api/sessao').set('Host', 'site-malicioso.com:8787');

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('pin');
  });

  it('recusa acesso pelo IP da rede', async () => {
    const res = await request(app).get('/api/sessao').set('Host', '192.168.0.42:8787');
    expect(res.status).toBe(403);
  });
});

describe('páginas', () => {
  it('serve a página do celular em /', async () => {
    const res = await request(app).get('/').set('Host', '192.168.0.42:8787');
    expect(res.status).toBe(200);
    expect(res.text).toContain('LocalDrop');
  });

  it('bloqueia a tela do PC para quem acessa pela rede', async () => {
    const res = await request(app).get('/pc').set('Host', '192.168.0.42:8787');
    expect(res.status).toBe(403);
  });

  it('serve a tela do PC no próprio PC', async () => {
    const res = await request(app).get('/pc').set('Host', 'localhost:8787');
    expect(res.status).toBe(200);
  });

  it('avisa quando a interface não foi compilada', async () => {
    const semBuild = criarApp({
      sessao: { pin: '123456', porta: 8787, ip: null, interfaceNome: null },
      pastaClient: path.join(pastaClient, 'nao-existe'),
      pastaRecebidos: pastaClient,
    });
    const res = await request(semBuild).get('/');
    expect(res.status).toBe(503);
  });
});

describe('respostas gerais', () => {
  it('rota de API desconhecida devolve 404 em JSON', async () => {
    const res = await request(app).get('/api/nada');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: 'Rota não encontrada.' });
  });

  it('não expõe o header X-Powered-By', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('asset inexistente devolve 404 sem expor caminhos', async () => {
    const res = await request(app).get('/assets/nao-existe.js');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body) + res.text).not.toContain(pastaClient);
  });
});
