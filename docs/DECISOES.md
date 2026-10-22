# Decisões técnicas

Registro curto do que foi decidido e por quê.

## Fase 1

### Uma porta só (Express serve a API e o React)

O celular acessa um único endereço (`http://IP:8787`). Isso evita CORS e não deixa duas portas
abertas na rede. Em desenvolvimento, o Vite roda em `localhost:5173` e repassa `/api` para o
Express (proxy).

### npm workspaces

`client/` e `server/` são pacotes separados, mas um `npm install` na raiz instala tudo, e os
scripts rodam da raiz.

### Escolha do IP para o celular (`server/src/rede.ts`)

O PC pode ter vários adaptadores. A regra:

1. Descarta loopback, link-local (`169.254.x`), IPs não privados e adaptadores virtuais ou VPN
   (vEthernet/WSL, Hyper-V, VirtualBox, VMware, Docker, Tailscale, ZeroTier etc.).
2. Entre os que sobram, prefere Wi-Fi, depois cabo, e depois `192.168.x` > `10.x` > `172.16–31.x`.
3. O terminal mostra o escolhido, as alternativas e o motivo de cada descarte.

`localhost` nunca é mostrado para o celular.

### PIN de sessão (`server/src/sessao.ts`)

- 6 dígitos com `crypto.randomInt`, novo a cada inicialização.
- Vai no QR Code como **fragmento** (`/#pin=123456`). O navegador não envia o fragmento ao
  servidor, então o PIN não aparece em logs nem em requisições. A página do celular lê o PIN e
  depois o remove da barra de endereço.
- A comparação (usada na Fase 2) é em tempo constante (`timingSafeEqual`).

### Tela do PC só no próprio PC (`server/src/loopback.ts`)

`/pc` e `/api/sessao` mostram o PIN, então respondem **403** para qualquer acesso que não venha
do próprio computador. A checagem usa o IP da conexão (`socket.remoteAddress`) **e** o header
`Host`:

- Só o IP não basta: um site malicioso aberto no navegador do PC poderia usar *DNS rebinding*
  (fazer o domínio dele apontar para `127.0.0.1`) e ler o PIN. Exigir `Host` igual a
  `localhost`/`127.0.0.1`/`[::1]` bloqueia isso.

### Modo dev só no PC

O proxy do Vite faz as requisições chegarem ao Express vindas de `127.0.0.1`. Se o Vite ficasse
aberto na rede, um celular passaria pela checagem de loopback. Por isso o Vite escuta só em
`localhost`, e o teste no celular é sempre pelo build (`npm start`).

### Pasta `recebidos/`

Fica na raiz do projeto, resolvida a partir da localização do código (não do diretório onde o
comando foi rodado), com opção de trocar via `LOCALDROP_DIR`. Está no `.gitignore` para que
arquivos pessoais nunca vão para o GitHub. É criada ao iniciar.

### Erros

Respostas de erro são genéricas, sem stack trace nem caminhos do PC. O header `X-Powered-By` do
Express é desativado.

### Versões

TypeScript 7.0, Vite 8, React 19, Express 5, Vitest 5. A biblioteca `qrcode` (1.5.4) não recebe
atualizações há algum tempo, mas é estável, muito usada e não tem alternativa claramente melhor.

## Fase 2

### Um arquivo por requisição

O celular envia `POST /api/upload` com um arquivo só, em sequência. O progresso de cada arquivo é
real, uma falha não derruba os outros e dá para reenviar só o que falhou. O PIN vai no header
`X-LocalDrop-Pin`.

Exigir um header customizado também protege contra CSRF: um site qualquer não consegue mandar
esse header para o LocalDrop sem permissão de CORS, e o LocalDrop não libera CORS.

### Streaming direto para o disco

Com o `busboy`, o arquivo passa por um "fiscal" (`validacao.ts`) e vai direto para o disco, em
pedaços. Um vídeo de 4 GB nunca fica inteiro na memória (há um teste com 300 MB que confere
isso).

