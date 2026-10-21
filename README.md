# LocalDrop

Envie arquivos do celular Android para o PC Windows pelo Wi-Fi de casa.
Sem nuvem, sem cabo, sem conta, sem instalar app no celular.

> Projeto pessoal em construção. Fase atual: **1 de 4** (servidor, tela do PC com QR Code e PIN).

## Como funciona

1. Você inicia o LocalDrop no PC.
2. A tela do PC mostra um QR Code e um PIN de 6 dígitos.
3. Você escaneia o QR Code com o celular (no mesmo Wi-Fi) e a página abre no navegador.
4. *(Fase 2 e 3)* Você escolhe os arquivos e eles chegam na pasta `recebidos/`.

## Requisitos

- Windows 10 ou 11
- [Node.js](https://nodejs.org/) 22 ou mais recente (LTS)
- PC e celular no **mesmo Wi-Fi**, com a rede marcada como **Privada** no Windows

## Instalação

```bash
npm install
npm run build
```

## Uso

```bash
npm start
```

Abra `http://localhost:8787/pc` no navegador do PC e escaneie o QR Code.

Na primeira vez, o Firewall do Windows vai perguntar se o Node.js pode acessar a rede.
Marque **apenas "Redes privadas"**. Não é preciso (nem recomendado) desativar o firewall.

## Scripts

| Comando             | O que faz                                                           |
|---------------------|---------------------------------------------------------------------|
| `npm run dev`       | Servidor + Vite com recarregamento automático (só acessível no PC)  |
| `npm run build`     | Compila front e back                                                |
| `npm start`         | Roda a versão compilada (é a que o celular acessa)                  |
| `npm test`          | Testes automatizados                                                |
| `npm run typecheck` | Verificação de tipos                                                |

Em `npm run dev`, abra `http://localhost:5173/pc`. Para testar no celular, use `npm run build && npm start`.

## Configuração

| Variável         | Padrão                 | Descrição                    |
|------------------|------------------------|------------------------------|
| `LOCALDROP_PORTA`| `8787`                 | Porta do servidor            |
| `LOCALDROP_DIR`  | `recebidos/` no projeto| Pasta onde os arquivos caem  |

## Problemas comuns

- **O celular não abre a página:** confira se os dois estão no mesmo Wi-Fi, se a rede do Windows
  está como *Privada* (Configurações → Rede e Internet → Wi-Fi → propriedades da rede) e se o
  firewall foi liberado para redes privadas.
- **Funciona em casa mas não em outro lugar:** redes de hotel, faculdade ou "convidados" costumam ter
  *isolamento de clientes*, que impede um aparelho de falar com o outro.
- **Endereço com IP errado:** o terminal lista os IPs ignorados e o motivo. VPNs e adaptadores
  virtuais (WSL, VirtualBox) são descartados de propósito.
- **Porta ocupada:** feche o outro programa ou rode com outra porta (`set LOCALDROP_PORTA=9000`).

## Segurança

Veja [docs/DECISOES.md](docs/DECISOES.md). Resumo: PIN por sessão, tela do PIN acessível só no
próprio PC e nenhum dado sai da rede local. A conexão é HTTP sem criptografia dentro da rede
local, então use em redes em que você confia.

## Stack

Node.js · TypeScript · Express · React · Vite · Vitest
