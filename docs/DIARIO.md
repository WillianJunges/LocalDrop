# Diário de bordo

Registro real de cada fase, para servir de base aos posts no LinkedIn.

## Fase 0: planejamento (20–21/10/2026)

- **A dor:** passar fotos, documentos e vídeos do celular para o PC sem cabo, WhatsApp ou nuvem.
- **Antes de codar, pesquisei alternativas:** LocalSend, PairDrop, Quick Share e Vincular ao
  Celular já existem. Escolhi fazer o meu mesmo assim: para aprender e ter algo do meu jeito.
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
