import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '@pms/shared';
import { sendTemplatedEmail } from '../core/use-cases/send-templated-email.usecase';
import type { EmailTemplateRepository } from '../infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../infrastructure/providers/smtp.adapter';

const CreateTemplateBodySchema = z.object({
  kod: z.string().min(1),
  dil: z.enum(['tr', 'en']),
  konu: z.string().min(1),
  govdeHtml: z.string().min(1),
});

/**
 * Day 4: sadece şablon yönetimi endpoint'i. Gerçek otomatik tetikleme (project.created,
 * assignment.created, work_package.completed/delayed event consumer'ları) Day 5'te eklenecek
 * — bugün sadece transport + şablon altyapısı hazırlanıyor.
 */
export function registerNotificationRoutes(
  app: FastifyInstance,
  deps: { templateRepo: EmailTemplateRepository; emailAdapter: EmailAdapter },
) {
  app.post('/email-templates', async (request) => {
    const body = CreateTemplateBodySchema.parse(request.body);
    const created = await deps.templateRepo.create({
      kod: body.kod,
      dil: body.dil,
      konu: body.konu,
      govde_html: body.govdeHtml,
    });
    return ok(created);
  });

  // Geliştirme/test amaçlı manuel tetikleme endpoint'i (prod'da kaldırılacak veya admin-only yapılacak)
  app.post('/email-templates/:kod/test-send', async (request) => {
    const { kod } = z.object({ kod: z.string() }).parse(request.params);
    const body = z
      .object({ to: z.string().email(), dil: z.enum(['tr', 'en']).default('tr'), context: z.record(z.unknown()).default({}) })
      .parse(request.body);
    await sendTemplatedEmail({ templateCode: kod, dil: body.dil, to: body.to, context: body.context }, deps.templateRepo, deps.emailAdapter);
    return ok({ triggered: true });
  });
}
