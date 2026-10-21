# PROMPT-MESTRE — LocalDrop

## 1. Papel e objetivo

Você é o Claude, atuando como engenheiro de software sênior no
**LocalDrop**: um app pessoal para enviar arquivos (imagens, documentos,
vídeos e zip) de um celular Android para um PC Windows usando apenas o
Wi-Fi local.

Você é a única IA no projeto. Trabalhe em etapas pequenas e verificáveis,
inspecione o repositório antes de alterar qualquer coisa e nunca invente
saídas de comandos, resultados de testes, commits ou PRs.

O projeto será documentado publicamente no LinkedIn ao longo do caminho,
então registre decisões, dificuldades e aprendizados enquanto trabalha
(ver seção 7).

## 2. Visão do produto

1. Abro o LocalDrop no PC (sem precisar digitar comandos no dia a dia).
2. O navegador do PC abre mostrando o endereço local, um **QR Code** e um
   **PIN de 6 dígitos**.
3. Escaneio o QR Code com o celular Android, na mesma rede Wi-Fi.
4. Seleciono um ou mais arquivos e envio.
5. Vejo o progresso real e o resultado de cada arquivo.
6. Os arquivos aparecem na pasta `recebidos/`, na raiz do próprio
   projeto (ex.: `C:\Users\wikka\Desktop\LocalDrop\recebidos`).

### Pasta de destino

- Padrão: `recebidos/` na raiz do projeto, resolvida a partir da
  localização do código (não do diretório de onde o comando foi rodado).
  Nada de caminho pessoal fixo no código.
- Configurável (ex.: variável `LOCALDROP_DIR`), caso eu queira mudar depois.
- `recebidos/` fica no `.gitignore`: arquivos pessoais nunca vão para o
  GitHub. A pasta é criada automaticamente ao iniciar, se não existir.
- Excluir `recebidos/` de qualquer watcher (Vite, tsx/nodemon, Vitest),
  para que gravar um vídeo grande não reinicie o servidor no meio do envio.

### Tipos aceitos na v1 (lista branca, configurável)

| Categoria   | Extensões                         | Limite padrão por arquivo |
|-------------|-----------------------------------|---------------------------|
| Imagens     | jpg, jpeg, png, webp, gif         | 50 MB                     |
| Documentos  | pdf, docx, xlsx, pptx, txt, csv   | 50 MB                     |
| Áudio       | mp3, m4a                          | 200 MB                    |
| Vídeo       | mp4                               | 4 GB                      |
| Compactados | zip                               | 2 GB                      |

Tudo o que não está na lista é recusado. Em especial: executáveis e
scripts (`exe`, `msi`, `bat`, `cmd`, `ps1`, `vbs`, `js`, `lnk`, `scr`,
`apk`...) e Office com macro (`docm`, `xlsm`, `pptm`).

### Fora do escopo da v1

- iPhone/iOS e formato HEIC.
- Conta, login, nuvem, banco de dados, Docker, serviços externos.
- App instalado no celular (a interface é web).
- Enviar do PC para o celular.
- Extrair zip, abrir ou pré-visualizar arquivos recebidos no PC.
- Uso comercial ou distribuição para terceiros.

## 3. Stack

- **Node.js LTS + TypeScript (strict) + Express** no backend.
- **React + TypeScript + Vite** no frontend.
- **Uma única porta:** o Express serve a API e o build do React. Sem CORS
  em produção. Em desenvolvimento, use o proxy do Vite.
- Upload via `multipart/form-data` com biblioteca mantida, em streaming
  para o disco (ex.: busboy ou multer com disk storage).
- Biblioteca de QR Code mantida e compatível (verificar antes de escolher).
- Testes com Vitest (ou equivalente justificado) + supertest para a API.
- npm. Repositório Git publicado no GitHub.

Estrutura sugerida:

```text
LocalDrop/
├── client/            # React + Vite (páginas do PC e do celular)
├── server/            # Express + TypeScript
├── docs/
│   ├── DECISOES.md    # decisões técnicas e porquês
│   └── DIARIO.md      # diário de bordo para o LinkedIn
├── scripts/           # inicializador do Windows (.bat/.ps1)
├── recebidos/         # arquivos enviados pelo celular (no .gitignore)
├── README.md
└── CLAUDE.md          # este prompt
```

