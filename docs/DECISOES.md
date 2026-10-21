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
