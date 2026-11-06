import type { FastifyReply } from 'fastify';

/**
 * TL (Day 10): "Canlı Aktivite Akışı" (docs/roadmap.md Bölüm 17.4). Tek process içinde bellek içi
 * bir istemci listesi — logger-service tek instance çalıştığı sürece (roadmap'in ölçeklenme
 * notunda "gerektiğinde birden fazla instance" dense de, SSE bağlantıları process-local olduğundan
 * birden fazla instance'a ölçeklenirse Redis pub/sub'a taşınması gerekir; bu, bugünün kapsamı
 * DEĞİL — Uzman İnisiyatifi, basit başla).
 */
export class SseBroadcaster {
  private readonly clients = new Set<FastifyReply>();

  subscribe(reply: FastifyReply): void {
    this.clients.add(reply);
  }

  unsubscribe(reply: FastifyReply): void {
    this.clients.delete(reply);
  }

  broadcast(event: Record<string, unknown>): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      client.raw.write(payload);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
