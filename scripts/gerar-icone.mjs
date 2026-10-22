// Gera scripts/localdrop.ico (ícone do atalho) com o mesmo desenho de client/src/assets/icone.svg.
// O resultado já está no repositório; rode de novo só se mudar o desenho: npm run icone
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const AZUL = [0x0b, 0x63, 0xc5];
const BRANCO = [0xff, 0xff, 0xff];

// Mesmas formas do SVG, em coordenadas de 0 a 100.
const dentroRetangulo = (x, y, x0, y0, l, a) => x >= x0 && x <= x0 + l && y >= y0 && y <= y0 + a;

function dentroRetanguloArredondado(x, y, x0, y0, l, a, r) {
  const cx = Math.min(Math.max(x, x0 + r), x0 + l - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + a - r);
  return dentroRetangulo(x, y, x0, y0, l, a) && (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

function dentroTriangulo(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const lado = (px, py, qx, qy) => (x - qx) * (py - qy) - (px - qx) * (y - qy);
  const d1 = lado(ax, ay, bx, by);
  const d2 = lado(bx, by, cx, cy);
  const d3 = lado(cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function corNoPonto(x, y) {
  if (!dentroRetanguloArredondado(x, y, 4, 4, 92, 92, 22)) return null;
  const branco =
    dentroRetangulo(x, y, 44, 20, 12, 30) ||
    dentroTriangulo(x, y, [28, 46], [72, 46], [50, 68]) ||
    dentroRetangulo(x, y, 24, 74, 52, 8) ||
    dentroRetangulo(x, y, 24, 60, 8, 22) ||
    dentroRetangulo(x, y, 68, 60, 8, 22);
  return branco ? BRANCO : AZUL;
}

/** Desenha em RGBA com 4x4 amostras por pixel (bordas suaves). */
function desenhar(tamanho) {
  const AMOSTRAS = 4;
  const pixels = Buffer.alloc(tamanho * tamanho * 4);
  for (let py = 0; py < tamanho; py++) {
    for (let px = 0; px < tamanho; px++) {
      let r = 0, g = 0, b = 0, cobertura = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const cor = corNoPonto(((px + (sx + 0.5) / AMOSTRAS) / tamanho) * 100, ((py + (sy + 0.5) / AMOSTRAS) / tamanho) * 100);
          if (!cor) continue;
          r += cor[0];
          g += cor[1];
          b += cor[2];
          cobertura++;
        }
      }
      const i = (py * tamanho + px) * 4;
      if (cobertura > 0) {
        pixels[i] = Math.round(r / cobertura);
        pixels[i + 1] = Math.round(g / cobertura);
        pixels[i + 2] = Math.round(b / cobertura);
        pixels[i + 3] = Math.round((cobertura / AMOSTRAS ** 2) * 255);
      }
    }
  }
  return pixels;
}

function blocoPng(tipo, dados) {
  const tipoEDados = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tipoEDados));
  return Buffer.concat([tamanho, tipoEDados, crc]);
}

function png(tamanho) {
  const pixels = desenhar(tamanho);
  const linhas = Buffer.alloc(tamanho * (tamanho * 4 + 1));
  for (let y = 0; y < tamanho; y++) {
    pixels.copy(linhas, y * (tamanho * 4 + 1) + 1, y * tamanho * 4, (y + 1) * tamanho * 4); // filtro 0
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(tamanho, 0);
  cabecalho.writeUInt32BE(tamanho, 4);
  cabecalho.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocoPng('IHDR', cabecalho),
    blocoPng('IDAT', deflateSync(linhas)),
    blocoPng('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO com PNGs dentro (aceito pelo Windows desde o Vista). */
function ico(tamanhos) {
  const imagens = tamanhos.map(png);
  const cabecalho = Buffer.alloc(6 + 16 * tamanhos.length);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(tamanhos.length, 4);
  let posicao = cabecalho.length;
  tamanhos.forEach((tamanho, i) => {
    const entrada = 6 + i * 16;
    cabecalho[entrada] = tamanho >= 256 ? 0 : tamanho;
    cabecalho[entrada + 1] = tamanho >= 256 ? 0 : tamanho;
    cabecalho.writeUInt16LE(1, entrada + 4);
    cabecalho.writeUInt16LE(32, entrada + 6);
    cabecalho.writeUInt32LE(imagens[i].length, entrada + 8);
    cabecalho.writeUInt32LE(posicao, entrada + 12);
    posicao += imagens[i].length;
  });
  return Buffer.concat([cabecalho, ...imagens]);
}

const destino = path.join(import.meta.dirname, 'localdrop.ico');
writeFileSync(destino, ico([16, 24, 32, 48, 64, 256]));
console.log(`Ícone gerado: ${destino}`);
