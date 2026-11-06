import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];
vi.mock('../../../shared/api', () => ({
  apiFetch: async (path: string) => {
    calls.push(path);
    return [];
  },
}));
import { fetchWorkflowStatus, fetchWorkDetail, fetchProjectPlanner, fetchCompletionStatus } from '../reporting.api';

beforeEach(() => (calls.length = 0));

describe('reporting.api — gateway üzerinden (Day 21, G-05)', () => {
  it('tüm çağrılar /reporting önekiyle gider; iş akışı spec adı /reports/workflow', async () => {
    await fetchWorkflowStatus('p1');
    await fetchWorkDetail('p1');
    await fetchProjectPlanner('p1');
    await fetchCompletionStatus('p1', 'project');
    expect(calls).toEqual([
      '/reporting/reports/workflow?projectId=p1',
      '/reporting/reports/work-detail?projectId=p1',
      '/reporting/reports/project-planner?projectId=p1',
      '/reporting/reports/completion-status?projectId=p1&scope=project',
    ]);
    expect(calls.some((c) => c.includes('workflow-status'))).toBe(false);
  });
});
