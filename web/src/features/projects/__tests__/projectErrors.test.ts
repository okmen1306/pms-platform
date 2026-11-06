import { describe, it, expect } from 'vitest';
import { ApiError } from '../../../shared/api';
import { describeProjectError } from '../projectErrors';

describe('describeProjectError (Day 19)', () => {
  it('ASSIGNMENT_CONFLICT: ham UUID yerine personel adı + çakışan atama sayısı', () => {
    const err = new ApiError(409, 'ASSIGNMENT_CONFLICT', 'Personel (51aadd52-...) belirtilen tarih aralığında başka bir göreve atanmış.', {
      employeeId: '51aadd52',
      conflictingAssignmentIds: ['a', 'b'],
    });
    const message = describeProjectError(err, { employeeName: 'Ali Kaya' });
    expect(message).toContain('Ali Kaya');
    expect(message).toContain('2 atamaya');
    expect(message).not.toContain('51aadd52');
  });

  it('ASSIGNMENT_CONFLICT: details yoksa sayısız genel cümleye düşer', () => {
    const err = new ApiError(409, 'ASSIGNMENT_CONFLICT', 'ham');
    expect(describeProjectError(err)).toContain('Bu personel');
  });

  it('WEEKLY_CAPACITY_EXCEEDED: ekip adı + proje hafta sayısı', () => {
    const err = new ApiError(409, 'WEEKLY_CAPACITY_EXCEEDED', 'Ekip (2e010dab-...) için ...');
    const message = describeProjectError(err, { teamName: 'Yazılım Ekibi', projectWeeks: 12 });
    expect(message).toContain('Yazılım Ekibi');
    expect(message).toContain('12 hafta');
    expect(message).not.toContain('2e010dab');
  });

  it('bilinmeyen ApiError: sunucunun kendi mesajı aynen korunur', () => {
    expect(describeProjectError(new ApiError(404, 'NOT_FOUND', 'İş paketi bulunamadı'))).toBe('İş paketi bulunamadı');
  });

  it('ApiError olmayan Error ve bilinmeyen değer', () => {
    expect(describeProjectError(new Error('boom'))).toBe('boom');
    expect(describeProjectError(undefined, {}, 'Atama kaydedilemedi')).toBe('Atama kaydedilemedi');
  });
});
