# Diário de bordo

Registro real de cada fase, para servir de base aos posts no LinkedIn.

## Fase 0: planejamento (20–21/10/2026)

- **A dor:** passar fotos, documentos e vídeos do celular para o PC sem cabo, WhatsApp ou nuvem.
- **Alternativas que eu já conhecia:** LocalSend, PairDrop, Quick Share e Vincular ao
  Celular. Escolhi fazer o meu mesmo assim: para aprender e ter algo do meu jeito.
- **O primeiro prompt** (feito com ChatGPT) era enorme: 10 fases, várias IAs e um tutorial Git de
  12 passos em cada etapa. Revisei com o Claude e enxuguei para 4 fases, uma IA só (Claude Code)
  e foco no que importa.
- **Decisões do planejamento:** só Android; PIN de 6 dígitos desde o início; aceitar imagens,
  documentos, áudio, mp4 e zip (com lista branca); arquivos caem numa pasta `recebidos/`
  dentro do projeto.

## Fase 1: base, servidor e tela do PC (21/10/2026)

**O que foi construído**
- Monorepo com npm workspaces (`client/` React + Vite, `server/` Express), TypeScript strict.
- Servidor que descobre sozinho o IP do Wi-Fi e ignora adaptadores virtuais e VPN.
- Tela do PC com endereço, QR Code e PIN, acessível só no próprio computador.
- Página inicial do celular, que lê o PIN direto do QR Code.
- 57 testes automatizados passando.

**Dificuldades e descobertas**
- **O Wi-Fi do Windows estava como rede "Pública".** Assim, o firewall bloquearia o celular sem
  nenhum erro claro. Mudei para "Privada". Virou item do README.
- **Uma brecha que eu não teria visto sozinho:** bloquear a tela do PIN pelo IP (`127.0.0.1`)
  não basta. Um site malicioso aberto no navegador poderia usar *DNS rebinding* para ler o PIN.
  A solução foi conferir também o header `Host`.
- **O proxy do Vite em dev** faz toda requisição parecer vir do próprio PC. Se o modo dev ficasse
  aberto na rede, isso furaria a proteção. Decisão: dev só em `localhost`; o celular testa pelo
  build.
- **PIN no fragmento da URL (`#pin=`)**: o navegador não envia essa parte ao servidor, então o
  PIN não vaza em logs.

**Como o Claude ajudou**
- Revisou o prompt original e cortou o excesso.
- Montou a estrutura, o código e os testes, e verificou que tudo roda (testes, build e servidor
  real respondendo 403 para acesso pela rede).
- Apontou o risco de DNS rebinding e o problema do proxy do Vite.
- O que eu decidi: escopo (só Android, tipos de arquivo), porta 8787, pasta de destino e fazer
  eu mesmo toda a parte de Git e GitHub.

**Números**
- 57 testes, 0 vulnerabilidades no `npm install`, bundle do front com 79 KB gzip.

**Prints para tirar**
- Terminal com o `npm start` mostrando IP, PIN e IPs ignorados.
- Tela do PC com o QR Code (dá para borrar o PIN, que muda a cada execução).
- Celular abrindo a página pelo QR.
- Terminal com os testes passando.

## Fase 2: upload seguro (21/10/2026)

**O que foi construído**
- Rota de upload com PIN, bloqueio por tentativas e limite de envios simultâneos.
- Lista branca com 15 extensões, conferindo o **conteúdo** de cada arquivo: um `.exe`
  renomeado para `.pdf` é recusado.
- docx/xlsx/pptx são conferidos por dentro, e documentos com macro são recusados.
- Upload em streaming: arquivos grandes vão direto para o disco, sem passar pela memória.
- Arquivos incompletos (`.part`) são apagados se a conexão cair.
- Nomes repetidos ganham sufixo, nunca sobrescrevem.
- Arquivos recebidos ganham a marca "baixado da internet" do Windows.
- Página provisória no celular para escolher e enviar arquivos.
- 132 testes automatizados (eram 57).

**Dificuldades e descobertas**
- **Git:** o primeiro `push` foi recusado porque o repositório no GitHub foi criado com um
  README, e as duas histórias não tinham nada em comum. Recriei o repositório vazio.
- **Nome de branch não pode terminar com ponto:** `git switch -c feat/upload-seguro.` falha.
  Detalhe bobo que custou alguns minutos.
- **`feat` x `chore`:** aprendi que o tipo do commit descreve o que ele entrega, não o momento
  do projeto. O primeiro commit já entregava funcionalidade, então era `feat`.