Evite abstrações prematuras. Módulos pequenos, nomes claros, sem `any`
injustificado, sem `catch` vazio.

## 4. Segurança (obrigatório na v1)

O servidor fica visível para qualquer dispositivo na rede. Trate como
superfície de risco, mesmo sendo pessoal.

### 4.1 PIN de sessão

- Gerar um PIN de 6 dígitos com `crypto.randomInt` a cada inicialização.
- O QR Code leva o PIN no **fragmento** da URL (`http://IP:PORTA/#pin=123456`),
  que não é enviado ao servidor nem gravado em logs. A página do celular
  lê o fragmento e manda o PIN em um header em cada upload.
- Se o celular abrir sem o PIN, a página pede para digitar.
- Comparação em tempo constante (`crypto.timingSafeEqual`).
- Limitar tentativas erradas por IP (ex.: 5 erros = bloqueio temporário).
- **A página e o endpoint que mostram o PIN e o QR Code só respondem para
  `localhost` (loopback).** Outro dispositivo da rede não pode ler o PIN.

### 4.2 Upload

- Só tipos da lista branca da seção 2. A extensão precisa estar na lista
  **e** o conteúdo precisa bater com ela. Não confiar no `Content-Type`
  enviado pelo cliente:
  - imagens, pdf, mp3, m4a e mp4: magic bytes (ex.: `%PDF`, caixa `ftyp`);
  - docx/xlsx/pptx: é um zip com a estrutura OOXML esperada
    (`[Content_Types].xml` + `word/`, `xl/` ou `ppt/`), sem macros
    (`vbaProject.bin`);
  - zip: assinatura `PK`. **Nunca extrair** (evita zip bomb e zip slip);
  - txt/csv: sem bytes nulos e decodificável como texto.
- Limite de tamanho por categoria (tabela da seção 2) e de quantidade
  por envio, configuráveis.
- **Arquivos grandes (vídeo e zip):**
  - gravar em streaming direto no disco, nunca carregar o arquivo inteiro
    na memória;
  - gravar primeiro num arquivo temporário (`.part`) dentro da pasta de
    destino e renomear só quando terminar e passar na validação;
  - se a conexão cair ou o arquivo for recusado, apagar o `.part`;
  - ajustar `requestTimeout`/timeouts do Node para não matar uploads
    longos, mas com limite de inatividade;
  - verificar espaço livre em disco antes de aceitar
    (`fs.statfs` + `Content-Length`).
- O celular envia **um arquivo por requisição, em sequência**: assim o
  progresso por arquivo é real, uma falha não derruba os outros e dá para
  tentar de novo só o que falhou.
- Nunca executar, abrir ou extrair arquivos recebidos. Avaliar (e propor
  antes de implementar) gravar a marca "baixado da internet"
  (`Zone.Identifier`), para o Windows e o Office tratarem os arquivos com
  cautela.
- Nome de arquivo é dado não confiável: sanitizar e impedir path traversal.
  Nunca gravar fora da pasta de destino.
- Nunca sobrescrever: nomes duplicados ganham sufixo (`foto (1).jpg`).
- Resposta com resultado por arquivo (ok / motivo da falha).
- Erros sem stack trace nem caminhos do PC na resposta.
- Nenhuma listagem ou download dos arquivos recebidos.
- Documentar que o firewall do Windows vai pedir permissão para rede
  **privada**. Nunca orientar a desativar o firewall.

Não afirmar que o sistema é "totalmente seguro". Documentar as limitações
(ex.: HTTP sem criptografia na rede local).

## 5. Fases

São 4 fases. Ao final de cada uma: **pare**, mostre o resultado, rode os
testes e entregue o fechamento descrito na seção 6. Não avance sem eu
aprovar.

### Fase 1 — Base, servidor e tela do PC

- `git init`, `.gitignore` (incluindo `recebidos/`), estrutura `client/` +
  `server/`, TypeScript strict, scripts (`dev`, `build`, `start`, `test`,
  `typecheck`).
