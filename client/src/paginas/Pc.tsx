import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { Limites } from '../envio/regras';
import { Encerrar } from '../pc/Encerrar';
import { EnviarParaCelular } from '../pc/EnviarParaCelular';
import { usePresenca } from '../pc/usePresenca';

interface Sessao {
  pin: string;
  enderecoCelular: string | null;
  urlQrCode: string | null;
  interfaceNome: string | null;
  pasta: string;
  chavePc: string;
  limites: Limites;
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; sessao: Sessao; qrCode: string | null };

async function carregarSessao(): Promise<{ sessao: Sessao; qrCode: string | null }> {
  const resposta = await fetch('/api/sessao');
  if (!resposta.ok) {
    throw new Error(
      resposta.status === 403
        ? 'Esta tela só abre no computador onde o LocalDrop está rodando.'
        : 'Não foi possível obter os dados do servidor.',
    );
  }
  const sessao = (await resposta.json()) as Sessao;
  const qrCode = sessao.urlQrCode ? await QRCode.toDataURL(sessao.urlQrCode, { width: 240, margin: 1 }) : null;
  return { sessao, qrCode };
}

export function Pc() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [encerrado, setEncerrado] = useState(false);
  const chave = estado.tipo === 'pronto' ? estado.sessao.chavePc : null;
  const { transferencias, conectado } = usePresenca(chave, !encerrado);

  useEffect(() => {
    carregarSessao()
      .then(({ sessao, qrCode }) => setEstado({ tipo: 'pronto', sessao, qrCode }))
      .catch((erro: unknown) =>
        setEstado({
          tipo: 'erro',
          mensagem: erro instanceof Error ? erro.message : 'Não foi possível conectar ao servidor.',
        }),
      );
  }, []);

  if (encerrado) {
    return (
      <main className="pagina pagina-pc">
        <h1>LocalDrop</h1>
        <p className="aviso aviso-ok" role="status">
          <strong>LocalDrop encerrado.</strong> Pode fechar esta aba. Para abrir de novo, use o atalho LocalDrop na
          Área de Trabalho.
        </p>
      </main>
    );
  }

  return (
    <main className="pagina pagina-pc">
      <header className="cabecalho-pc">
        <div>
          <h1>LocalDrop</h1>
          <p className="subtitulo">Troque arquivos entre o celular e este computador pelo Wi-Fi.</p>
        </div>
        {estado.tipo === 'pronto' && conectado && (
          <Encerrar transferencias={transferencias} aoEncerrar={() => setEncerrado(true)} />
        )}
      </header>

      {!conectado && (
        <p className="aviso aviso-erro" role="alert">
          <strong>O LocalDrop não está mais aberto.</strong> Para usar de novo, abra pelo atalho na Área de Trabalho.
        </p>
      )}

      {estado.tipo === 'carregando' && <p role="status">Carregando…</p>}

      {estado.tipo === 'erro' && (
        <p className="aviso aviso-erro" role="alert">
          <strong>Erro:</strong> {estado.mensagem}
        </p>
      )}

      {estado.tipo === 'pronto' && <Conexao sessao={estado.sessao} qrCode={estado.qrCode} />}
    </main>
  );
}

function Conexao({ sessao, qrCode }: { sessao: Sessao; qrCode: string | null }) {
  if (!sessao.enderecoCelular || !qrCode) {
    return (
      <p className="aviso aviso-erro" role="alert">
        <strong>Sem rede local:</strong> não encontrei um IP de Wi-Fi neste computador. Confira se ele está
        conectado ao Wi-Fi e reinicie o LocalDrop.
      </p>
    );
  }

  return (
    <div className="conexao">
      <section className="cartao qr" aria-labelledby="titulo-qr">
        <h2 id="titulo-qr">Escaneie com o celular</h2>
        <img src={qrCode} width={240} height={240} alt={`QR Code para abrir ${sessao.enderecoCelular}`} />

        <h2>Ou digite no navegador do celular</h2>
        <p className="endereco">{sessao.enderecoCelular}</p>

        <h2>PIN</h2>
        <p className="pin" aria-label={`PIN ${sessao.pin.split('').join(' ')}`}>
          {sessao.pin}
        </p>
        <p className="dica">O QR Code já inclui o PIN. Ele muda sempre que o LocalDrop reinicia.</p>
      </section>

      <section className="cartao cartao-conectar" aria-labelledby="titulo-conectar">
        <h2 id="titulo-conectar">Como conectar</h2>
        <ol className="passos">
          <li>Conecte o celular no mesmo Wi-Fi deste computador.</li>
          <li>Abra a câmera e aponte para o QR Code.</li>
          <li>Se o Windows perguntar, permita o acesso apenas em <strong>Redes privadas</strong>.</li>
        </ol>
        {sessao.interfaceNome && <p className="dica">Rede usada: {sessao.interfaceNome}</p>}
      </section>

      <PastaRecebidos pasta={sessao.pasta} />
      <EnviarParaCelular limites={sessao.limites} />
    </div>
  );
}

function PastaRecebidos({ pasta }: { pasta: string }) {
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setErro(null);
    try {
      // O header X-LocalDrop mostra ao servidor que o pedido veio desta página (proteção contra CSRF).
      const resposta = await fetch('/api/abrir-pasta', { method: 'POST', headers: { 'X-LocalDrop': '1' } });
      if (!resposta.ok) setErro('Não foi possível abrir a pasta.');
    } catch {
      setErro('O LocalDrop não está respondendo. Ele ainda está aberto?');
    }
  }

  return (
    <section className="cartao cartao-pasta" aria-labelledby="titulo-pasta">
      <h2 id="titulo-pasta">Arquivos recebidos</h2>
      <p className="endereco endereco-pasta">{pasta}</p>
      <button type="button" className="botao botao-pasta" onClick={abrir}>
        Abrir pasta recebidos
      </button>
      {erro && (
        <p className="aviso aviso-erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  );
}