O fiscal, durante a transmissão:
- conta os bytes e corta assim que passa do limite da categoria;
- confere a assinatura com os 12 primeiros bytes;
- em txt/csv, recusa bytes nulos e caracteres de controle.

### Validação pelo conteúdo

| Tipo | Como é conferido |
|---|---|
| jpg, png, gif, webp, pdf, mp3 | assinatura no início do arquivo |
| mp4, m4a | caixa `ftyp` no byte 4 |
| zip | `PK\x03\x04`. Nunca é extraído |
| docx, xlsx, pptx | zip + `[Content_Types].xml` + pasta `word/`, `xl/` ou `ppt/`; recusado se tiver `vbaProject.bin` (macro). Só a lista de arquivos do zip é lida (`yauzl`), nada é extraído |
| txt, csv | sem byte nulo nem caracteres de controle. UTF-8 e ANSI (CSV do Excel) são aceitos; UTF-16 não |

A extensão precisa estar na lista branca **e** o conteúdo precisa bater com ela. O
`Content-Type` enviado pelo navegador é ignorado.

### Ciclo de vida do arquivo

1. Grava como `.localdrop-<uuid>.part` dentro de `recebidos/`.
2. Se tudo estiver certo, reserva o nome final criando um arquivo vazio com a flag `wx` (falha
   se já existir). Isso é atômico: dois envios de `foto.jpg` ao mesmo tempo viram `foto.jpg` e
   `foto (1).jpg`, nunca um sobrescrevendo o outro.
3. Renomeia o `.part` para o nome final (com nova tentativa se o antivírus estiver segurando o
   arquivo).
4. Grava a marca `Zone.Identifier` ("baixado da internet"), como os navegadores fazem. O Word
   abre em Modo Protegido e o Windows avisa antes de abrir algo suspeito.

Se a conexão cair, o arquivo for recusado ou algo falhar, o `.part` é apagado. Sobras de uma
execução interrompida são apagadas ao iniciar.

### Nomes de arquivo

`nomes.ts` trata o nome como dado não confiável: fica só com a última parte (bloqueia
`../../`), troca caracteres proibidos no Windows, remove ponto e espaço no final, prefixa nomes
reservados (`CON`, `NUL`, `COM1`...) com `_` e limita a 150 caracteres sem quebrar emoji.
`caminhoDentroDe` confere de novo que o caminho final está dentro da pasta.

### Limites e proteção

- 5 PINs errados bloqueiam aquele IP por 5 minutos (`tentativas.ts`).
- Até 3 envios simultâneos.
- Recusa se o espaço livre em disco for menor que o tamanho do envio mais 100 MB de reserva.
- O timeout total de requisição do Node (5 min) foi desligado para vídeos grandes. No lugar
  dele, 60 s sem receber nenhum byte derrubam o envio.
- Quando a resposta de erro sai antes do corpo terminar de chegar, a conexão é fechada
  (`Connection: close`).

## Fase 3

### Conferir o PIN antes de enviar (`POST /api/pin`)

Com o PIN errado, o servidor responde 401 logo no começo, mas o navegador só lê a resposta
depois de mandar o corpo inteiro, e às vezes reporta apenas "erro de rede". Num vídeo de 2 GB
isso seria minutos de envio jogados fora, com uma mensagem confusa. Agora o celular confere o
PIN numa requisição sem arquivo, assim que os 6 dígitos são preenchidos e de novo antes de cada
lote. O middleware `exigirPin` (`pin.ts`) é o mesmo para as duas rotas, e os erros somam para o
bloqueio.

### Uma única lista de tipos

O front importa `server/src/tipos.ts` em vez de manter uma cópia. A lista do seletor de arquivos
(`accept`), o aviso "tipo não permitido" e os limites mostrados no celular nunca ficam
diferentes do que o servidor aceita. O servidor continua validando tudo.

### Fila de envio

- A lógica fica num reducer puro (`client/src/envio/fila.ts`), testado sem navegador.
- Estados: `pronto`, `enviando`, `falhou` (temporário: rede, cancelado, erro no PC; pode
  reenviar) e `recusado` (definitivo: tipo, conteúdo, limite; não adianta reenviar).
