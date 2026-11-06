import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { OverviewTab } from './tabs/OverviewTab';
import { WorkPackagesTab } from './tabs/WorkPackagesTab';
import { WeeklyAllocationTab } from './tabs/WeeklyAllocationTab';
import { AssignmentsTab } from './tabs/AssignmentsTab';
import { MilestonesTab } from './tabs/MilestonesTab';
import { WorkDraftTab } from './tabs/WorkDraftTab';

type TabKey = 'overview' | 'work-packages' | 'weekly-allocation' | 'assignments' | 'milestones' | 'work-draft';

/**
 * Day 7: WeeklyAllocationTab eklendi (F1 — Day 6'nın backend özelliğinin UI'ı).
 * Day 8: AssignmentsTab eklendi (F1 — Day 7'nin personel atama + Day 8'in çakışma uyarı
 * özelliğinin UI'ı). Day 9: MilestonesTab eklendi (F1 — zaman çizelgesi). Day 10: WorkDraftTab
 * eklendi (F1 — iş taslağı, bkz. WorkDraftTab.tsx'teki Uzman İnisiyatifi notu).
 *
 * F1 (Day 11): "Project modülü ince ayar + responsive". Sekme çubuğu 6 sekmeye çıktığından beri
 * (Day 10) dar ekranlarda taşıyordu (`flex gap-4`, sarma/kaydırma YOK) — `overflow-x-auto` +
 * `whitespace-nowrap` ile yatay kaydırılabilir hale getirildi. Alt sekmelerdeki (`AssignmentsTab`,
 * `MilestonesTab`, `OverviewTab`, `WeeklyAllocationTab`, `WorkPackagesTab`) sabit `grid-cols-N`
 * form ızgaraları da AYNI geçişle `grid-cols-1 sm:grid-cols-N` oldu — `WorkDraftTab` zaten
 * `overflow-x-auto` kullanıyordu (Day 10), o yüzden dokunulmadı.
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  if (!id) return <p className="p-6 text-sm text-red-600">Proje ID bulunamadı.</p>;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Genel Bakış' },
    { key: 'work-packages', label: 'İş Paketleri' },
    { key: 'weekly-allocation', label: 'Haftalık Planlama' },
    { key: 'assignments', label: 'Personel Atamaları' },
    { key: 'milestones', label: 'Zaman Çizelgesi' },
    { key: 'work-draft', label: 'İş Taslağı' },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Proje Detayı</h1>

      <div className="border-b border-gray-200 flex gap-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab projectId={id} />}
      {activeTab === 'work-packages' && <WorkPackagesTab projectId={id} />}
      {activeTab === 'weekly-allocation' && <WeeklyAllocationTab projectId={id} />}
      {activeTab === 'assignments' && <AssignmentsTab projectId={id} />}
      {activeTab === 'milestones' && <MilestonesTab projectId={id} />}
      {activeTab === 'work-draft' && <WorkDraftTab projectId={id} />}
    </div>
  );
}
