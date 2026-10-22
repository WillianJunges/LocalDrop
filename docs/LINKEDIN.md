# Post final do LinkedIn

Duas versões, baseadas só no que está no [diário](DIARIO.md). Antes de publicar, revise o tom
para ficar com a sua cara.

> **Confira o gancho:** "mandar foto pro meu próprio WhatsApp" foi uma suposição a partir do
> prompt original (que citava WhatsApp). Se a sua dor real era outra (cabo, e-mail, nuvem),
> troque a primeira linha.

**Mídia sugerida:** GIF de ~15 s com o fluxo completo (duplo clique no atalho → QR Code →
celular escolhendo fotos → barra de progresso → arquivos na pasta). Alternativa: carrossel com
4 imagens (atalho, tela do PC com QR, celular enviando, pasta com os arquivos).

---

## Versão completa

Eu cansei de mandar foto pro meu próprio WhatsApp só pra ela chegar no PC. 📱➡️💻

Então construí o LocalDrop: escaneio um QR Code e mando fotos, vídeos e documentos do celular
para o computador pelo Wi-Fi de casa. Sem cabo, sem nuvem, sem conta e sem instalar app no
celular.

Já existem ferramentas prontas para isso, e eu conheço algumas. Mesmo assim quis fazer a minha:
para aprender, e porque queria entender cada parte.

Foram 4 fases, documentadas aqui:
1️⃣ Servidor local, QR Code e PIN
2️⃣ Upload seguro
3️⃣ Interface do celular
4️⃣ Abrir com um clique

O que mais me ensinou:

🔐 Segurança numa rede "confiável" também importa. Qualquer aparelho no mesmo Wi-Fi enxerga o
servidor. Por isso: PIN por sessão (escondido no QR Code, numa parte da URL que nunca chega ao
servidor), bloqueio após 5 tentativas e proteção contra DNS rebinding.

🕵️ A extensão do arquivo mente. Renomeei um executável para "boleto.pdf" e ele não passou: o
servidor confere os primeiros bytes de cada arquivo. E um .docx é um zip por dentro, então dá
para recusar documentos com macro sem extrair nada.

🎬 Arquivo grande pede streaming. Vídeos de vários GB vão direto para o disco, em pedaços: num
teste, 300 MB passaram usando menos de 100 MB de memória. Se o Wi-Fi cai, o arquivo pela metade
é apagado sozinho.

📲 Testar no celular de verdade muda tudo. Usando o app, percebi que o arquivo enviado ficava na
tela e que selecionar vários no Android não era óbvio. Viraram requisitos.

🐛 Ainda esbarrei num bug do próprio Node.js no Windows, que derrubava o processo ao sair logo
depois de um fetch. Isolei em 3 linhas e contornei.

Sobre IA: construí com o Claude Code. Ele acelerou muito a escrita do código e dos testes e
apontou riscos que eu não teria visto, como o DNS rebinding. As decisões de escopo, os testes no
celular, os problemas de usabilidade e todo o Git e os PRs ficaram comigo. Para mim, esse é o
jeito certo de usar: a IA como par, não como piloto automático.

📊 169 testes automatizados, 15 tipos de arquivo, 4 PRs.
🛠️ Node.js, TypeScript, Express, React e Vite.

Código, decisões técnicas e o diário de cada fase:
👉 https://github.com/WillianJunges/LocalDrop

Próximo passo? Talvez enviar também do PC para o celular.

#NodeJS #TypeScript #React #SegurançaDaInformação #ProjetoPessoal

---

## Versão curta

Eu cansei de mandar foto pro meu próprio WhatsApp só pra ela chegar no PC. 📱➡️💻

Construí o LocalDrop: escaneio um QR Code e mando fotos, vídeos e documentos do celular para o
computador pelo Wi-Fi. Sem cabo, sem nuvem, sem app no celular.

Três aprendizados:
🔐 Rede de casa não é sinônimo de segura: PIN por sessão e bloqueio por tentativas.
🕵️ A extensão mente: um executável renomeado para .pdf é barrado pelos primeiros bytes.
🎬 Vídeos de GB vão em streaming direto para o disco, sem estourar a memória.

Feito em 4 fases com o Claude Code: ele acelerou o código e os testes; escopo, testes no celular
e Git ficaram comigo.

169 testes · Node.js · TypeScript · React
👉 https://github.com/WillianJunges/LocalDrop

#NodeJS #TypeScript #React #ProjetoPessoal
