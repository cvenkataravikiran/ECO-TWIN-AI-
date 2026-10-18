import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '@/types';
import { createWorkspace as createWorkspaceRequest, getWorkspaces } from '@/services/api';

interface WorkspaceContextType {
  currentWorkspace: Workspace;
  workspaces: Workspace[];
  workspacesLoading: boolean;
  workspacesError: string | null;
  reloadWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => void;
  createWorkspace: (payload: Pick<Workspace, 'name' | 'type' | 'description'>) => Promise<Workspace>;
}

const emptyWorkspace: Workspace = {
  id: '',
  name: 'No active workspace',
  type: 'individual',
  description: 'Create a workspace or check the backend connection.',
  createdAt: '',
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const reloadWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    setWorkspacesError(null);
    try {
      const items = await getWorkspaces();
      if (isMounted.current) {
        setWorkspaces(items);
        if (items.length > 0) {
          setCurrentId((prev) => (items.some((w) => w.id === prev) ? prev : items[0].id));
        } else {
          setCurrentId('');
        }
      }
    } catch (error) {
      console.error('Unable to load workspaces from the backend', error);
      if (isMounted.current) {
        setWorkspacesError(
          error instanceof Error ? error.message : 'Unable to load workspaces from the backend.',
        );
      }
    } finally {
      if (isMounted.current) setWorkspacesLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const initialLoad = window.setTimeout(() => {
      void reloadWorkspaces();
    }, 0);
    return () => {
      window.clearTimeout(initialLoad);
      isMounted.current = false;
    };
  }, [reloadWorkspaces]);

  const currentWorkspace = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? emptyWorkspace;

  const createWorkspace = async (payload: Pick<Workspace, 'name' | 'type' | 'description'>) => {
    const workspace = await createWorkspaceRequest(payload);
    setWorkspaces((existing) => [...existing, workspace]);
    setCurrentId(workspace.id);
    setWorkspacesError(null);
    return workspace;
  };

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    workspacesLoading,
    workspacesError,
    reloadWorkspaces,
    switchWorkspace: setCurrentId,
    createWorkspace,
  };

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
