import type { RequestHandler } from 'express';

// Só recursos do próprio LocalDrop. O QR Code é uma imagem data: e as miniaturas são blob:.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Cabeçalhos de proteção em todas as respostas. */
export const cabecalhosSeguranca: RequestHandler = (_req, res, next) => {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
};

/**
 * Ações da tela do PC exigem um header customizado. Um site malicioso aberto no
 * navegador do PC não consegue enviá-lo sem permissão de CORS, que o LocalDrop não dá.
 */
export const exigirPaginaDoLocalDrop: RequestHandler = (req, res, next) => {
  if (req.get('x-localdrop') === '1') {
    next();
    return;
  }
  res.status(403).json({ erro: 'Requisição não permitida.' });
};