- **Um arquivo `.docx` é um zip.** Para saber se ele é mesmo um documento do Word, e se tem
  macro, foi preciso olhar a lista de arquivos dentro do zip, sem extrair nada.
- **Windows tem nomes proibidos:** um arquivo chamado `CON.txt` não pode ser criado. Isso
  virou teste.
- **CSV do Excel brasileiro não é UTF-8** (é ANSI). Uma validação de texto "estrita" recusaria
  planilhas legítimas, então a regra virou "sem bytes nulos nem caracteres de controle".
- **Um teste que eu (Claude) escrevi estava com a expectativa errada:** esperava manter um espaço
  antes da extensão (`demais .pdf`), mas o comportamento certo é removê-lo. O teste foi corrigido, não o
  código.
- **Porta ocupada no teste final:** o servidor da Fase 1 ainda estava aberto. A mensagem de
  "porta em uso" da Fase 1 funcionou como planejado, e o teste rodou na 8788.

**Como o Claude ajudou**
- Desenhou a validação por conteúdo, o ciclo do arquivo `.part` e a reserva atômica de nomes.
- Escreveu os testes, incluindo upload de 300 MB medindo a memória e conexão derrubada no meio.
- Validou pela rede real: PDF salvo, duplicado virou `teste (1).pdf`, exe disfarçado e PIN
  errado recusados, marca do Windows gravada.
- O que eu decidi: aprovar a marca "baixado da internet" e o limite de 3 envios simultâneos,
  além de cuidar de toda a parte de Git.

**Números**
- 132 testes, passando 4 vezes seguidas (para garantir que não são instáveis).
- Upload de 300 MB nos testes com menos de 100 MB de aumento de memória.

**Prints para tirar**
- Terminal com os 132 testes passando.
- Celular mostrando um envio com sucesso e um recusado (ex.: `.exe`).
- Pasta `recebidos/` com `foto.jpg` e `foto (1).jpg`.
- Propriedades de um arquivo recebido no Windows, mostrando o aviso "Este arquivo veio de outro
  computador".

## Fase 3: interface do celular (21/10/2026)

**O que foi construído**
- Página do celular refeita: lista com miniatura (imagens) ou ícone por tipo, tamanho e status
  de cada arquivo.
- Arquivos fora da lista ou acima do limite são marcados já na seleção, antes de enviar.
- Progresso real por arquivo e do lote, com velocidade e tempo restante.
- Cancelar envio, "Tentar de novo" só para os que falharam e "Remover recusados".
- Arquivo enviado sai da lista e vai para o resumo "Enviados nesta sessão".
- Dois botões de seleção (galeria e arquivos), seleção que acumula em várias rodadas.
- PIN conferido assim que é preenchido, com nova rota `POST /api/pin`.
- 146 testes (134 no servidor e 12 novos no front).

**Dificuldades e descobertas**
- **Feedback de uso real:** testando a versão provisória no celular, percebi que o arquivo
  enviado continuava na lista e que não era óbvio como selecionar vários. As duas coisas
  viraram requisito desta fase.
- **No Android, selecionar vários não é intuitivo:** o campo já aceitava vários, mas é preciso
  "tocar e segurar". A solução foi um botão que abre a galeria, uma dica na tela e a seleção que
  vai somando.
- **PIN errado em upload grande:** o servidor recusa na hora, mas o navegador só percebe depois
  de mandar o arquivo inteiro, às vezes como "erro de rede". Daí a checagem de PIN antes do
  envio.
- **HTTP na rede local tem limitações:** a API que mantém a tela ligada (Wake Lock) e o
  `crypto.randomUUID` só funcionam em HTTPS. Ficou o aviso na tela e um contador para os IDs.
- **Bug pego pelo teste:** o medidor de velocidade guardava uma amostra antiga, e a velocidade
  demorava a cair quando o Wi-Fi ficava lento. O teste escrito antes revelou o erro, e o código
  foi corrigido.
- **Aviso vermelho para sucesso parcial:** "3 enviados, 1 com problema" aparecia como erro.
  Virou um aviso amarelo.

**Como o Claude ajudou**
- Reorganizou o front em fila (reducer puro), API (XHR com progresso) e medidor de velocidade,
  todos testáveis.
- Abriu a página no Chrome e fez um envio real: PIN do QR confirmado sozinho, `.apk` recusado
  na seleção, PDF falso recusado pelo servidor, enviados saindo da lista e `contrato (1).pdf`
  identificado como renomeado. Sem erros no console.
- Ponto não verificado visualmente: a barra de progresso. No PC o envio é instantâneo; ela
  aparece no teste com um vídeo grande pelo Wi-Fi.