- **Enviado sai da lista** e vai para o resumo "Enviados nesta sessão", que avisa quando o PC
  renomeou o arquivo (`contrato (1).pdf`).
- A seleção **acumula** (várias rodadas) e ignora o mesmo arquivo escolhido de novo.
- Um arquivo por vez, com XMLHttpRequest, porque o `fetch` não informa progresso de upload.
- Se a rede cai, a fila para em vez de falhar arquivo por arquivo; "Tentar de novo" continua de
  onde parou. PIN errado ou bloqueio também param a fila.
- Cancelar aborta o envio atual (o servidor apaga o `.part`) e devolve o item para a lista.

### Progresso e velocidade

- Progresso real por arquivo e do lote, convertendo o progresso do multipart para bytes do
  arquivo.
- Velocidade = média dos últimos 3 s (`MedidorVelocidade`). Reage a mudanças no Wi-Fi sem ficar
  pulando a cada evento. O tempo restante vem dessa média.
- Quando o upload chega a 100% e o PC ainda está validando (ex.: docx), a tela mostra
  "Finalizando no computador…".

### Seleção no Android

Dois botões: **"Fotos e vídeos"** (`accept` com tipos de imagem e `video/mp4`, que abre a
galeria, onde marcar vários é natural) e **"Arquivos"** (`accept` com as extensões da lista,
que abre o gerenciador de arquivos). A tela explica o "toque e segure" para marcar vários.

### Limitações do HTTP na rede local

O navegador trata `http://192.168.x.x` como contexto **não seguro**. Algumas APIs só existem em
HTTPS:

- **Wake Lock** (manter a tela ligada): não disponível. A página tenta usar quando existe; se
  não, mostra "mantenha a tela ligada e esta página aberta" durante o envio.
- **`crypto.randomUUID`**: não disponível. Os IDs da fila são um contador simples.

A página também pede confirmação antes de fechar enquanto há um envio em andamento
(`beforeunload`).

## Fase 4

### Abrir com um clique

- `scripts/LocalDrop.bat` confere se o Node.js existe e chama `scripts/iniciar.mjs`.
- `iniciar.mjs` roda `npm install` só se o `package-lock.json` for mais novo que a última
  instalação, e `npm run build` só se algum arquivo de código for mais novo que o build. Depois
  carrega o servidor **no mesmo processo**: fechar a janela ou Ctrl+C encerra tudo.
- O servidor abre o navegador **depois** de estar pronto (`--abrir-navegador`), não antes.
- Se a porta estiver ocupada, o servidor pergunta a ela se é um LocalDrop (`/api/sessao`). Se
  for, só abre o navegador e sai sem erro. Isso cobre o duplo clique repetido no atalho.
- O navegador e a pasta são abertos com `explorer.exe <alvo>`, sem shell no meio.
- `npm run atalho` cria o `.lnk` na Área de Trabalho, com ícone próprio. O `.ico` é gerado por
  `scripts/gerar-icone.mjs`, sem dependências, a partir do mesmo desenho do `icone.svg`.

**Bug do Node encontrado:** no Windows, `process.exit()` logo depois de um `fetch` derruba o
processo com `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c`.
Reproduzido isoladamente; a checagem "já está rodando" usa `node:http` para evitar.

### Configuração (`localdrop.json`)

Opcional, com modelo em `localdrop.exemplo.json` e fora do Git (pode ter caminhos pessoais).
Prioridade: variáveis de ambiente > arquivo > padrões. Validação estrita: opção desconhecida
(erro de digitação), porta inválida ou limite fora de 1 MB a 50 GB **impedem a inicialização**,
com mensagem clara. Melhor não abrir do que abrir com um valor inesperado.

Os limites configurados vão para o celular na resposta de `POST /api/pin`, para que os avisos da
seleção batam com o servidor.

### Tela do PC

