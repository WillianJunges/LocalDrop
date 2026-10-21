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
