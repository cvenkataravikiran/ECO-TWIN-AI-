import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WorkspaceProvider } from '@/hooks/useWorkspace';
import { AppLayout } from '@/layouts/AppLayout';
import { lazy, Suspense } from 'react';

// Lazy-load pages for better performance
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Landing = lazy(() => import('@/pages/Landing'));
const Resources = lazy(() => import('@/pages/Resources'));
const ActionPlanner = lazy(() => import('@/pages/ActionPlanner'));
const Compare = lazy(() => import('@/pages/Compare'));
const CircularLiving = lazy(() => import('@/pages/CircularLiving'));
const EcoScorer = lazy(() => import('@/pages/EcoScorer'));
const Impact = lazy(() => import('@/pages/Impact'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      color: 'var(--color-text-tertiary)',
      fontSize: 'var(--text-sm)',
      gap: 'var(--space-3)',
      letterSpacing: '0.02em',
    }}>
      <div className="animate-spin" style={{
        width: 20,
        height: 20,
        border: '2px solid var(--color-border-light)',
        borderTopColor: 'var(--color-primary-500)',
        borderRadius: '50%',
      }} />
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={
            <Suspense fallback={<PageLoader />}><Landing /></Suspense>
          } />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={
              <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
            } />
            <Route path="/resources" element={
              <Suspense fallback={<PageLoader />}><Resources /></Suspense>
            } />
            <Route path="/action-planner" element={
              <Suspense fallback={<PageLoader />}><ActionPlanner /></Suspense>
            } />
            <Route path="/compare" element={
              <Suspense fallback={<PageLoader />}><Compare /></Suspense>
            } />
            <Route path="/knowledge" element={<Navigate to="/dashboard" replace />} />
            <Route path="/circular-living" element={
              <Suspense fallback={<PageLoader />}><CircularLiving /></Suspense>
            } />
            <Route path="/eco-scorer" element={
              <Suspense fallback={<PageLoader />}><EcoScorer /></Suspense>
            } />
            <Route path="/impact" element={
              <Suspense fallback={<PageLoader />}><Impact /></Suspense>
            } />
            <Route path="/reports" element={
              <Suspense fallback={<PageLoader />}><Reports /></Suspense>
            } />
            <Route path="/settings" element={
              <Suspense fallback={<PageLoader />}><Settings /></Suspense>
            } />
          </Route>
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