Botão **Abrir pasta recebidos** (`POST /api/abrir-pasta`): só no próprio PC (`somenteNoPc`) e
só com o header `X-LocalDrop: 1`. O header impede que um site malicioso aberto no navegador do PC
dispare a ação (CSRF): ele não consegue mandar headers customizados sem CORS.

### Cabeçalhos de segurança

Em todas as respostas: `Content-Security-Policy` (só recursos do próprio LocalDrop; `data:` para
o QR Code e `blob:` para as miniaturas), `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer` e `Cross-Origin-Opener/Resource-Policy: same-origin`.
Conferido no Chrome: nenhum recurso da página foi bloqueado.

### Revisão final de segurança (seção 4 do CLAUDE.md)

| Requisito | Situação | Onde |
|---|---|---|
| PIN aleatório de 6 dígitos por inicialização | ✓ | `sessao.ts` |
| PIN no fragmento da URL | ✓ | `app.ts`, `usePin.ts` |
| Pedir PIN se faltar | ✓ | `Celular.tsx` |
| Comparação em tempo constante | ✓ | `sessao.ts` |
| Bloqueio por tentativas | ✓ 5 erros = 5 min, somando `/api/pin` e `/api/upload` | `tentativas.ts`, `pin.ts` |
| PIN e QR só no próprio PC | ✓ IP + header Host | `loopback.ts` |
| Lista branca + conteúdo | ✓ | `tipos.ts`, `assinatura.ts`, `office.ts`, `validacao.ts` |
| Ignorar Content-Type do cliente | ✓ | `upload.ts` |
| Limites por categoria, configuráveis | ✓ | `config.ts` |
| Streaming, `.part`, limpeza, timeouts, espaço em disco | ✓ | `upload.ts`, `armazenamento.ts` |
| Nunca executar/abrir/extrair | ✓ | (nenhum código faz isso) |
| Zone.Identifier | ✓ | `armazenamento.ts` |
| Nomes sanitizados, sem path traversal | ✓ | `nomes.ts` |
| Nunca sobrescrever | ✓ reserva atômica | `nomes.ts` |
| Erros sem stack trace | ✓ | `app.ts` |
| Sem listagem/download | ✓ | (não existe rota) |
| Firewall documentado, sem desativar | ✓ | `README.md` |
| Extra: CSP e outros cabeçalhos | ✓ | `cabecalhos.ts` |
| Extra: CSRF nas ações da tela do PC | ✓ | `cabecalhos.ts` |

**Limitações conhecidas (aceitas):**
- **HTTP sem criptografia.** Alguém na mesma rede, com as ferramentas certas, pode ver o tráfego,
  inclusive o PIN e os arquivos. HTTPS exigiria um certificado confiável pelo celular, o que é
  complicado numa rede local. Documentado no README: use em redes de confiança.
- O bloqueio de PIN é por IP. Na rede local isso basta: com 5 tentativas a cada 5 minutos,
  adivinhar um PIN de 1 milhão de combinações levaria anos.
- O controle de tentativas guarda um registro por IP na memória, sem limpeza. Numa rede doméstica
  isso são poucas entradas; some ao fechar o LocalDrop.

### Avaliação: gerar um `.exe` único (não implementado)

Seria possível com o recurso **Single Executable Applications (SEA)** do Node: juntar o servidor
num arquivo só (esbuild), embutir o front como asset e injetar tudo numa cópia do `node.exe`.

| A favor | Contra |
|---|---|
| Roda sem Node.js instalado | Arquivo de ~90 MB (leva o Node inteiro) |
| Um arquivo só para copiar | Sem assinatura digital, o Windows mostra "O Windows protegeu o computador" e antivírus podem desconfiar |
| | Precisa gerar o `.exe` de novo a cada mudança, com mais um passo de build para manter |
| | O SEA ainda é um recurso em evolução no Node |

**Recomendação:** não fazer agora. O ganho principal (não precisar do Node.js) só importa para
distribuir a outras pessoas, o que está fora do escopo. O atalho já resolve o uso pessoal.
Fica como próximo passo se um dia o projeto for compartilhado.
