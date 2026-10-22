import { describe, expect, it } from 'vitest';
import { type EstadoFila, FILA_VAZIA, itensParaEnviar, reduzirFila } from './fila';
import { formatarDuracao, MedidorVelocidade, tempoRestante } from './medidor';
import { ACEITOS_ARQUIVOS, avaliarArquivo, LIMITES_PADRAO } from './regras';

const arquivo = (nome: string, tamanho = 100, lastModified = 1) =>
  new File([new Uint8Array(tamanho)], nome, { lastModified });

describe('avaliarArquivo', () => {
  it('aceita tipos da lista dentro do limite', () => {
    expect(avaliarArquivo('foto.JPG', 1000)).toEqual({ categoria: 'imagem', problema: null });
    expect(avaliarArquivo('video.mp4', 3 * 1024 ** 3).problema).toBeNull();
  });

  it('avisa tipo proibido, arquivo vazio e limite estourado', () => {
    expect(avaliarArquivo('app.apk', 10).problema).toBe('Tipo de arquivo não permitido (.apk).');
    expect(avaliarArquivo('nota.txt', 0).problema).toBe('O arquivo está vazio.');
    expect(avaliarArquivo('foto.png', 51 * 1024 ** 2).problema).toBe('Maior que o limite de 50 MB para imagens.');
  });

  it('usa os limites configurados no PC quando informados', () => {
    const limites = { ...LIMITES_PADRAO, imagem: 1024 };
    expect(avaliarArquivo('foto.png', 2048, limites).problema).toBe('Maior que o limite de 1 KB para imagens.');
  });

  it('o seletor de arquivos usa a mesma lista do servidor', () => {
    expect(ACEITOS_ARQUIVOS.split(',')).toContain('.docx');
    expect(ACEITOS_ARQUIVOS.split(',')).not.toContain('.exe');
  });
});

describe('fila de envio', () => {
  const comArquivos = (...arquivos: File[]) => reduzirFila(FILA_VAZIA, { tipo: 'adicionar', arquivos });

  it('soma seleções em várias rodadas e ignora o mesmo arquivo repetido', () => {
    const foto = arquivo('foto.jpg');
    let estado = comArquivos(foto, arquivo('doc.pdf'));
    estado = reduzirFila(estado, { tipo: 'adicionar', arquivos: [foto, arquivo('video.mp4')] });

    expect(estado.itens.map((i) => i.arquivo.name)).toEqual(['foto.jpg', 'doc.pdf', 'video.mp4']);
    expect(estado.itens.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('marca como recusado já na seleção o que não pode ir', () => {
    const estado = comArquivos(arquivo('foto.jpg'), arquivo('virus.exe'));
    expect(estado.itens.map((i) => i.status)).toEqual(['pronto', 'recusado']);
    expect(itensParaEnviar(estado).map((i) => i.arquivo.name)).toEqual(['foto.jpg']);
  });

  it('arquivo enviado sai da lista e vai para os enviados', () => {
    let estado = comArquivos(arquivo('foto.jpg', 500), arquivo('doc.pdf'));
    estado = reduzirFila(estado, { tipo: 'iniciar', id: 1 });
    estado = reduzirFila(estado, { tipo: 'progresso', id: 1, bytesEnviados: 250 });
    expect(estado.itens[0]).toMatchObject({ status: 'enviando', bytesEnviados: 250 });

    estado = reduzirFila(estado, { tipo: 'concluir', id: 1, nomeSalvo: 'foto (1).jpg' });

    expect(estado.itens.map((i) => i.arquivo.name)).toEqual(['doc.pdf']);
    expect(estado.enviados).toEqual([{ id: 1, nomeOriginal: 'foto.jpg', nomeSalvo: 'foto (1).jpg', tamanho: 500 }]);
  });

  it('falha temporária pode ser reenviada; recusa definitiva não', () => {
    let estado: EstadoFila = comArquivos(arquivo('a.jpg'), arquivo('b.pdf'));
    estado = reduzirFila(estado, { tipo: 'falhar', id: 1, motivo: 'Wi-Fi caiu', definitivo: false });
    estado = reduzirFila(estado, { tipo: 'falhar', id: 2, motivo: 'Conteúdo falso', definitivo: true });

    expect(estado.itens.map((i) => i.status)).toEqual(['falhou', 'recusado']);
    expect(itensParaEnviar(estado).map((i) => i.id)).toEqual([1]);

    estado = reduzirFila(estado, { tipo: 'removerRecusados' });
    expect(estado.itens.map((i) => i.id)).toEqual([1]);
  });

  it('cancelar devolve o item para a fila', () => {
    let estado = comArquivos(arquivo('a.jpg'));
    estado = reduzirFila(estado, { tipo: 'iniciar', id: 1 });
    estado = reduzirFila(estado, { tipo: 'devolver', id: 1 });
    expect(estado.itens[0]).toMatchObject({ status: 'pronto', bytesEnviados: 0 });
  });

  it('não remove o arquivo que está sendo enviado', () => {
    let estado = comArquivos(arquivo('a.jpg'), arquivo('b.jpg'));
    estado = reduzirFila(estado, { tipo: 'iniciar', id: 1 });
    estado = reduzirFila(estado, { tipo: 'remover', id: 1 });
    estado = reduzirFila(estado, { tipo: 'remover', id: 2 });
    expect(estado.itens.map((i) => i.id)).toEqual([1]);
  });
});

describe('medidor de velocidade', () => {
  it('calcula a média da janela e ignora amostras antigas', () => {
    const medidor = new MedidorVelocidade(3000);
    medidor.registrar(0, 0);
    expect(medidor.bytesPorSegundo()).toBeNull();

    medidor.registrar(1000, 1_000_000);
    expect(medidor.bytesPorSegundo()).toBe(1_000_000);

    // Wi-Fi ficou mais lento: depois de 3 s, só o trecho recente conta.
    medidor.registrar(5000, 2_000_000);
    medidor.registrar(7000, 3_000_000);
    expect(medidor.bytesPorSegundo()).toBe(500_000);
  });

  it('estima o tempo restante', () => {
    expect(tempoRestante(10_000_000, 2_000_000)).toBe(5);
    expect(tempoRestante(10, null)).toBeNull();
  });

  it('formata durações', () => {
    expect(formatarDuracao(42)).toBe('42 s');
    expect(formatarDuracao(185)).toBe('3 min 05 s');
    expect(formatarDuracao(3720)).toBe('1 h 02 min');
  });
});
