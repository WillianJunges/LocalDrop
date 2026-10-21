import { mkdirSync } from 'node:fs';
import { criarApp } from './app.js';
import { limparTemporarios } from './armazenamento.js';
import { carregarConfig } from './config.js';
import { escolherIpLocal } from './rede.js';
import { gerarPin } from './sessao.js';

async function iniciar(): Promise<void> {
  const config = carregarConfig();
  mkdirSync(config.pastaRecebidos, { recursive: true });
  const sobras = await limparTemporarios(config.pastaRecebidos);
  if (sobras > 0) console.log(`  ${sobras} envio(s) incompleto(s) da última execução apagado(s).`);

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
  });

  // Sem host: escuta em todas as interfaces (IPv4 e IPv6), inclusive o Wi-Fi.
  const servidor = app.listen(config.porta);
  // O padrão do Node (5 min) cortaria vídeos grandes; a rota de upload controla a inatividade.
  servidor.requestTimeout = 0;

  servidor.on('listening', () => {
    console.log('\n  LocalDrop rodando\n');
    console.log(`  No PC:      http://localhost:${config.porta}/pc`);
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
    console.log('\n  Ctrl+C para encerrar.\n');
  });

  servidor.on('error', (erro: NodeJS.ErrnoException) => {
    if (erro.code === 'EADDRINUSE') {
      console.error(`\n  A porta ${config.porta} já está em uso. Feche o outro programa ou defina LOCALDROP_PORTA.\n`);
    } else if (erro.code === 'EACCES') {
      console.error(`\n  Sem permissão para usar a porta ${config.porta}. Tente outra com LOCALDROP_PORTA.\n`);
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
