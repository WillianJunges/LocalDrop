# Checklist de validação manual

Para conferir antes de considerar uma versão pronta. Os testes automatizados (`npm test`) cobrem
as regras; esta lista cobre o que só dá para ver com o PC e o celular de verdade.

## Preparação

- [ ] PC e celular no mesmo Wi-Fi, rede do Windows como **Privada**
- [ ] `npm test` passando
- [ ] Pasta `recebidos/` com algum arquivo antigo, para testar nomes repetidos

## Abrir e fechar

- [ ] Dois cliques no atalho: o terminal mostra endereço e PIN, e o navegador abre a tela do PC
- [ ] Dois cliques de novo com ele aberto: aparece "O LocalDrop já está aberto" e só o navegador abre
- [ ] Alterar um arquivo em `client/src` e abrir pelo atalho: ele recompila sozinho
- [ ] Fechar a janela do terminal encerra o LocalDrop (a página do celular passa a dar erro de conexão)
- [ ] Com outro programa na porta 8787: mensagem clara de porta ocupada

## Tela do PC

- [ ] QR Code, endereço com o IP do Wi-Fi (não `localhost`) e PIN aparecem
- [ ] **Abrir pasta recebidos** abre o Explorer na pasta certa
- [ ] Pelo celular, abrir `http://IP:8787/pc` mostra "Esta tela só abre no computador..."

## Conexão do celular

- [ ] Escanear o QR Code abre a página com "✓ PIN confirmado"
- [ ] O PIN some da barra de endereço depois de carregar
- [ ] Digitar um PIN errado mostra "✗ PIN incorreto"
- [ ] 5 PINs errados: "Bloqueado por tentativas erradas" (espere 5 min ou reinicie o LocalDrop)

## Seleção

- [ ] **Fotos e vídeos** abre a galeria e permite marcar vários
- [ ] **Arquivos** abre o gerenciador já filtrado
- [ ] Escolher em duas rodadas soma as listas; escolher o mesmo arquivo de novo não duplica
- [ ] Miniatura nas fotos e ícone nos outros tipos
- [ ] Um arquivo não permitido (ex.: `.apk`) aparece como recusado antes de enviar
- [ ] Remover um item da lista antes de enviar

## Envio

- [ ] Fotos, um PDF, um docx e um zip chegam em `recebidos/`
- [ ] Vídeo de mais de 1 GB: barra, velocidade e tempo restante coerentes
- [ ] Enviado sai da lista e aparece em "Enviados nesta sessão"
- [ ] Mesma foto duas vezes: a segunda vira `foto (1).jpg` e a tela avisa
- [ ] **Cancelar** no meio de um vídeo: nenhum `.part` fica na pasta, e o item volta para a lista
- [ ] Desligar o Wi-Fi do celular no meio: a fila para com aviso; religar e **Tentar de novo** continua
- [ ] Um `.exe` renomeado para `.pdf` é recusado com "O conteúdo do arquivo não corresponde a um .pdf."
- [ ] Propriedades de um arquivo recebido mostram "Este arquivo veio de outro computador"

## Configuração

- [ ] `localdrop.json` com `"porta": 9000`: o atalho abre na porta 9000
- [ ] `localdrop.json` com uma opção de nome errado: o LocalDrop não abre e explica o erro
- [ ] `limitesMB.imagem` baixo: o celular avisa "Maior que o limite" já na seleção

## PC para o celular (Fase 5)

- [ ] Arrastar um arquivo para **Enviar para o celular**: aparece "Preparando…" e depois "Disponível no celular"
- [ ] **Escolher arquivos** funciona igual
- [ ] Um tipo fora da lista (ex.: `.exe`) aparece como "Não pode ser enviado"
- [ ] No celular, **Do computador** mostra o arquivo em poucos segundos, sem recarregar
- [ ] **Baixar** no celular: o arquivo vai para Downloads e abre normalmente
- [ ] A tela do PC passa a mostrar "✓ Baixado pelo celular"
- [ ] Tirar da lista (✕) no PC: some do celular em poucos segundos
- [ ] Nome com acento (ex.: `férias.jpg`) chega com o nome certo no celular
- [ ] Nome bem comprido: quebra em até 2 linhas no celular, sem sair da tela
- [ ] **Cancelar** no celular pergunta antes; "Sim, cancelar" tira do celular e da tela do PC
- [ ] Tela do PC em monitor largo: tudo visível sem rolar

## Fechar sem terminal (Fase 5)

- [ ] Depois de `npm run atalho`, o atalho abre com a janela do terminal minimizada
- [ ] Fechar a aba do PC: o LocalDrop encerra em ~20 s (a janela minimizada some)
- [ ] F5 na tela do PC: o LocalDrop **não** encerra
- [ ] Duas abas abertas (dois cliques no atalho): fechar uma não encerra; fechar as duas encerra
- [ ] Com um LocalDrop antigo aberto, atualizar o código e clicar no atalho: o antigo fecha e o novo abre
- [ ] Cancelar no celular e atualizar a página: o arquivo **não** volta
- [ ] Fechar a aba durante um envio do celular: o envio termina e só depois o LocalDrop encerra
- [ ] **Encerrar LocalDrop** sem nada em andamento: encerra na hora e a página avisa
- [ ] **Encerrar LocalDrop** durante um envio: pede confirmação na própria página
- [ ] Depois de encerrado, o celular mostra "Sem conexão com o computador"
