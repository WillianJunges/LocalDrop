import type os from 'node:os';
import { describe, expect, it } from 'vitest';
import { ehIpPrivado, escolherIpLocal } from './rede.js';

type Interfaces = ReturnType<typeof os.networkInterfaces>;

function ipv4(address: string, internal = false): os.NetworkInterfaceInfo {
  return { address, family: 'IPv4', internal, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null };
}

describe('escolherIpLocal', () => {
  it('prefere o Wi-Fi e ignora loopback e adaptadores virtuais', () => {
    const interfaces: Interfaces = {
      'Loopback Pseudo-Interface 1': [ipv4('127.0.0.1', true)],
      'vEthernet (WSL)': [ipv4('172.20.16.1')],
      'VirtualBox Host-Only Network': [ipv4('192.168.56.1')],
      Ethernet: [ipv4('10.0.0.5')],
      'Wi-Fi': [ipv4('192.168.0.42')],
    };

    const escolha = escolherIpLocal(interfaces);

    expect(escolha.escolhido).toEqual({ interfaceNome: 'Wi-Fi', endereco: '192.168.0.42' });
    expect(escolha.alternativas).toEqual([{ interfaceNome: 'Ethernet', endereco: '10.0.0.5' }]);
    expect(escolha.descartados.map((d) => d.interfaceNome)).toEqual([
      'Loopback Pseudo-Interface 1',
      'vEthernet (WSL)',
      'VirtualBox Host-Only Network',
    ]);
  });

  it('ignora IPv6, link-local e IPs públicos', () => {
    const interfaces: Interfaces = {
      'Wi-Fi': [
        { ...ipv4('fe80::1'), family: 'IPv6', scopeid: 0 },
        ipv4('169.254.10.10'),
      ],
      Ethernet: [ipv4('8.8.8.8')],
    };

    const escolha = escolherIpLocal(interfaces);

    expect(escolha.escolhido).toBeNull();
    expect(escolha.descartados.map((d) => d.endereco)).toEqual(['169.254.10.10', '8.8.8.8']);
  });

  it('nunca escolhe localhost', () => {
    const escolha = escolherIpLocal({ lo: [ipv4('127.0.0.1', true)] });
    expect(escolha.escolhido).toBeNull();
  });

  it('usa cabo quando não há Wi-Fi', () => {
    const escolha = escolherIpLocal({ Ethernet: [ipv4('192.168.1.10')] });
    expect(escolha.escolhido?.endereco).toBe('192.168.1.10');
  });
});

describe('ehIpPrivado', () => {
  it.each(['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1'])('%s é privado', (ip) => {
    expect(ehIpPrivado(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', 'abc'])('%s não é privado', (ip) => {
    expect(ehIpPrivado(ip)).toBe(false);
  });
});