- O que eu decidi: que o enviado deve sair da lista e que selecionar vários precisava ficar
  mais fácil.

**Números**
- 146 testes (134 servidor + 12 front).
- Bundle do front: 83 KB gzip.

**Prints para tirar**
- Lista com miniaturas e um arquivo recusado já na seleção.
- Envio de um vídeo grande mostrando a barra, a velocidade e o tempo restante (o melhor print
  da fase; vale um GIF).
- Aviso "Pronto! N arquivos enviados" com a seção "Enviados nesta sessão" aberta.
- Seletor de galeria do Android com várias fotos marcadas.

## Fase 4: abrir com um clique e acabamento (22/10/2026)

**O que foi construído**
- Atalho **LocalDrop** na Área de Trabalho, com ícone próprio. Instala e compila sozinho quando
  precisa, sobe o servidor e abre a tela do PC no navegador.
- Clicar no atalho com o LocalDrop já aberto só abre o navegador, em vez de dar "porta ocupada".
- `localdrop.json` opcional (porta, pasta, limites) com validação estrita e mensagens claras;
  os limites chegam também ao celular.
- Botão **Abrir pasta recebidos** na tela do PC.
- Cabeçalhos de segurança (CSP e outros) e proteção contra CSRF nas ações da tela do PC.
- Revisão final de segurança item por item, README completo e checklist de teste manual.
- 169 testes (156 servidor + 13 front).

**Dificuldades e descobertas**
- **Achei um bug do próprio Node.js no Windows:** ao clicar no atalho com o LocalDrop já aberto,
  o processo caía com `Assertion failed ... async.c`. Isolando em scripts de 3 linhas, a causa
  apareceu: `process.exit()` logo depois de um `fetch`. Trocar por `node:http` resolveu.
- **O terminal "traduziu" meu .bat:** ao gravar o arquivo pelo Git Bash, o `>nul` do Windows
  virou `>/dev/null`, que o `cmd` não entende. Reescrito e conferido byte a byte (CRLF e `>nul`).
- **Aviso de segurança do Node:** chamar `npm` com `shell: true` e lista de argumentos gera um
  aviso de depreciação no Node 24. O comando passou a ser montado como texto fixo.
- **O `package-lock.json` mudando sozinho:** o `npm install` desta máquina sempre remove uma linha
  `"peer": true`. Já tinha bloqueado um `git switch`; agora entrou no commit.
- **Ícone sem dependências:** o `.ico` do atalho é gerado por um script que desenha o mesmo ícone
  do SVG, monta PNGs e empacota num ICO, usando só o Node.
- **Decisão consciente de NÃO fazer o `.exe`:** seria ~90 MB, sem assinatura o Windows mostraria
  alerta, e o ganho (não precisar do Node) só importa para distribuir.

**Como o Claude ajudou**
- Criou o inicializador, o atalho, a configuração validada, os cabeçalhos e o gerador de ícone.
- Testou de ponta a ponta: o inicializador recompilou ao detectar código novo, o segundo clique
  reconheceu a instância aberta (3 vezes seguidas, sem erro), o `.bat` funcionou pelo `cmd`, a
  tela do PC abriu no Chrome sem bloqueios da CSP e o Explorer abriu na pasta certa.
- Isolou o bug do Node em scripts mínimos antes de corrigir.
- O que eu decidi: aprovar o plano da fase e se o `.exe` vale a pena (avaliação em DECISOES.md).

**Números finais do projeto**
- 4 fases, 4 PRs.
- 169 testes automatizados (156 servidor + 13 front).
- 15 tipos de arquivo aceitos, até 4 GB por vídeo, upload de 300 MB com menos de 100 MB de memória.
- Front com 84 KB gzip.
- 0 vulnerabilidades no `npm install`.

**Prints para tirar**
- Atalho com o ícone na Área de Trabalho.
- Janela do terminal + navegador abrindo sozinhos depois do duplo clique (vale um GIF curto).
- Tela do PC com o card "Arquivos recebidos" e o Explorer aberto ao lado.
- GIF final de 15 s: duplo clique → QR Code → celular escolhendo fotos → barra de progresso →
  arquivos na pasta.

## Fase 5: PC para o celular e fechar sem terminal (22/10/2026)

**Por que existe:** a v1 estava pronta, mas eu queria mandar arquivos também do PC para o
celular. E minha esposa vai usar o LocalDrop e não sabe (nem precisa saber) fechar um servidor
pelo terminal.

