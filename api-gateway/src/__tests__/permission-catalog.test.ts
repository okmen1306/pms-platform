import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PERMISSION_CATALOG, PERMISSION_KEYS, DEFAULT_ROLE_MATRIX, SEED_ROLE_KODLARI,
  renderPermissionSeedSql, PERMISSION_SEED_BEGIN, PERMISSION_SEED_END,
} from '@pms/shared';

const SQL = fs.readFileSync(path.resolve(__dirname, '../../../migrations/supabase/013_seed_data.sql'), 'utf8');

describe('izin kataloğu tek kaynak (Day 21, G-01)', () => {
  it('013_seed_data.sql\'in GENERATED bloğu shared/dto/permission-catalog.ts çıktısıyla birebir aynı', () => {
    const block = SQL.slice(SQL.indexOf(PERMISSION_SEED_BEGIN), SQL.indexOf(PERMISSION_SEED_END) + PERMISSION_SEED_END.length);
    expect(block).toBe(renderPermissionSeedSql());
  });

  it('PERMISSION_KEYS\'in her değeri katalogda var, katalogda fazlalık yok', () => {
    expect(PERMISSION_CATALOG.map((p) => p.key).sort()).toEqual(Object.values(PERMISSION_KEYS).sort());
  });

  it('matris yalnızca katalogdaki anahtarlara ve seed rollere atıf yapar', () => {
    const keys = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));
    expect(Object.keys(DEFAULT_ROLE_MATRIX).sort()).toEqual([...SEED_ROLE_KODLARI].sort());
    for (const rol of SEED_ROLE_KODLARI) for (const k of Object.keys(DEFAULT_ROLE_MATRIX[rol])) expect(keys.has(k), `${rol} → ${k}`).toBe(true);
  });

  it('roadmap Bölüm 1 kısıtları: ekip_lideri maaş/maliyet YOK, satınalma yalnızca procurement, personel hiçbir yazma yetkisi yok', () => {
    expect(DEFAULT_ROLE_MATRIX.ekip_lideri[PERMISSION_KEYS.PERSONNEL_SALARY]).toBeUndefined();
    expect(DEFAULT_ROLE_MATRIX.ekip_lideri[PERMISSION_KEYS.FINANCE_COST_ANALYSIS]).toBeUndefined();
    expect(Object.keys(DEFAULT_ROLE_MATRIX.satinalma_personeli)).toEqual([PERMISSION_KEYS.PROCUREMENT_MATERIALS]);
    expect(Object.values(DEFAULT_ROLE_MATRIX.personel).every((g) => g === 'V')).toBe(true);
    expect(DEFAULT_ROLE_MATRIX.ik_yoneticisi[PERMISSION_KEYS.PERSONNEL_SALARY]).toBe('VE');
  });

  it('SQL: satis rolü yok, 5 rol var; matris her rol × her izin için açık satır içeriyor', () => {
    expect(SQL).not.toMatch(/\('satis'/);
    const rows = SQL.match(/^\s+\('(?:sirket_yoneticisi|ekip_lideri|ik_yoneticisi|satinalma_personeli|personel)', '[a-z_.]+', (?:TRUE|FALSE), (?:TRUE|FALSE)\)/gm) ?? [];
    expect(rows).toHaveLength(SEED_ROLE_KODLARI.length * PERMISSION_CATALOG.length);
  });
});
