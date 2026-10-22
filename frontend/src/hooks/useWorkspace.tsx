import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '@/types';
import { createWorkspace as createWorkspaceRequest, deleteWorkspace as deleteWorkspaceRequest, getWorkspaces } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

const ACTIVE_WORKSPACE_STORAGE_PREFIX = 'ecopath.activeWorkspaceId';
const LEGACY_WORKSPACE_STORAGE_KEY = 'ecopath.activeWorkspaceId';

interface WorkspaceContextType {
  currentWorkspace: Workspace;
  workspaces: Workspace[];
  workspacesLoading: boolean;
  workspacesError: string | null;
  reloadWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => void;
  createWorkspace: (payload: Pick<Workspace, 'name' | 'type' | 'description'>) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
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
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    if (!user) return;
    const storageKey = `${ACTIVE_WORKSPACE_STORAGE_PREFIX}:${user.id}`;
    if (currentId) window.localStorage.setItem(storageKey, currentId);
  }, [currentId, user]);

  const reloadWorkspaces = useCallback(async (preferredWorkspaceId?: string) => {
    if (!user) {
      setWorkspaces([]);
      setCurrentId('');
      setWorkspacesLoading(false);
      return;
    }
    setWorkspacesLoading(true);
    setWorkspacesError(null);
    try {
      const items = await getWorkspaces();
      if (isMounted.current) {
        setWorkspaces(items);
        if (items.length > 0) {
          setCurrentId((current) => {
            const preferredId = preferredWorkspaceId || current;
            return items.some((workspace) => workspace.id === preferredId)
              ? preferredId
              : items[0].id;
          });
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
  }, [user]);

  useEffect(() => {
    isMounted.current = true;
    if (!user) {
      setWorkspaces([]);
      setCurrentId('');
      setWorkspacesLoading(false);
      return () => {
        isMounted.current = false;
      };
    }
    const storageKey = `${ACTIVE_WORKSPACE_STORAGE_PREFIX}:${user.id}`;
    const storedWorkspaceId =
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY) ??
      '';
    if (storedWorkspaceId) {
      window.localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
    }
    setCurrentId(storedWorkspaceId);
    const initialLoad = window.setTimeout(() => {
      void reloadWorkspaces(storedWorkspaceId);
    }, 0);
    return () => {
      window.clearTimeout(initialLoad);
      isMounted.current = false;
    };
  }, [reloadWorkspaces, user]);

  const currentWorkspace = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? emptyWorkspace;
  const selectWorkspace = (id: string) => setCurrentId(id);

  const createWorkspace = async (payload: Pick<Workspace, 'name' | 'type' | 'description'>) => {
    const workspace = await createWorkspaceRequest(payload);
    setWorkspaces((existing) => [...existing, workspace]);
    setCurrentId(workspace.id);
    setWorkspacesError(null);
    return workspace;
  };

  const deleteWorkspace = async (id: string) => {
    await deleteWorkspaceRequest(id);
    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== id);
    setWorkspaces(remainingWorkspaces);
    setCurrentId((current) => current === id ? remainingWorkspaces[0]?.id ?? '' : current);
    setWorkspacesError(null);
  };

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    workspacesLoading,
    workspacesError,
    reloadWorkspaces,
    switchWorkspace: selectWorkspace,
    createWorkspace,
    deleteWorkspace,
  };

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
