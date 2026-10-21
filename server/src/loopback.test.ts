import { describe, expect, it } from 'vitest';
import { ehHostLocal, ehLoopback } from './loopback.js';

describe('ehLoopback', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('%s é o próprio PC', (ip) => {
    expect(ehLoopback(ip)).toBe(true);
  });

  it.each(['192.168.0.42', '::ffff:192.168.0.42', '10.0.0.1', '', undefined])('%s não é o próprio PC', (ip) => {
    expect(ehLoopback(ip)).toBe(false);
  });
});

describe('ehHostLocal', () => {
  it.each(['localhost:8787', 'LOCALHOST:5173', '127.0.0.1:8787', '[::1]:8787', 'localhost'])('aceita %s', (host) => {
    expect(ehHostLocal(host)).toBe(true);
  });

  it.each(['192.168.0.42:8787', 'site-malicioso.com:8787', 'localhost.evil.com', undefined])('recusa %s', (host) => {
    expect(ehHostLocal(host)).toBe(false);
  });
});
