import type { RequestHandler } from 'express';
import { pinConfere } from './sessao.js';
import type { ControleTentativas } from './tentativas.js';

/**
 * Exige o PIN no header X-LocalDrop-Pin. Responde antes de ler o corpo,
 * fechando a conexão para não receber o resto de um upload recusado.
 */
export function exigirPin(pin: string, tentativas: ControleTentativas): RequestHandler {
  return (req, res, next) => {
    const ip = req.socket.remoteAddress ?? 'desconhecido';

    const bloqueio = tentativas.bloqueadoPor(ip);
    if (bloqueio > 0) {
      res
        .set('Connection', 'close')
        .status(429)
        .json({
          ok: false,
          motivo: `Muitas tentativas com PIN errado. Tente de novo em ${Math.ceil(bloqueio / 60_000)} min.`,
        });
      return;
    }

    if (!pinConfere(pin, req.get('x-localdrop-pin'))) {
      tentativas.registrarErro(ip);
      res
        .set('Connection', 'close')
        .status(401)
        .json({ ok: false, motivo: 'PIN incorreto. Confira o PIN na tela do computador.' });
      return;
    }

    tentativas.limpar(ip);
    next();
  };
}
