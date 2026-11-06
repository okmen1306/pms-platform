export interface AlertAdapter {
  send(message: string): Promise<void>;
}

/**
 * TL (Day 10): "Telegram adaptörü". Basit bir "sendMessage" çağrısı — Telegram Bot API'nin
 * kendisi zaten minimal (bkz. https://core.telegram.org/bots/api#sendmessage), ekstra bir SDK'ya
 * ihtiyaç yok (procurement-service'in tcmb.adapter.ts'i de aynı şekilde çıplak `fetch` kullanıyor).
 *
 * Bot token/chat id boşsa (yerel geliştirme, bot henüz kurulmamış) SESSİZCE atlanır — Telegram'a
 * gönderilemedi diye logger-service'in kendisi ÇÖKMEMELİ (teknik hatanın DB kaydı zaten
 * `route-log-event.usecase.ts` tarafından güvenceye alınıyor, Telegram sadece "anlık haberdar
 * olma" katmanı, tek doğruluk kaynağı DEĞİL).
 */
export class TelegramAlertAdapter implements AlertAdapter {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly logger: { warn: (msg: string) => void },
  ) {}

  async send(message: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ayarlı değil — uyarı Telegram\'a gönderilmedi (sadece DB\'ye kaydedildi).');
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text: message, parse_mode: 'HTML' }),
    });

    if (!response.ok) {
      // Telegram API kendisi çökmüş/limit aşılmış olabilir — bu, logger-service'in kendi
      // isteğini ÇÖKERTMEMELİ (route-log-event.usecase.ts'teki DB kaydı zaten yapıldı).
      this.logger.warn(`Telegram'a gönderim başarısız (HTTP ${response.status}) — hata zaten DB'ye kaydedildi.`);
    }
  }
}
