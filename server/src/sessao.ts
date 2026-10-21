import { randomInt, timingSafeEqual } from 'node:crypto';

/** PIN de 6 dígitos, novo a cada vez que o servidor inicia. */
export function gerarPin(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Compara em tempo constante para não vazar dígitos pelo tempo de resposta. */
export function pinConfere(esperado: string, recebido: unknown): boolean {
  if (typeof recebido !== 'string') return false;

  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}
