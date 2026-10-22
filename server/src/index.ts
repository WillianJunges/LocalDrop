import { mkdirSync } from 'node:fs';
import http from 'node:http';
import { criarApp } from './app.js';
import { limparTemporarios } from './armazenamento.js';
import { carregarConfig } from './config.js';
import { escolherIpLocal } from './rede.js';
import { gerarPin } from './sessao.js';
import { abrirNavegador } from './sistema.js';

// Passado pelo atalho da Área de Trabalho (scripts/iniciar.mjs).
const ABRIR_NAVEGADOR = process.argv.includes('--abrir-navegador');

/**
 * Confere se quem está na porta é um LocalDrop (aberto antes por outro clique no atalho).
 * Usa node:http e não fetch: no Windows, process.exit() logo após um fetch derruba o Node
 * com "Assertion failed ... async.c" (bug do Node).
 */
function localDropJaRodando(porta: number): Promise<boolean> {
  return new Promise((resolve) => {
    const requisicao = http.get(`http://localhost:${porta}/api/sessao`, { timeout: 2000, agent: false }, (resposta) => {
      let corpo = '';
      resposta.on('data', (parte: Buffer) => (corpo += parte.toString()));
      resposta.on('end', () => {
        try {
          resolve(resposta.statusCode === 200 && typeof (JSON.parse(corpo) as { pin?: unknown }).pin === 'string');
        } catch {
          resolve(false); // respondeu algo que não é JSON: é outro programa
        }
      });
    });
    requisicao.on('timeout', () => requisicao.destroy());
    requisicao.on('error', () => resolve(false));
  });
}

async function iniciar(): Promise<void> {
  const config = carregarConfig();
  mkdirSync(config.pastaRecebidos, { recursive: true });
  const sobras = await limparTemporarios(config.pastaRecebidos);
  if (sobras > 0) console.log(`  ${sobras} envio(s) incompleto(s) da última execução apagado(s).`);

  const urlPc = `http://localhost:${config.porta}/pc`;
  const rede = escolherIpLocal();
  const pin = gerarPin();
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
  });

  // Sem host: escuta em todas as interfaces (IPv4 e IPv6), inclusive o Wi-Fi.
  const servidor = app.listen(config.porta);
  // O padrão do Node (5 min) cortaria vídeos grandes; a rota de upload controla a inatividade.
  servidor.requestTimeout = 0;

  servidor.on('listening', () => {
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
    console.log('\n  Para encerrar: Ctrl+C ou feche esta janela.\n');

    if (ABRIR_NAVEGADOR) abrirNavegador(urlPc);
  });

  servidor.on('error', async (erro: NodeJS.ErrnoException) => {
    if (erro.code === 'EADDRINUSE') {
      if (await localDropJaRodando(config.porta)) {
        console.log(`\n  O LocalDrop já está aberto em ${urlPc}`);
        if (ABRIR_NAVEGADOR) abrirNavegador(urlPc);
        process.exit(0);
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
  const encerrar = (sinal: string) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`\n  Encerrando (${sinal})...`);
    servidor.close(() => process.exit(0));
    servidor.closeIdleConnections();
    // Se alguma conexão travar o encerramento, sai mesmo assim.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
}

iniciar().catch((erro: unknown) => {
  console.error('\n  Não foi possível iniciar o LocalDrop:', erro instanceof Error ? erro.message : erro, '\n');
  process.exit(1);
});
