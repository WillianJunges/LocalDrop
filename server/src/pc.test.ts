import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { criarApp } from './app.js';
import { LIMITES_PADRAO } from './tipos.js';

const pasta = mkdtempSync(path.join(tmpdir(), 'localdrop-pc-'));
writeFileSync(path.join(pasta, 'index.html'), '<!doctype html><title>LocalDrop</title>');
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

function criar(opcoes: { abertas?: string[]; limites?: typeof LIMITES_PADRAO } = {}) {
  return criarApp({
    sessao: { pin: '123456', porta: 8787, ip: '192.168.0.42', interfaceNome: 'Wi-Fi' },
    pastaClient: pasta,
    pastaRecebidos: pasta,
    upload: opcoes.limites ? { limites: opcoes.limites } : undefined,
    abrirPasta: (alvo) => {
      opcoes.abertas?.push(alvo);
      return true;
    },
  });
}

describe('POST /api/abrir-pasta', () => {
  it('abre a pasta de recebidos quando pedido pela tela do PC', async () => {
    const abertas: string[] = [];
    const res = await request(criar({ abertas }))
      .post('/api/abrir-pasta')
      .set('Host', 'localhost:8787')
      .set('X-LocalDrop', '1');

    expect(res.status).toBe(200);
    expect(abertas).toEqual([pasta]);
  });

  it('recusa sem o header da página (proteção contra CSRF)', async () => {
    const abertas: string[] = [];
    const res = await request(criar({ abertas })).post('/api/abrir-pasta').set('Host', 'localhost:8787');

    expect(res.status).toBe(403);
    expect(abertas).toEqual([]);
  });

  it('recusa pedido vindo da rede', async () => {
    const abertas: string[] = [];
    const res = await request(criar({ abertas }))
      .post('/api/abrir-pasta')
      .set('Host', '192.168.0.42:8787')
      .set('X-LocalDrop', '1');

    expect(res.status).toBe(403);
    expect(abertas).toEqual([]);
  });
});

describe('POST /api/pin', () => {
  it('devolve os limites configurados para o celular avisar na seleção', async () => {
    const limites = { ...LIMITES_PADRAO, video: 8 * 1024 ** 3 };
    const res = await request(criar({ limites })).post('/api/pin').set('X-LocalDrop-Pin', '123456');
    expect(res.body).toEqual({ ok: true, limites });
  });
});

describe('cabeçalhos de segurança', () => {
  it.each(['/', '/api/nada', '/assets/x.js'])('estão presentes em %s', async (rota) => {
    const res = await request(criar()).get(rota);

    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });
});
