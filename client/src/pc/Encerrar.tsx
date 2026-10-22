import { useState } from 'react';

interface Props {
  transferencias: number;
  aoEncerrar: () => void;
}

export function Encerrar({ transferencias, aoEncerrar }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function encerrar() {
    setErro(null);
    try {
      const resposta = await fetch('/api/encerrar', { method: 'POST', headers: { 'X-LocalDrop': '1' } });
      if (!resposta.ok) throw new Error(String(resposta.status));
      aoEncerrar();
    } catch {
      setErro('Não foi possível encerrar. O LocalDrop talvez já esteja fechado.');
    }
  }

  if (confirmando) {
    return (
      <div className="encerrar-confirmar" role="alertdialog" aria-labelledby="texto-encerrar">
        <p id="texto-encerrar">
          {transferencias === 1 ? 'Há 1 transferência' : `Há ${transferencias} transferências`} em andamento. Encerrar
          vai interromper.
        </p>
        <div className="encerrar-botoes">
          <button type="button" className="botao botao-perigo" onClick={encerrar}>
            Encerrar mesmo assim
          </button>
          <button type="button" className="botao-texto" onClick={() => setConfirmando(false)}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="encerrar">
      <button
        type="button"
        className="botao-secundario botao-encerrar"
        onClick={() => (transferencias > 0 ? setConfirmando(true) : void encerrar())}
      >
        Encerrar LocalDrop
      </button>
      {erro && (
        <p className="aviso aviso-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