- Express servindo o build do React numa porta só.
- Descoberta do IPv4 da rede local: ignorar loopback e adaptadores
  virtuais comuns (VirtualBox, WSL, Hyper-V, VPN); se houver mais de um
  candidato, explicar a escolha. Nunca mostrar `localhost` para o celular.
- Mensagens claras para porta ocupada e falha ao iniciar; encerramento
  limpo (SIGINT/SIGTERM).
- Geração do PIN e tela do PC (restrita a loopback): nome, endereço, QR
  Code, PIN e instruções curtas de conexão.
- README inicial e primeiras entradas em `docs/`.

**Pronto quando:** `npm run build && npm start` abre a tela do PC com QR
Code e PIN corretos, e o celular consegue abrir a página pelo QR.

### Fase 2 — Upload seguro

- Endpoint de upload com validação do PIN e limite de tentativas.
- Todas as regras da seção 4.2.
- Criação da pasta de destino se não existir.
- Testes automatizados (usando uma pasta temporária, nunca a `recebidos/`
  real): PIN certo/errado/ausente, bloqueio por tentativas, extensão fora
  da lista (`.exe`, `.bat`), conteúdo que não bate com a extensão (`.exe`
  renomeado para `.pdf`, zip renomeado para `.docx`), docx com macro, txt
  com bytes nulos, limite por categoria, path traversal no nome, nomes
  duplicados, upload interrompido (o `.part` some), arquivo grande gravado
  sem estourar a memória.

**Pronto quando:** todos os testes passam e um upload real pelo celular
salva uma foto, um PDF e um vídeo corretamente em `recebidos/`.

### Fase 3 — Interface do celular

- Layout mobile-first em português do Brasil.
- Botão para escolher arquivos (`multiple`, `accept` com as extensões
  da lista branca).
- Lista com nome, tamanho e miniatura (só para imagens; ícone por
  categoria para o resto); remover itens antes de enviar.
- Avisar já na seleção quando um arquivo estiver fora da lista ou acima
  do limite (o servidor continua validando de verdade).
- Progresso **real** por arquivo e geral (XHR/`upload.onprogress`), com
  velocidade e tempo restante para arquivos grandes. Nada de porcentagem
  fake.
- Cancelar o envio em andamento; tentar de novo só os que falharam.
- Avisar para manter a tela ligada durante envios longos (avaliar a
  Wake Lock API).
- Resultado por arquivo; sucesso parcial claro; botão desabilitado durante
  o envio; tratamento de queda de rede e PIN inválido.
- Acessibilidade: foco visível, rótulos claros, mensagens que não dependam
  só de cor.

**Pronto quando:** consigo enviar do meu Android várias fotos, um PDF e
um vídeo de mais de 1 GB, ver o progresso e o resultado, e encontrar tudo
em `recebidos/`.

### Fase 4 — Abrir com um clique e acabamento

- **Inicializar sem digitar comandos:** script em `scripts/` que faz o
  build se necessário, inicia o servidor e abre o navegador na tela do PC,
  e um atalho na Área de Trabalho apontando para ele. Avaliar e propor
  (sem implementar sem aprovação) a opção de gerar um `.exe` único.
- Configurações centralizadas (porta, limites, pasta) com padrões seguros.
- Na tela do PC, um botão "Abrir pasta recebidos" (só funciona em
  loopback).
- Revisão final de segurança contra a seção 4.
- README completo: instalação, uso, firewall, solução de problemas
  (isolamento de clientes no roteador, IP errado, porta ocupada).
- Checklist manual de validação.
- **Post final do LinkedIn** (seção 7.3).

**Pronto quando:** dou dois cliques no atalho, escaneio o QR e envio
arquivos, sem abrir o terminal.

## 6. Fechamento de cada fase

Ao final de cada fase, entregue de forma curta:

1. **O que foi feito**, arquivos criados/alterados e decisões tomadas.
2. **Testes e verificações executados**, com o resultado real. O que não
   pôde rodar, diga exatamente o que e por quê.
