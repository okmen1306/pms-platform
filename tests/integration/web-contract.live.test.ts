import { describe, it, expect, beforeAll, vi } from 'vitest';

/**
 * Day 19: web/src/features/projects/project.api.ts'in GERÇEK fonksiyonlarını (apiFetch +
 * Authorization + zarf açma + ApiError) canlı api-gateway'e karşı çalıştırır — "curl ile çalışıyor"
 * ile "frontend'in kendi kodu ile çalışıyor" arasındaki farkı kapatır (ör. zarf açma, snake_case
 * alanlar, ApiError.code/details). Bu bir birim testi DEĞİL: `npm test` tarafından ÇALIŞTIRILMAZ
 * (workspace dışı), `run-project-verification.sh` tarafından, ortam değişkenleriyle çağrılır.
 *
 * Gerekli env: GATEWAY_URL, ADMIN_EMAIL, ADMIN_PASSWORD, PROJECT_ID, WP_ID, EMP_A, TEAM_ID, PROJECT_WEEKS
 */
const env = process.env as Record<string, string>;
const missing = ['GATEWAY_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'PROJECT_ID', 'WP_ID', 'EMP_A', 'TEAM_ID', 'PROJECT_WEEKS'].filter((k) => !env[k]);

describe.skipIf(missing.length > 0)('web project.api.ts ↔ canlı gateway (Day 19)', () => {
  let api: typeof import('../../web/src/features/projects/project.api');
  let errors: typeof import('../../web/src/features/projects/projectErrors');
  let ApiError: typeof import('../../web/src/shared/api').ApiError;

  beforeAll(async () => {
    vi.stubEnv('VITE_API_GATEWAY_URL', env.GATEWAY_URL);
    const shared = await import('../../web/src/shared/api');
    ApiError = shared.ApiError;
    api = await import('../../web/src/features/projects/project.api');
    errors = await import('../../web/src/features/projects/projectErrors');

    const res = await fetch(`${env.GATEWAY_URL}/identity/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
    });
    shared.tokenStore.set((await res.json()).data.accessToken);
  });

  it('fetchProject / fetchMasterWorkPackages / fetchProjectWorkPackages zarfı doğru açıyor', async () => {
    const project = await api.fetchProject(env.PROJECT_ID);
    expect(project.id).toBe(env.PROJECT_ID);
    expect(project.sure_hafta).toBe(Number(env.PROJECT_WEEKS));

    const masters = await api.fetchMasterWorkPackages();
    expect(masters.length).toBeGreaterThan(0);
    expect(masters[0]).toHaveProperty('sira_no');

    const wps = await api.fetchProjectWorkPackages(env.PROJECT_ID);
    expect(wps.map((w) => w.id)).toContain(env.WP_ID);
  });

  it('kapasite aşımı: ApiError(409, WEEKLY_CAPACITY_EXCEEDED) + UUID içermeyen kullanıcı mesajı', async () => {
    const err = await api.createWeeklyAllocation(env.PROJECT_ID, env.TEAM_ID, 3, 999).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('WEEKLY_CAPACITY_EXCEEDED');
    const message = errors.describeProjectError(err, { teamName: 'Yazılım Ekibi', projectWeeks: Number(env.PROJECT_WEEKS) });
    expect(message).toContain('Yazılım Ekibi');
    expect(message).not.toContain(env.TEAM_ID);
  });

  it('haftalık planlama upsert + liste', async () => {
    const saved = await api.createWeeklyAllocation(env.PROJECT_ID, env.TEAM_ID, 4, 1);
    expect(saved.hafta_no).toBe(4);
    const list = await api.fetchWeeklyAllocations(env.PROJECT_ID);
    expect(list.some((a) => a.hafta_no === 4 && a.team_id === env.TEAM_ID)).toBe(true);
  });

  it('çakışma ön-kontrolü + çakışan atama: hasConflict=true, sonra ApiError(409, ASSIGNMENT_CONFLICT, details.conflictingAssignmentIds)', async () => {
    const check = await api.checkAssignmentConflict(env.PROJECT_ID, env.EMP_A, '2026-10-15', '2026-10-16');
    expect(check.hasConflict).toBe(true);
    expect(check.conflictingAssignments.length).toBeGreaterThan(0);

    const err = await api.createAssignment(env.PROJECT_ID, env.WP_ID, env.EMP_A, '2026-10-15', '2026-10-16').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('ASSIGNMENT_CONFLICT');
    expect(Array.isArray(err.details?.conflictingAssignmentIds)).toBe(true);
    const message = errors.describeProjectError(err, { employeeName: 'Ali Kaya' });
    expect(message).toContain('Ali Kaya');
    expect(message).not.toContain(env.EMP_A);
  });

  it('çakışmayan atama başarılı + atama listesi', async () => {
    const created = await api.createAssignment(env.PROJECT_ID, env.WP_ID, env.EMP_A, '2026-11-16', '2026-11-20');
    expect(created.employee_id).toBe(env.EMP_A);
    expect(created.tamamlandi_mi).toBe(false);
    const list = await api.fetchAssignments(env.PROJECT_ID);
    expect(list.some((a) => a.id === created.id)).toBe(true);
  });

  it('kilometre taşı + iş taslağı: yaz → oku', async () => {
    const milestone = await api.createMilestone(env.PROJECT_ID, '2026-11-30', 'Frontend sözleşme testi');
    expect((await api.fetchMilestones(env.PROJECT_ID)).some((m) => m.id === milestone.id)).toBe(true);

    const cell = await api.setWorkDraftCell(env.PROJECT_ID, env.WP_ID, 2, true);
    expect(cell.boyali).toBe(true);
    expect((await api.fetchWorkDraft(env.PROJECT_ID)).some((c) => c.hafta_no === 2 && c.boyali)).toBe(true);
  });

  it('token olmadan (oturum düşmüş) çağrı ApiError(401) fırlatır', async () => {
    const shared = await import('../../web/src/shared/api');
    const saved = shared.tokenStore.get();
    shared.tokenStore.set(null);
    const err = await api.fetchProject(env.PROJECT_ID).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    shared.tokenStore.set(saved);
  });
});

/**
 * Day 20: Project modülünün KALAN fonksiyonları (liste/oluştur/düzenle/katalog/iş günü/tamamla/alt iş
 * paketi) + finance, performance, risk ve kur — hepsi web'in KENDİ api dosyalarıyla, canlı gateway'e karşı.
 * Ek env: PROJECT2_ID, GROUP_ID, PRODUCT_ID, LEADER_ID, CRIT_ID, PERSONEL_TOKEN
 */
const day20Missing = ['GATEWAY_URL', 'PROJECT_ID', 'PROJECT2_ID', 'WP_ID', 'EMP_A', 'TEAM_ID', 'GROUP_ID', 'PRODUCT_ID', 'LEADER_ID', 'CRIT_ID', 'PERSONEL_TOKEN'].filter((k) => !env[k]);

describe.skipIf(day20Missing.length > 0)('Day 20: web api dosyaları ↔ canlı gateway', () => {
  let api: typeof import('../../web/src/features/projects/project.api');
  let errors: typeof import('../../web/src/features/projects/projectErrors');
  let finance: typeof import('../../web/src/features/finance/finance.api');
  let performance: typeof import('../../web/src/features/performance/performance.api');
  let risk: typeof import('../../web/src/features/risk/risk.api');
  let rate: typeof import('../../web/src/shared/hooks/useExchangeRate');
  let shared: typeof import('../../web/src/shared/api');

  beforeAll(async () => {
    vi.stubEnv('VITE_API_GATEWAY_URL', env.GATEWAY_URL);
    shared = await import('../../web/src/shared/api');
    api = await import('../../web/src/features/projects/project.api');
    errors = await import('../../web/src/features/projects/projectErrors');
    finance = await import('../../web/src/features/finance/finance.api');
    performance = await import('../../web/src/features/performance/performance.api');
    risk = await import('../../web/src/features/risk/risk.api');
    rate = await import('../../web/src/shared/hooks/useExchangeRate');
    const res = await fetch(`${env.GATEWAY_URL}/identity/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
    });
    shared.tokenStore.set((await res.json()).data.accessToken);
  });

  it('proje listesi + filtreler (durum, ekipLideriId)', async () => {
    const all = await api.fetchProjects();
    expect(all.map((p) => p.id)).toEqual(expect.arrayContaining([env.PROJECT_ID, env.PROJECT2_ID]));
    expect(await api.fetchProjects({ durum: 'tamamlandi' })).toEqual([]);
    const byLeader = await api.fetchProjects({ ekipLideriId: env.LEADER_ID });
    expect(byLeader.length).toBeGreaterThanOrEqual(2);
  });

  it('katalog (grup → ürünler) ve iş günü önizlemesi (Kural #3)', async () => {
    expect((await api.fetchProductGroups()).map((g) => g.id)).toContain(env.GROUP_ID);
    expect((await api.fetchProducts(env.GROUP_ID)).map((p) => p.id)).toContain(env.PRODUCT_ID);
    expect((await api.fetchBusinessDays('2026-10-05', '2026-11-27')).totalBusinessDays).toBe(40);
  });

  it('sihirbaz akışı: createProject → updateProject; süre kısaltma 409 → describeProjectError (ekip adı, UUID yok)', async () => {
    const created = await api.createProject({
      projeAdi: 'Sözleşme Testi Projesi', baslangicTarihi: '2026-10-05', bitisTarihi: '2026-11-27',
      productGroupId: env.GROUP_ID, productId: env.PRODUCT_ID, ekipLideriId: env.LEADER_ID,
      tahminiMaliyetTl: 80000, idariMaliyetOrani: 0.15,
    });
    expect(created.sure_hafta).toBe(8);
    expect(created.idari_maliyet_orani).toBe(0.15);

    const renamed = await api.updateProject(created.id, { projeAdi: 'Sözleşme Testi (düzenlendi)' });
    expect(renamed.proje_adi).toBe('Sözleşme Testi (düzenlendi)');
    expect((await api.fetchProject(created.id)).proje_adi).toBe('Sözleşme Testi (düzenlendi)');

    await api.createWeeklyAllocation(created.id, env.TEAM_ID, 1, 5);
    const err = await api.updateProject(created.id, { bitisTarihi: '2026-10-16' }).catch((e) => e);
    expect(err).toBeInstanceOf(shared.ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('WEEKLY_CAPACITY_EXCEEDED');
    const message = errors.describeProjectError(err, { teamName: 'Yazılım Ekibi', projectWeeks: 2 });
    expect(message).toContain('Yazılım Ekibi');
    expect(message).not.toContain(env.TEAM_ID);
    expect((await api.fetchProject(created.id)).sure_hafta).toBe(8); // kayıt değişmedi
  });

  it('atama tamamlama (PATCH) ve alt iş paketi CRUD (POST/PATCH/DELETE)', async () => {
    const assignment = await api.createAssignment(env.PROJECT_ID, env.WP_ID, env.EMP_A, '2027-01-04', '2027-01-08');
    expect(assignment.tamamlandi_mi).toBe(false);
    const done = await api.completeAssignment(assignment.id);
    expect(done.tamamlandi_mi).toBe(true);
    expect(done.tamamlanma_tarihi).not.toBeNull();

    const sub = await api.addSubWorkPackage(env.WP_ID, { ad: 'Sözleşme alt paketi', baslangicHafta: 1, bitisHafta: 2 });
    expect((await api.fetchSubWorkPackages(env.WP_ID)).map((x) => x.id)).toContain(sub.id);
    const edited = await api.updateSubWorkPackage(sub.id, { ad: 'Düzenlendi', bitisHafta: 3 });
    expect(edited.ad).toBe('Düzenlendi');
    expect(edited.bitis_hafta).toBe(3);
    await api.deleteSubWorkPackage(sub.id);
    expect((await api.fetchSubWorkPackages(env.WP_ID)).map((x) => x.id)).not.toContain(sub.id);
  });

  it('finance: maliyet + haftalık AR-GE dökümü (süper admin); izinsiz kullanıcı ApiError(403, FORBIDDEN_PAGE_ACCESS)', async () => {
    const cost = await finance.fetchProjectCost(env.PROJECT_ID);
    expect(cost.project_id).toBe(env.PROJECT_ID);
    expect(typeof cost.toplam_gerceklesen_maliyet_tl).toBe('number');
    expect((await finance.fetchPersonnelWeeklyCost(env.PROJECT_ID)).length).toBeGreaterThan(0);

    const adminToken = shared.tokenStore.get();
    shared.tokenStore.set(env.PERSONEL_TOKEN);
    const err = await finance.fetchProjectCost(env.PROJECT_ID).catch((e) => e);
    shared.tokenStore.set(adminToken);
    expect(err).toBeInstanceOf(shared.ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN_PAGE_ACCESS');
  });

  it('performance: kriter listesi + puan yaz/oku', async () => {
    expect((await performance.fetchCriteria()).map((c) => c.id)).toContain(env.CRIT_ID);
    await performance.submitEmployeeScore(env.PROJECT2_ID, env.EMP_A, env.CRIT_ID, 85);
    const scores = await performance.fetchEmployeeScores(env.PROJECT2_ID, env.EMP_A);
    expect(scores.some((s) => s.criterion_id === env.CRIT_ID && Number(s.puan) === 85)).toBe(true);
    const err = await performance.submitEmployeeScore(env.PROJECT2_ID, env.EMP_A, env.CRIT_ID, 150).catch((e) => e);
    expect(err).toBeInstanceOf(shared.ApiError);
    expect(err.status).toBe(422);
  });

  it('risk: oluştur → listele → durum → güncelle → sil (PATCH/DELETE dahil)', async () => {
    const created = await risk.createRisk(env.PROJECT_ID, 'Sözleşme riski', 3, 4, 'açıklama', 'strateji');
    expect(created.oncelik_puani).toBe(12);
    expect((await risk.fetchRisks(env.PROJECT_ID)).map((r) => r.id)).toContain(created.id);
    expect((await risk.updateRiskStatus(created.id, 'izleniyor')).durum).toBe('izleniyor');
    expect((await risk.updateRisk(created.id, { olasilik: 2 })).oncelik_puani).toBe(8);
    await risk.deleteRisk(created.id);
    expect((await risk.fetchRisks(env.PROJECT_ID)).map((r) => r.id)).not.toContain(created.id);
  });

  it('kur: /integration/exchange-rate/current → useExchangeRate sözleşmesi + tlToUsd', async () => {
    const current = await shared.apiFetch<{ tarih: string; usdTry: number }>('/integration/exchange-rate/current');
    expect(current.usdTry).toBe(41.25);
    expect(rate.tlToUsd(80000, current.usdTry)).toBe(1939.39);
  });
});
