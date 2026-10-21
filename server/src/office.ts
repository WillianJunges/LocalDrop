import yauzl from 'yauzl';

const PASTA_INTERNA: Readonly<Record<string, string>> = {
  docx: 'word/',
  xlsx: 'xl/',
  pptx: 'ppt/',
};

// Um documento real tem dezenas ou centenas de entradas; muito mais que isso é suspeito.
const MAX_ENTRADAS = 20_000;

export function ehOffice(extensao: string): boolean {
  return Object.hasOwn(PASTA_INTERNA, extensao);
}

/**
 * Confere se um docx/xlsx/pptx é mesmo um documento do Office (OOXML) e não tem macro.
 * Só lê a lista de arquivos do zip: nada é extraído para o disco.
 * Devolve o motivo da recusa, ou null se estiver tudo certo.
 */
export async function motivoOfficeInvalido(caminho: string, extensao: string): Promise<string | null> {
  let nomes: string[];
  try {
    nomes = await listarEntradas(caminho);
  } catch {
    return `O arquivo está corrompido ou não é um .${extensao} válido.`;
  }

  const pasta = PASTA_INTERNA[extensao];
  if (!pasta || !nomes.includes('[Content_Types].xml') || !nomes.some((n) => n.startsWith(pasta))) {
    return `O conteúdo do arquivo não corresponde a um .${extensao}.`;
  }
  if (nomes.some((n) => n.toLowerCase().endsWith('vbaproject.bin'))) {
    return 'Documentos com macros não são aceitos.';
  }
  return null;
}

function listarEntradas(caminho: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(caminho, { lazyEntries: true, autoClose: true }, (erro, zip) => {
      if (erro || !zip) {
        reject(erro ?? new Error('zip inválido'));
        return;
      }
      if (zip.entryCount > MAX_ENTRADAS) {
        zip.close();
        reject(new Error('zip com entradas demais'));
        return;
      }

      const nomes: string[] = [];
      zip.on('entry', (entrada: yauzl.Entry) => {
        nomes.push(entrada.fileName);
        zip.readEntry();
      });
      zip.on('end', () => resolve(nomes));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}
