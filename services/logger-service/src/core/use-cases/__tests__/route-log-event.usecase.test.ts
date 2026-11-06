import { describe, it, expect } from 'vitest';
import { routeLogEvent } from '../route-log-event.usecase';
import type { ErrorEventRepository, ErrorEventRow, CreateErrorEventRow } from '../../../infrastructure/database/error-log.repository';
import type { AlertAdapter } from '../../../infrastructure/providers/telegram.adapter';
import type { LogEvent } from '@pms/shared';

class InMemoryErrorEventRepository implements ErrorEventRepository {
  public inserted: CreateErrorEventRow[] = [];
  async insert(row: CreateErrorEventRow): Promise<ErrorEventRow> {
    this.inserted.push(row);
    return { id: `error-${this.inserted.length}`, created_at: new Date().toISOString(), meta: null, ...row } as ErrorEventRow;
  }
}

class FakeAlertAdapter implements AlertAdapter {
  public sent: string[] = [];
  async send(message: string): Promise<void> {
    this.sent.push(message);
  }
}

function makeEvent(overrides: Partial<LogEvent> = {}): LogEvent {
  return { level: 'info', service: 'project-service', message: 'test mesajı', ...overrides };
}

describe('routeLogEvent', () => {
  it('her seviye DB\'ye kaydedilir', async () => {
    const repo = new InMemoryErrorEventRepository();
    const alert = new FakeAlertAdapter();
    await routeLogEvent(makeEvent({ level: 'info' }), repo, alert);
    await routeLogEvent(makeEvent({ level: 'warning' }), repo, alert);
    expect(repo.inserted).toHaveLength(2);
  });

  it('info/warning seviyesi Telegram\'a GÖNDERİLMEZ (sadece DB)', async () => {
    const repo = new InMemoryErrorEventRepository();
    const alert = new FakeAlertAdapter();
    await routeLogEvent(makeEvent({ level: 'info' }), repo, alert);
    await routeLogEvent(makeEvent({ level: 'warning' }), repo, alert);
    expect(alert.sent).toHaveLength(0);
  });

  it('error seviyesi HEM DB\'ye HEM Telegram\'a gönderilir', async () => {
    const repo = new InMemoryErrorEventRepository();
    const alert = new FakeAlertAdapter();
    await routeLogEvent(makeEvent({ level: 'error', message: 'bağlantı koptu' }), repo, alert);
    expect(repo.inserted).toHaveLength(1);
    expect(alert.sent).toHaveLength(1);
    expect(alert.sent[0]).toContain('bağlantı koptu');
  });

  it('fatal seviyesi de Telegram\'a gönderilir', async () => {
    const repo = new InMemoryErrorEventRepository();
    const alert = new FakeAlertAdapter();
    await routeLogEvent(makeEvent({ level: 'fatal' }), repo, alert);
    expect(alert.sent).toHaveLength(1);
  });

  it('meta verilmezse null olarak kaydedilir', async () => {
    const repo = new InMemoryErrorEventRepository();
    const alert = new FakeAlertAdapter();
    await routeLogEvent(makeEvent(), repo, alert);
    expect(repo.inserted[0].meta).toBeNull();
  });
});