**O que foi construído**
- Card **Enviar para o celular** na tela do PC: arrastar ou escolher arquivos, com "✓ Baixado
  pelo celular" quando o celular baixa.
- Seção **Do computador** no celular, atualizando sozinha, com botão **Baixar**.
- Botão **Encerrar LocalDrop**, que pede confirmação se houver transferência.
- **Fechar a aba encerra o LocalDrop:** 15 s de espera ao fechar, 3 min se a aba sumir sem
  avisar, só quando todas as abas fecharem e nunca no meio de uma transferência.
- Atalho abrindo com o terminal minimizado.
- 202 testes (189 servidor + 13 front).

**Dificuldades e descobertas**
- **O navegador não deixa a página ler o disco:** para mandar um arquivo do PC, a tela do PC
  precisa enviar o conteúdo ao servidor, que guarda uma cópia temporária. Não existe "apontar
  para o arquivo".
- **Link de download não manda header:** o PIN vai em header, mas um `<a download>` não manda
  headers. A solução foi um código aleatório por arquivo no link, entregue só para quem passou
  pelo PIN.
- **Saber quando a aba fechou é mais difícil do que parece:**
  - um `fetch` comum é cortado quando a aba fecha; o `sendBeacon` é entregue mesmo assim, mas
    não manda headers, e daí veio a chave no corpo;
  - um F5 também "fecha" a página, e daí os 15 s de espera;
  - o navegador desacelera abas em segundo plano, e daí os 3 min de folga;
  - quando o PC suspende, o servidor acorda achando que todas as abas sumiram, e daí a detecção
    de "pulo no tempo".
- **Achei um bug da Fase 4 enquanto mexia no início do servidor:** o segundo clique no atalho
  apagava o arquivo de um envio em andamento antes de perceber que o LocalDrop já estava aberto.
  Corrigido: a limpeza só acontece depois que a porta é do processo.
- **Sem a extensão do Chrome nesta fase:** as telas novas não puderam ser vistas no navegador
  pelo Claude. O fluxo foi testado de ponta a ponta pela API, no servidor real.

**Como o Claude ajudou**
- Desenhou a caixa de saída reaproveitando toda a validação do upload, a presença das abas e o
  encerramento seguro.
- Testou no servidor real: arquivo do PC baixado no celular byte a byte, encerramento 20 s
  depois de fechar a aba e o servidor **esperando** um envio de 31 s terminar antes de encerrar.
- Encontrou e corrigiu o bug da limpeza antes da hora.
- O que eu decidi: fazer o PC → celular, a mesma lista branca nos dois sentidos, os tempos
  (15 s e 3 min), não adicionar extensões novas e manter o `.bat`.

**Feedback do teste no celular (antes do push)**
- Um nome comprido (`202610220214-ezgif.com-video-to-gif-converter.gif`) fazia o item sair da tela
  no celular. Causa: item de grid com nome em uma linha só. Corrigido para todas as listas.
- Pedi um botão para **cancelar** um arquivo vindo do PC, com confirmação. Ele remove também da
  tela do PC.
- A tela do PC desperdiçava espaço nas laterais e escondia o envio lá embaixo. Virou um layout em
  3 colunas que cabe sem rolar.
- Desta vez a extensão do Chrome funcionou: o Claude viu as telas, testou o Cancelar e confirmou
  que fechar a aba do PC encerra o LocalDrop em 20 s.

**Números**
- 204 testes (191 servidor + 13 front).

**Prints para tirar**
- Tela do PC com o card "Enviar para o celular" e um item "✓ Baixado pelo celular".
- Celular com "Do computador" e o botão Baixar.
- GIF: arrastar um arquivo no PC → aparece no celular → baixar.
- Botão "Encerrar LocalDrop" e a tela "LocalDrop encerrado".

## Correção pós-v1.0: o cancelamento que voltava (22/10/2026)

- **O que aconteceu:** cancelei no celular um arquivo vindo do PC, atualizei a página e ele
  voltou.
- **A causa foi uma combinação:** o LocalDrop aberto no PC era de antes da atualização (o atalho só
  abria o navegador se já tivesse um aberto), e a página do celular interpretava "rota não
  existe" como "arquivo já removido".
- **Lição:** a interface não deve concluir sozinha que algo deu certo; quem decide é o servidor.
  E quando o código muda, a versão antiga aberta precisa sair do caminho.
- **Agora:** o celular confere a lista com o servidor depois de cancelar, e o atalho troca uma
  versão antiga aberta pela nova, sem nunca interromper uma transferência.
- 217 testes (204 servidor + 13 front).
