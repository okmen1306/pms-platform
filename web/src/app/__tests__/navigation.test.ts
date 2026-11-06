import { describe, it, expect } from 'vitest';
import { DEFAULT_ROLE_MATRIX, SEED_ROLE_KODLARI, type SeedRoleKod } from '@pms/shared';
import { NAV_GROUPS, permissionForPath, visibleNavGroups } from '../navigation';

const canFor = (rol: SeedRoleKod) => (key: string) => !!DEFAULT_ROLE_MATRIX[rol][key as keyof (typeof DEFAULT_ROLE_MATRIX)[SeedRoleKod]];
const labels = (rol: SeedRoleKod) => visibleNavGroups(canFor(rol)).flatMap((g) => g.items.map((i) => i.label));

describe('AppShell menü görünürlüğü (Day 21, F1) — seed matrisine karşı', () => {
  it('sirket_yoneticisi: tüm menü öğelerini görür', () => {
    expect(labels('sirket_yoneticisi')).toHaveLength(NAV_GROUPS.flatMap((g) => g.items).length);
  });
  it('personel: yalnızca Projeler + Performans + Risk (maaş/finans/admin/satın alma YOK)', () => {
    expect(labels('personel')).toEqual(['Projeler', 'Personel Performansı', 'Ekip Performansı', 'Puanlama', 'Risk Kaydı']);
  });
  it('satinalma_personeli: yalnızca Malzemeler', () => {
    expect(labels('satinalma_personeli')).toEqual(['Malzemeler']);
  });
  it('ekip_lideri: finans ve yönetim menüsü YOK; raporlar VAR', () => {
    const l = labels('ekip_lideri');
    expect(l).not.toContain('Maliyet Analizi');
    expect(l).not.toContain('Roller');
    expect(l).toContain('İş Akışı');
  });
  it('ik_yoneticisi: yalnızca Personel + Ekipler + Kullanıcılar (admin.users.manage; Roller/İzin Matrisi YOK)', () => {
    expect(labels('ik_yoneticisi')).toEqual(['Personel', 'Ekipler', 'Kullanıcılar']);
  });
  it('boş kalan grup menüden düşer', () => {
    expect(visibleNavGroups(canFor('satinalma_personeli'))).toHaveLength(1);
  });
  it('her rolün menüsü kendi seed izinleriyle tutarlı (hiçbir rol erişemeyeceği öğeyi görmez)', () => {
    for (const rol of SEED_ROLE_KODLARI) {
      for (const g of visibleNavGroups(canFor(rol))) for (const i of g.items) expect(canFor(rol)(i.permissionKey)).toBe(true);
    }
  });
  it('permissionForPath: alt yollar üst öğenin iznini alır; bilinmeyen yol null', () => {
    expect(permissionForPath('/finance/cost-analysis')).toBe('finance.cost_analysis');
    expect(permissionForPath('/projects/abc')).toBe('project.records');
    expect(permissionForPath('/personnel/employees/new')).toBe('personnel.records');
    expect(permissionForPath('/bilinmeyen')).toBeNull();
  });
});
