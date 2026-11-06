import type { EmployeeRepository, EmployeeRow, CreateEmployeeRow, UpdateEmployeeRow } from '../../../infrastructure/database/employee.repository';

/**
 * Day 15: personnel-service'in bugüne kadar HİÇ testi yoktu (bkz. CHANGELOG.md) — bu dosya,
 * `assign-personnel.usecase.test.ts`'teki (project-service) InMemory* deseniyle AYNI şekilde,
 * yeni create/update/deactivate event-publish akışlarını test edebilmek için minimal bir
 * sahte repo sağlıyor.
 */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  rows: EmployeeRow[] = [];
  private nextId = 1;

  async findAll(filters: { durum?: string }): Promise<EmployeeRow[]> {
    return filters.durum ? this.rows.filter((r) => r.durum === filters.durum) : this.rows;
  }

  async findById(id: string): Promise<EmployeeRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async create(data: CreateEmployeeRow): Promise<EmployeeRow> {
    const row: EmployeeRow = {
      id: `personel-${this.nextId++}`,
      ad: data.ad,
      soyad: data.soyad,
      email: data.email,
      ise_baslama_tarihi: data.ise_baslama_tarihi,
      maas_tl: data.maas_tl,
      durum: 'active',
      olusturan_id: data.olusturan_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.rows.push(row);
    return row;
  }

  async update(id: string, data: UpdateEmployeeRow): Promise<EmployeeRow> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('bulunamadı');
    Object.assign(row, data, { updated_at: new Date().toISOString() });
    return row;
  }

  async deactivate(id: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('bulunamadı');
    row.durum = 'inactive';
  }
}
