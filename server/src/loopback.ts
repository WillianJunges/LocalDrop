import type { RequestHandler } from 'express';

export function ehLoopback(endereco: string | undefined): boolean {
  if (!endereco) return false;
  return endereco === '::1' || endereco.startsWith('127.') || endereco.startsWith('::ffff:127.');
}

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Confere o header Host além do IP. Sem isso, um site malicioso aberto no
 * navegador do PC poderia usar DNS rebinding para ler o PIN via 127.0.0.1.
 */
export function ehHostLocal(host: string | undefined): boolean {
  if (!host) return false;
  const semPorta = host.toLowerCase().replace(/:\d+$/, '');
  return HOSTS_LOCAIS.has(semPorta);
}

/** Rotas que só respondem para quem está no próprio PC (tela com PIN e QR Code). */
export const somenteNoPc: RequestHandler = (req, res, next) => {
  if (ehLoopback(req.socket.remoteAddress) && ehHostLocal(req.headers.host)) {
    next();
    return;
  }
  res.status(403).json({ erro: 'Disponível apenas no computador onde o LocalDrop está rodando.' });
};
