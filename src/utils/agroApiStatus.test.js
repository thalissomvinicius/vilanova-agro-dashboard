import { describe, expect, it } from 'vitest';
import {
  classifyAgroApiHeartbeat,
  formatHeartbeatAge,
  heartbeatAgeMs,
  HEARTBEAT_HEALTH,
  statusTone,
} from './agroApiStatus';

const NOW = Date.parse('2026-07-28T16:30:00.000Z');

function heartbeat(overrides = {}) {
  return {
    status: 'online',
    api_status: 'online',
    database_status: 'online',
    vpn_status: 'online',
    received_at: '2026-07-28T16:29:30.000Z',
    ...overrides,
  };
}

describe('AGRO API heartbeat status', () => {
  it('classifies a recent fully operational heartbeat as online', () => {
    expect(classifyAgroApiHeartbeat(heartbeat(), NOW)).toBe(HEARTBEAT_HEALTH.ONLINE);
  });

  it('warns when the SQL or VPN dependency is unavailable', () => {
    expect(classifyAgroApiHeartbeat(heartbeat({ database_status: 'offline' }), NOW))
      .toBe(HEARTBEAT_HEALTH.WARNING);
    expect(classifyAgroApiHeartbeat(heartbeat({ vpn_status: 'offline' }), NOW))
      .toBe(HEARTBEAT_HEALTH.WARNING);
  });

  it('marks stale and stopped heartbeats as warning or offline', () => {
    expect(classifyAgroApiHeartbeat(heartbeat({
      received_at: '2026-07-28T16:27:30.000Z',
    }), NOW)).toBe(HEARTBEAT_HEALTH.WARNING);

    expect(classifyAgroApiHeartbeat(heartbeat({
      received_at: '2026-07-28T16:20:00.000Z',
    }), NOW)).toBe(HEARTBEAT_HEALTH.OFFLINE);
  });

  it('uses the Supabase receive time and formats its age', () => {
    expect(heartbeatAgeMs(heartbeat(), NOW)).toBe(30_000);
    expect(formatHeartbeatAge(30_000)).toBe('há 30 s');
    expect(formatHeartbeatAge(150_000)).toBe('há 2 min');
  });

  it('maps dependency states to visual tones', () => {
    expect(statusTone('online')).toBe('success');
    expect(statusTone('warning')).toBe('warning');
    expect(statusTone('offline')).toBe('danger');
    expect(statusTone('unknown')).toBe('neutral');
  });
});
