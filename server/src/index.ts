import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { criarApp } from './app.js';
import { limparTemporarios } from './armazenamento.js';
import { Atividade } from './atividade.js';
import { carregarConfig } from './config.js';
import { consultarInstancia, esperarPortaLivre, pedirEncerramento } from './instancia.js';
import { INTERVALO_VERIFICACAO_MS, MonitorPresenca } from './presenca.js';
import { escolherIpLocal } from './rede.js';
import { CaixaDeSaida } from './saida.js';
import { gerarPin } from './sessao.js';
import { abrirNavegador } from './sistema.js';
import { calcularVersao } from './versao.js';

// Passado pelo atalho da Área de Trabalho (scripts/iniciar.mjs).
const ABRIR_NAVEGADOR = process.argv.includes('--abrir-navegador');

async function iniciar(): Promise<void> {
  const config = carregarConfig();
  mkdirSync(config.pastaRecebidos, { recursive: true });

  const urlPc = `http://localhost:${config.porta}/pc`;
  const rede = escolherIpLocal();
  const pin = gerarPin();
  const versao = calcularVersao();
  const atividade = new Atividade();
  const saida = new CaixaDeSaida(path.join(tmpdir(), `localdrop-saida-${config.porta}`));

  // Definido mais abaixo, depois que o servidor existe; a presença e o botão "Encerrar" usam.
  let encerrar: (motivo: string) => void = () => {};
  const presenca = new MonitorPresenca({
    ocupado: () => atividade.emAndamento > 0,
    aoFecharTudo: () => encerrar('a tela do PC foi fechada'),
  });

  const app = criarApp({
    sessao: {
      pin,
      porta: config.porta,
      ip: rede.escolhido?.endereco ?? null,
      interfaceNome: rede.escolhido?.interfaceNome ?? null,
    },
    pastaClient: config.pastaClient,
    pastaRecebidos: config.pastaRecebidos,
    upload: { limites: config.limites },
    saida,
    atividade,
    pc: {
      chave: randomBytes(32).toString('hex'),
      presenca,
      aoEncerrar: () => encerrar('botão "Encerrar LocalDrop"'),
    },
    versao,
  });

  // Sem host: escuta em todas as interfaces (IPv4 e IPv6), inclusive o Wi-Fi.
  const servidor = app.listen(config.porta);
  // O padrão do Node (5 min) cortaria vídeos grandes; a rota de upload controla a inatividade.
  servidor.requestTimeout = 0;

  servidor.on('listening', async () => {
    // Só agora a porta é deste processo. Limpar antes apagaria os arquivos de um
    // LocalDrop que já estava aberto (ex.: segundo clique no atalho durante um envio).
    const sobras = await limparTemporarios(config.pastaRecebidos);
    if (sobras > 0) console.log(`  ${sobras} envio(s) incompleto(s) da última execução apagado(s).`);
    await saida.preparar();
    setInterval(() => presenca.verificar(), INTERVALO_VERIFICACAO_MS).unref();

    console.log('\n  LocalDrop rodando\n');
    console.log(`  No PC:      ${urlPc}`);
    if (rede.escolhido) {
      console.log(`  No celular: http://${rede.escolhido.endereco}:${config.porta}  (${rede.escolhido.interfaceNome})`);
    } else {
      console.log('  No celular: nenhum IP de rede local encontrado. O PC está conectado ao Wi-Fi?');
    }
    console.log(`  PIN:        ${pin}`);
    console.log(`  Arquivos:   ${config.pastaRecebidos}\n`);

    for (const alt of rede.alternativas) {
      console.log(`  Outro IP possível: ${alt.endereco} (${alt.interfaceNome})`);
    }
    for (const d of rede.descartados) {
      console.log(`  Ignorado: ${d.endereco} (${d.interfaceNome}): ${d.motivo}`);
    }
    console.log('\n  Para encerrar: botão "Encerrar LocalDrop", fechar a tela do PC ou Ctrl+C aqui.\n');

    if (ABRIR_NAVEGADOR) abrirNavegador(urlPc);
  });

  let substituindo = false;
  servidor.on('error', async (erro: NodeJS.ErrnoException) => {
    if (erro.code === 'EADDRINUSE' && !substituindo) {
      const aberto = await consultarInstancia(config.porta);
      if (aberto && aberto.versao === versao) {
        console.log(`\n  O LocalDrop já está aberto em ${urlPc}`);
        if (ABRIR_NAVEGADOR) abrirNavegador(urlPc);
        process.exit(0);
      }
      if (aberto && aberto.transferencias > 0) {
        // Fechar agora interromperia um envio ou download: deixa o antigo terminar.
        console.log('\n  Uma versão antiga do LocalDrop está aberta, com uma transferência em andamento.');
        console.log('  Ela continua aberta. Quando terminar, feche o LocalDrop e abra o atalho de novo.\n');
        if (ABRIR_NAVEGADOR) abrirNavegador(urlPc);
        process.exit(0);
      }
      if (aberto) {
        // Página nova falando com servidor antigo causa erros estranhos: troca pelo novo.
        console.log('\n  Há uma versão antiga do LocalDrop aberta. Fechando para abrir a nova...');
        substituindo = true;
        if ((await pedirEncerramento(config.porta)) && (await esperarPortaLivre(config.porta, 10_000))) {
          servidor.listen(config.porta);
          return;
        }
        console.error(
          '\n  Não consegui fechar a versão antiga. Feche a janela dela (na barra de tarefas) e abra o atalho de novo.\n',
        );
        process.exit(1);
      }
      console.error(
        `\n  A porta ${config.porta} já está em uso por outro programa. Feche-o ou troque a porta no localdrop.json.\n`,
      );
    } else if (erro.code === 'EACCES') {
      console.error(`\n  Sem permissão para usar a porta ${config.porta}. Troque a porta no localdrop.json.\n`);
    } else {
      console.error('\n  Não foi possível iniciar o LocalDrop:', erro.message, '\n');
    }
    process.exit(1);
  });

  let encerrando = false;
  encerrar = (motivo: string) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`\n  Encerrando (${motivo})...`);
    const sair = () => {
      saida.esvaziar();
      process.exit(0);
    };
    servidor.close(sair);
    servidor.closeIdleConnections();
    // Se alguma conexão travar o encerramento, sai mesmo assim.
    setTimeout(sair, 5000).unref();
  };
  process.on('SIGINT', () => encerrar('Ctrl+C'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  // Fechar a janela do terminal no Windows.
  process.on('SIGHUP', () => encerrar('janela fechada'));
}

iniciar().catch((erro: unknown) => {
  console.error('\n  Não foi possível iniciar o LocalDrop:', erro instanceof Error ? erro.message : erro, '\n');
  process.exit(1);
});
