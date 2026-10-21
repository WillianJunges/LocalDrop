import { crc32 } from 'node:zlib';

/**
 * Monta um zip simples (sem compressão) em memória, só para os testes.
 * Permite criar docx de mentira, com e sem macro, sem guardar arquivos binários no repositório.
 */
export function criarZip(entradas: Record<string, string>): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let posicao = 0;

  for (const [nome, conteudo] of Object.entries(entradas)) {
    const nomeBytes = Buffer.from(nome, 'utf8');
    const dados = Buffer.from(conteudo, 'utf8');
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBytes.length, 26);
    locais.push(local, nomeBytes, dados);

    const cabecalho = Buffer.alloc(46);
    cabecalho.writeUInt32LE(0x02014b50, 0);
    cabecalho.writeUInt16LE(20, 4);
    cabecalho.writeUInt16LE(20, 6);
    cabecalho.writeUInt16LE(0x0800, 8);
    cabecalho.writeUInt32LE(crc, 16);
    cabecalho.writeUInt32LE(dados.length, 20);
    cabecalho.writeUInt32LE(dados.length, 24);
    cabecalho.writeUInt16LE(nomeBytes.length, 28);
    cabecalho.writeUInt32LE(posicao, 42);
    central.push(cabecalho, nomeBytes);

    posicao += local.length + nomeBytes.length + dados.length;
  }

  const tamanhoCentral = central.reduce((soma, b) => soma + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(entradas).length, 8);
  fim.writeUInt16LE(Object.keys(entradas).length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12);
  fim.writeUInt32LE(posicao, 16);

  return Buffer.concat([...locais, ...central, fim]);
}
