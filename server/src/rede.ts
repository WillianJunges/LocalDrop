import os from 'node:os';

type Interfaces = ReturnType<typeof os.networkInterfaces>;

export interface CandidatoIp {
  interfaceNome: string;
  endereco: string;
}

export interface Descartado extends CandidatoIp {
  motivo: string;
}

export interface EscolhaIp {
  escolhido: CandidatoIp | null;
  /** Outros IPs válidos, do mais para o menos provável. */
  alternativas: CandidatoIp[];
  descartados: Descartado[];
}

// Adaptadores que quase nunca são a rede onde o celular está:
// Hyper-V/WSL, máquinas virtuais, Docker e VPNs.
const ADAPTADOR_VIRTUAL =
  /vethernet|wsl|hyper-v|virtualbox|vbox|vmware|docker|tailscale|zerotier|hamachi|vpn|wireguard|\btap\b|\btun\b|bluetooth/i;
const ADAPTADOR_WIFI = /wi-?fi|wlan|wireless|sem fio/i;
const ADAPTADOR_CABO = /ethernet|\beth\d|\ben\d/i;

/**
 * Escolhe o IPv4 que o celular deve usar para chegar ao PC.
 * Recebe as interfaces por parâmetro para poder ser testada sem depender da máquina.
 */
export function escolherIpLocal(interfaces: Interfaces = os.networkInterfaces()): EscolhaIp {
  const validos: { candidato: CandidatoIp; pontos: number }[] = [];
  const descartados: Descartado[] = [];

  for (const [interfaceNome, enderecos] of Object.entries(interfaces)) {
    for (const info of enderecos ?? []) {
      if (info.family !== 'IPv4') continue;

      const candidato = { interfaceNome, endereco: info.address };
      const motivo = motivoDescarte(interfaceNome, info.address, info.internal);
      if (motivo) {
        descartados.push({ ...candidato, motivo });
      } else {
        validos.push({ candidato, pontos: pontuar(interfaceNome, info.address) });
      }
    }
  }

  validos.sort((a, b) => b.pontos - a.pontos);
  const [primeiro, ...resto] = validos.map((v) => v.candidato);

  return { escolhido: primeiro ?? null, alternativas: resto, descartados };
}

function motivoDescarte(interfaceNome: string, endereco: string, interno: boolean): string | null {
  if (interno) return 'loopback (só funciona no próprio PC)';
  if (endereco.startsWith('169.254.')) return 'sem IP do roteador (link-local)';
  if (ADAPTADOR_VIRTUAL.test(interfaceNome)) return 'adaptador virtual ou VPN';
  if (!ehIpPrivado(endereco)) return 'não é um IP de rede local';
  return null;
}

function pontuar(interfaceNome: string, endereco: string): number {
  let pontos = 0;
  if (ADAPTADOR_WIFI.test(interfaceNome)) pontos += 20;
  else if (ADAPTADOR_CABO.test(interfaceNome)) pontos += 10;

  // Redes domésticas costumam usar 192.168.x.x.
  if (endereco.startsWith('192.168.')) pontos += 3;
  else if (endereco.startsWith('10.')) pontos += 2;
  else pontos += 1;

  return pontos;
}

export function ehIpPrivado(endereco: string): boolean {
  const partes = endereco.split('.').map(Number);
  const [a, b] = partes;
  if (partes.length !== 4 || a === undefined || b === undefined) return false;

  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
