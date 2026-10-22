import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useWorkspace } from '@/hooks/useWorkspace';
import styles from './AppLayout.module.css';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Overview',
  '/resources': 'Resources & expenses',
  '/action-planner': 'Action planner',
  '/compare': 'Compare options',
  '/circular-living': 'Circular living',
  '/eco-scorer': 'Eco-Scorer',
  '/impact': 'Impact ledger',
  '/reports': 'Reports & export',
  '/settings': 'Settings',
};

export function AppLayout() {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const pageLabel = routeLabels[location.pathname] ?? 'Workspace';

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span className={styles.brandCrumb}>ECOPATH.AI</span>
            <span className={styles.breadcrumbDivider}>/</span>
            <span className={styles.pageCrumb}>{pageLabel}</span>
          </div>
          <div className={styles.topbarMeta}>
            {currentWorkspace.id && (
              <span className={styles.workspaceName} title={currentWorkspace.name}>
                <span className={styles.workspaceDot} />
                {currentWorkspace.name}
              </span>
            )}
            <span className={styles.regionLabel}>India <span aria-hidden="true">·</span> INR</span>
          </div>
        </header>
        <div className={styles.content}><Outlet /></div>
      </main>
    </div>
  );
}
