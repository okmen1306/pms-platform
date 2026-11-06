import type { AuditPublisherFn } from '@pms/shared';
import type { UserRepository } from '../database/user.repository';

/**
 * Day 22 (canlı doğrulamada yakalandı): identity use-case'leri `actorEmail: null` yayınlıyordu, bu yüzden aktivite
 * akışında admin'in kendi işlemleri "sistem" görünüyordu. Kullanıcı tablosu identity-service'in KENDİ verisi
 * (çapraz servis erişimi yok), bu yüzden e-posta yayın anında burada tek noktadan çözülür. Çözülemezse
 * (kullanıcı silinmiş / DB hatası) audit olayı yine de yayınlanır — denetim kaydı asla e-posta aramasına bağımlı değildir.
 */
export function withActorEmail(publish: AuditPublisherFn, userRepo: Pick<UserRepository, 'findById'>): AuditPublisherFn {
  return async (event) => {
    let actorEmail = event.actorEmail;
    if (!actorEmail && event.actorUserId) {
      try {
        actorEmail = (await userRepo.findById(event.actorUserId))?.email ?? null;
      } catch {
        actorEmail = null;
      }
    }
    return publish({ ...event, actorEmail });
  };
}
