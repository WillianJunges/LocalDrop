// Usado pelo atalho da Área de Trabalho (LocalDrop.bat).
// Instala as dependências e compila só quando precisa, depois inicia o servidor
// e abre a tela do PC no navegador.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = path.resolve(import.meta.dirname, '..');
const daRaiz = (...partes) => path.join(raiz, ...partes);

function rodarNpm(argumentos, mensagem) {
  console.log(`\n  ${mensagem}...\n`);
  // shell: true é necessário para rodar o npm.cmd no Windows. O comando é montado aqui,
  // com argumentos fixos, nunca com texto vindo de fora.
  const resultado = spawnSync(`npm ${argumentos.join(' ')}`, { cwd: raiz, stdio: 'inherit', shell: true });
  if (resultado.status !== 0) {
    console.error(`\n  Falhou: npm ${argumentos.join(' ')}`);
    process.exit(resultado.status ?? 1);
  }
}

/** Data de modificação mais recente entre arquivos e pastas (recursivo). */
function maisRecente(caminhos) {
  let maior = 0;
  for (const caminho of caminhos) {
    if (!existsSync(caminho)) continue;
    const info = statSync(caminho);
    if (info.isDirectory()) {
      const filhos = readdirSync(caminho).map((nome) => path.join(caminho, nome));
      maior = Math.max(maior, maisRecente(filhos));
    } else {
      maior = Math.max(maior, info.mtimeMs);
    }
  }
  return maior;
}

const marcaInstalacao = daRaiz('node_modules', '.package-lock.json');
if (!existsSync(marcaInstalacao) || maisRecente([daRaiz('package-lock.json')]) > maisRecente([marcaInstalacao])) {
  rodarNpm(['install'], 'Instalando dependências (só na primeira vez ou após atualizar)');
}

const saidas = [daRaiz('client', 'dist', 'index.html'), daRaiz('server', 'dist', 'index.js')];
const fontes = [
  daRaiz('client', 'src'),
  daRaiz('client', 'index.html'),
  daRaiz('server', 'src'),
  daRaiz('package-lock.json'),
];
const buildAntigo = saidas.some((saida) => !existsSync(saida)) || maisRecente(fontes) > Math.min(...saidas.map((s) => maisRecente([s])));
if (buildAntigo) {
  rodarNpm(['run', 'build'], 'Compilando o LocalDrop');
}

// Roda o servidor neste mesmo processo: Ctrl+C ou fechar a janela encerra tudo.
process.argv.push('--abrir-navegador');
await import(pathToFileURL(daRaiz('server', 'dist', 'index.js')).href);
