import { ServiceUnavailableError } from '@pms/shared';

export interface TeamPerformanceRow {
  teamId: string;
  projectId: string;
  endeksPuani: number;
  guncelleme: string;
}

/**
 * Day 21 (B3, G-05): `GET /reports/team-performance` — finance'taki material-cost ile AYNI ince-proxy
 * deseni. reporting-service performans verisinin kopyasını TUTMAZ (`performance.score_submitted`
 * yayıncısı henüz yok, bkz. app.ts notu); performance-service otoriter kaynaktır.
 */
export class PerformanceServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getTeamIndices(projectId: string): Promise<TeamPerformanceRow[]> {
    const url = new URL(`/projects/${projectId}/performance-index`, this.baseUrl);
    url.searchParams.set('scope', 'team');
    const response = await fetch(url);
    if (!response.ok) throw new ServiceUnavailableError('performance-service');
    const body = (await response.json()) as {
      data: { team_id: string; project_id: string; endeks_puani: number; guncelleme: string }[];
    };
    return body.data.map((r) => ({ teamId: r.team_id, projectId: r.project_id, endeksPuani: r.endeks_puani, guncelleme: r.guncelleme }));
  }
}
