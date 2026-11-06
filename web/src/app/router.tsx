import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { EmployeeListPage } from '../features/personnel/EmployeeListPage';
import { EmployeeFormPage } from '../features/personnel/EmployeeFormPage';
import { TeamManagementPage } from '../features/personnel/TeamManagementPage';
import { MaterialListPage } from '../features/procurement/MaterialListPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { ProjectListPage } from '../features/projects/ProjectListPage';
import { ProjectPlanningWizard } from '../features/projects/ProjectPlanningWizard';
import { CostAnalysisPage } from '../features/finance/CostAnalysisPage';
import { ArgeCostPage } from '../features/finance/ArgeCostPage';
import { ScoringForm } from '../features/performance/ScoringForm';
import { EmployeePerformancePage } from '../features/performance/EmployeePerformancePage';
import { TeamPerformancePage } from '../features/performance/TeamPerformancePage';
import { RiskRegisterPage } from '../features/risk/RiskRegisterPage';
import { WorkflowReportPage } from '../features/reporting/WorkflowReportPage';
import { CompletionStatusPage } from '../features/reporting/CompletionStatusPage';
import { ProjectPlannerPage } from '../features/reporting/ProjectPlannerPage';
import { WorkDetailPage } from '../features/reporting/WorkDetailPage';
import { RoleManagementPage } from '../features/admin/RoleManagementPage';
import { PermissionMatrixPage } from '../features/admin/PermissionMatrixPage';
import { UserListPage } from '../features/admin/UserListPage';
import { ActivityFeedPage } from '../features/admin/ActivityFeedPage';
import { RequireAuth } from './RequireAuth';
import { AppShell } from './AppShell';

/**
 * Day 7: /finance/arge-cost eklendi. Day 9: /performance/score eklendi. Day 10:
 * /performance/employee, /performance/team, /risk/register eklendi; AuthProvider (mock) bugün
 * eklendi (bkz. AuthContext.tsx) — ama kalıcı bir navigasyon kabuğu (Sidebar/AppShell) HÂLÂ yok,
 * o Day 18+'ın kapsamında. Day 12: /reports/workflow, /reports/completion-status,
 * /admin/roles eklendi. Day 13: /reports/project-planner, /reports/work-detail,
 * /admin/permission-matrix eklendi.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    // Day 18: `/login` dışındaki her rota oturum ister (bkz. RequireAuth.tsx).
    element: <RequireAuth />,
    children: [
      {
        // Day 21 (F1): kalıcı kabuk (menü + sayfa-izin kapısı) — tüm korumalı sayfaları sarar.
        element: <AppShell />,
        children: [
      { path: '/personnel/employees', element: <EmployeeListPage /> },
      { path: '/personnel/employees/new', element: <EmployeeFormPage /> },
      { path: '/personnel/teams', element: <TeamManagementPage /> },
      { path: '/procurement/materials', element: <MaterialListPage /> },
      { path: '/projects', element: <ProjectListPage /> },
      { path: '/projects/new', element: <ProjectPlanningWizard /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/finance/cost-analysis', element: <CostAnalysisPage /> },
      { path: '/finance/arge-cost', element: <ArgeCostPage /> },
      { path: '/performance/score', element: <ScoringForm /> },
      { path: '/performance/employee', element: <EmployeePerformancePage /> },
      { path: '/performance/team', element: <TeamPerformancePage /> },
      { path: '/risk/register', element: <RiskRegisterPage /> },
      { path: '/reports/workflow', element: <WorkflowReportPage /> },
      { path: '/reports/completion-status', element: <CompletionStatusPage /> },
      { path: '/reports/project-planner', element: <ProjectPlannerPage /> },
      { path: '/reports/work-detail', element: <WorkDetailPage /> },
      { path: '/admin/users', element: <UserListPage /> },
      { path: '/admin/activity', element: <ActivityFeedPage /> },
      { path: '/admin/roles', element: <RoleManagementPage /> },
      { path: '/admin/permission-matrix', element: <PermissionMatrixPage /> },
        ],
      },
    ],
  },
  // Day 21: AppShell geldi — kök artık giriş sayfası değil; RequireAuth oturum yoksa /login'e atar.
  { path: '/', element: <Navigate to="/projects" replace /> },
]);