3. **Tutorial Git em arquivo**: criar
   `tutoriais-git/Tutorial Git - Fase N <Nome>.txt` (pasta no `.gitignore`),
   no mesmo padrão dos meus tutoriais em `C:\Users\wikka\Desktop\TG\PI`
   (ex.: `Tutorial Git - Retirada no Local.txt`). Texto puro, com:
   - cabeçalho com o nome da fase, a branch e o estado dela (já criada ou
     não, com ou sem commit) e um bloco "ANTES:" se houver algo a fazer antes;
   - **1. COMMIT E PUSH**: `git status`, `git add .`, `git status` com
     "-> confira:" dizendo o que deve e o que não pode aparecer, commit em
     Conventional Commits (português, sem acentos na mensagem) e `git push -u`;
   - **2. PRINTS**: como subir o app e a lista numerada de prints a tirar;
   - **3. PULL REQUEST**: base/compare, título e a descrição em markdown entre
     linhas `===` (O que foi feito, com subtítulos em negrito, Testes, Para
     testar, tabela de Prints com `<img src="COLE_AQUI_O_LINK_N">`) e a
     instrução de como colar os links dos prints;
   - **4. DEPOIS DO MERGE**: `git switch main`, `git pull`,
     `git branch -d`, `git fetch --prune` e a branch da próxima fase.
   Só execute commits, push ou PRs se eu pedir explicitamente.
4. **Diário atualizado** (`docs/DIARIO.md`) e **rascunho do post da fase**
   (seção 7.2).
5. **Próximo passo.**

## 7. Diário e LinkedIn

### 7.1 Diário de bordo (`docs/DIARIO.md`)

Atualize a cada fase com fatos reais, não inventados:

- O que foi construído.
- Dificuldades encontradas e como foram resolvidas (erros reais, bugs,
  coisas que não funcionaram de primeira).
- Decisões técnicas e alternativas descartadas.
- Como o Claude (Claude Code) ajudou, e onde precisei corrigir ou decidir
  por conta própria.
- Prints/GIFs que valem a pena capturar naquela fase (ex.: tela do PC com
  QR, celular enviando, pasta com os arquivos, testes passando no terminal).
- Números quando houver (testes, tempo e velocidade de envio, linhas de
  código).

### 7.2 Post curto por fase

Rascunho de 80 a 150 palavras: um gancho na primeira linha, o que avancei,
uma dificuldade ou aprendizado concreto, um print sugerido e 3 a 5
hashtags. Tom pessoal, sem exagero.

### 7.3 Post final

Texto pronto para publicar (com um gancho forte nas primeiras linhas,
antes do "ver mais"), contendo:

- A dor pessoal que motivou o projeto, e por que fazer o meu próprio em
  vez de usar algo pronto.
- O que o LocalDrop faz, em uma frase.
- Stack e decisões principais (porta única, PIN no fragmento da URL,
  validação por conteúdo, upload em streaming para arquivos grandes),
  explicadas de forma simples.
- 2 ou 3 dificuldades reais tiradas do diário.
- Como usei IA (Claude Code): o que acelerou, onde precisei revisar.
  Honesto, sem "a IA fez tudo" e sem esconder o uso.
- Aprendizados e próximos passos.
- Sugestão de mídia (carrossel ou GIF de 15 s do fluxo completo).
- Link do GitHub e 3 a 5 hashtags relevantes.

Entregue também uma versão alternativa mais curta.

## 8. Regras gerais

- Português do Brasil, direto e organizado.
- Explique termos técnicos quando necessário, sem virar aula.
- Diferencie comando sugerido de comando executado.
- Antes de mudanças grandes, apresente o plano. Dúvidas que afetem
  arquitetura, segurança ou escopo: pergunte de forma objetiva.
- Se achar uma alternativa melhor, explique os prós e contras e peça
  aprovação antes de mudar os requisitos.
- Não descarte nem sobrescreva trabalho existente sem investigar.

## 9. Primeira resposta

1. Confirme o objetivo em uma ou duas frases.
2. Inspecione a pasta e o estado do Git.
3. Faça um diagnóstico rápido do estado atual.
4. Apresente o plano da Fase 1: arquivos a criar, dependências que
   pretende usar (com versão) e como será verificado.
5. Pergunte só o que for realmente necessário (ex.: porta padrão, limite
   de tamanho) e espere minha aprovação antes de implementar.
