import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Target,
  GitCompareArrows,
  Recycle,
  Camera,
  TrendingUp,
  FileBarChart,
  Settings,
  ChevronDown,
  Building2,
  Home,
  Leaf,
  Menu,
  Plus,
  X,
  RefreshCw,
  Trash2,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { getEcoScorerStatus } from '@/services/api';
import styles from './Sidebar.module.css';

const navSections = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/resources', label: 'Resources & Expenses', icon: Receipt },
    ],
  },
  {
    label: 'Understand & Explore',
    items: [
      { path: '/compare', label: 'Compare Options', icon: GitCompareArrows },
      { path: '/circular-living', label: 'Circular Living', icon: Recycle },
      { path: '/eco-scorer', label: 'Eco-Scorer', icon: Camera },
    ],
  },
  {
    label: 'Plan & Act',
    items: [
      { path: '/action-planner', label: 'Action Planner', icon: Target },
    ],
  },
  {
    label: 'Track & Improve',
    items: [
      { path: '/impact', label: 'Impact Ledger', icon: TrendingUp },
    ],
  },
  {
    label: 'Reports',
    items: [
      { path: '/reports', label: 'Reports & Export', icon: FileBarChart },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const {
    currentWorkspace,
    workspaces,
    workspacesLoading,
    workspacesError,
    reloadWorkspaces,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspace();
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ecoScorerAvailable, setEcoScorerAvailable] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceType, setWorkspaceType] = useState<'individual' | 'business'>('individual');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState('');
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const workspaceLabel = workspacesLoading
    ? 'Loading workspaces…'
    : workspacesError
    ? 'Backend unavailable'
    : currentWorkspace.id
    ? currentWorkspace.name
    : 'Create a workspace';
  const workspaceTypeLabel = currentWorkspace.id
    ? currentWorkspace.type
    : workspacesLoading
    ? 'Loading…'
    : workspacesError
    ? 'Check connection'
    : 'Get started';

  useEffect(() => {
    let isMounted = true;
    getEcoScorerStatus()
      .then((status) => {
        if (isMounted) setEcoScorerAvailable(status.operational);
      })
      .catch((error: unknown) => {
        console.error('Unable to determine Eco-Scorer availability', error);
        if (isMounted) setEcoScorerAvailable(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSwitch = (id: string) => {
    switchWorkspace(id);
    setWsDropdownOpen(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await signOut();
      setWsDropdownOpen(false);
      setMobileOpen(false);
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Could not log out.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCreateWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorkspaceSaving(true);
    setWorkspaceError('');
    try {
      await createWorkspace({ name: workspaceName.trim(), type: workspaceType, description: '' });
      setWorkspaceName('');
      setCreatingWorkspace(false);
      setWsDropdownOpen(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not create workspace.');
    } finally {
      setWorkspaceSaving(false);
    }
  };

  const handleDeleteWorkspace = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete "${name}" permanently? Its resource records, actions, comparisons, and Eco-Scorer assessments will also be deleted. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingWorkspaceId(id);
    setWorkspaceDeleteError('');
    try {
      await deleteWorkspace(id);
      if (id === currentWorkspace.id && workspaces.length === 1) {
        navigate('/');
      }
    } catch (error) {
      console.error('Unable to delete workspace', error);
      setWorkspaceDeleteError(
        error instanceof Error ? error.message : 'Could not delete the workspace.',
      );
    } finally {
      setDeletingWorkspaceId('');
    }
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>
              <Leaf size={16} />
            </div>
            <div className={styles.brandName}>EcoPath.AI</div>
          </div>
          <div className={styles.brandTagline}>India sustainability insights</div>
        </div>

        {/* Workspace Switcher */}
        <div className={styles.workspaceSwitcher} style={{ position: 'relative' }}>
          <button
            className={styles.workspaceButton}
            onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
            aria-expanded={wsDropdownOpen}
            aria-haspopup="listbox"
          >
            {currentWorkspace.type === 'business' ? (
              <Building2 size={16} />
            ) : (
              <Home size={16} />
            )}
            <div className={styles.workspaceInfo}>
              <div className={styles.workspaceName}>
                {workspaceLabel}
              </div>
              <div className={styles.workspaceType}>{workspaceTypeLabel}</div>
            </div>
            <ChevronDown size={14} style={{ opacity: 0.5 }} />
          </button>

          {wsDropdownOpen && (
            <div className={styles.workspaceDropdown}>
              {workspacesError && (
                <div className={styles.workspaceLoadError} role="alert">
                  <span>{workspacesError}</span>
                  <button type="button" onClick={() => void reloadWorkspaces()} disabled={workspacesLoading}>
                    <RefreshCw size={13} />
                    Retry
                  </button>
                </div>
              )}
              {!workspacesLoading && !workspacesError && workspaces.length === 0 && (
                <div className={styles.workspaceEmptyMessage}>
                  No workspace exists yet. Create one to start recording live data.
                </div>
              )}
              {workspaces.map((ws) => (
                <div className={styles.workspaceOptionRow} key={ws.id}>
                  <button
                    type="button"
                    className={`${styles.workspaceOption} ${
                      ws.id === currentWorkspace.id ? styles.workspaceOptionActive : ''
                    }`}
                    onClick={() => handleSwitch(ws.id)}
                  >
                    {ws.type === 'business' ? (
                      <Building2 size={16} />
                    ) : (
                      <Home size={16} />
                    )}
                    <div className={styles.workspaceOptionText}>
                      <div className={styles.workspaceOptionName}>{ws.name}</div>
                      <div className={styles.workspaceOptionType}>
                        {ws.type === 'business' ? 'Business workspace' : 'Personal workspace'}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.workspaceDeleteButton}
                    aria-label={`Delete workspace ${ws.name}`}
                    title={`Delete ${ws.name}`}
                    disabled={deletingWorkspaceId !== ''}
                    onClick={() => void handleDeleteWorkspace(ws.id, ws.name)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {workspaceDeleteError && (
                <p className={styles.workspaceCreateError} role="alert">{workspaceDeleteError}</p>
              )}
              {creatingWorkspace ? (
                <form className={styles.workspaceCreateForm} onSubmit={(event) => void handleCreateWorkspace(event)}>
                  <label className={styles.workspaceCreateLabel} htmlFor="new-workspace-name">Workspace name</label>
                  <input
                    id="new-workspace-name"
                    className={styles.workspaceCreateInput}
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    maxLength={128}
                    required
                    autoFocus
                  />
                  <select
                    className={styles.workspaceCreateInput}
                    aria-label="Workspace type"
                    value={workspaceType}
                    onChange={(event) => setWorkspaceType(event.target.value as 'individual' | 'business')}
                  >
                    <option value="individual">Personal workspace</option>
                    <option value="business">Business workspace</option>
                  </select>
                  {workspaceError && <p className={styles.workspaceCreateError} role="alert">{workspaceError}</p>}
                  <button className={styles.workspaceCreateSubmit} type="submit" disabled={workspaceSaving}>
                    {workspaceSaving ? 'Creating…' : 'Create workspace'}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.workspaceCreateButton}
                  onClick={() => {
                    setWorkspaceError('');
                    setCreatingWorkspace(true);
                  }}
                >
                  <Plus size={15} /> Create a workspace
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navSections.map((section) => (
            <div key={section.label} className={styles.navSection}>
              <div className={styles.navSectionLabel}>{section.label}</div>
              {section.items
                .filter((item) => item.path !== '/eco-scorer' || ecoScorerAvailable)
                .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className={styles.navIcon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={15} />
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
          {logoutError && <p className={styles.workspaceCreateError} role="alert">{logoutError}</p>}
          <div className={styles.sampleBadge}>
            <Leaf size={10} />
            Data-led • Source-backed
          </div>
        </div>
      </aside>
    </>
  );
}
