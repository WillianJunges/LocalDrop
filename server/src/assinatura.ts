/** Quantos bytes do início do arquivo bastam para reconhecer qualquer formato da lista. */
export const BYTES_ASSINATURA = 12;

const ascii = (texto: string) => Array.from(texto, (c) => c.charCodeAt(0));

function comecaCom(inicio: Buffer, bytes: number[], posicao = 0): boolean {
  return bytes.every((byte, i) => inicio[posicao + i] === byte);
}

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"
const ehZip = (b: Buffer) => comecaCom(b, ZIP);
const ehJpeg = (b: Buffer) => comecaCom(b, [0xff, 0xd8, 0xff]);
// MP4 e M4A são contêineres ISO: a caixa "ftyp" aparece no byte 4.
const ehIsoMp4 = (b: Buffer) => comecaCom(b, ascii('ftyp'), 4);

const VERIFICADORES: Readonly<Record<string, (inicio: Buffer) => boolean>> = {
  jpg: ehJpeg,
  jpeg: ehJpeg,
  png: (b) => comecaCom(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: (b) => comecaCom(b, ascii('GIF87a')) || comecaCom(b, ascii('GIF89a')),
  webp: (b) => comecaCom(b, ascii('RIFF')) && comecaCom(b, ascii('WEBP'), 8),
  pdf: (b) => comecaCom(b, ascii('%PDF-')),
  // MP3 com tag ID3 ou começando direto num frame de áudio (11 bits de sincronia).
  mp3: (b) => comecaCom(b, ascii('ID3')) || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0),
  m4a: ehIsoMp4,
  mp4: ehIsoMp4,
  zip: ehZip,
  // Documentos do Office também são zip; a estrutura interna é conferida em office.ts.
  docx: ehZip,
  xlsx: ehZip,
  pptx: ehZip,
};

/** txt e csv não têm assinatura; são validados como texto. */
export function exigeAssinatura(extensao: string): boolean {
  return Object.hasOwn(VERIFICADORES, extensao);
}

export function confereAssinatura(extensao: string, inicio: Buffer): boolean {
  const verificar = Object.hasOwn(VERIFICADORES, extensao) ? VERIFICADORES[extensao] : undefined;
  return verificar ? verificar(inicio) : false;
}
