import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, CheckCircle, BarChart2, Filter, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getActions, getImpactEntries } from '@/services/api';
import { formatINR } from '@/utils/currency';
import type { Action, ImpactEntry } from '@/types';
import styles from './Impact.module.css';

const categoryColors: Record<string, string> = {
  'home-energy': '#2d7d5f',
  'food-kitchen': '#d97706',
  'travel-transport': '#2563eb',
  'water-nature': '#0ea5e9',
  'shopping-products': '#9d174d',
  'waste-circular': '#16a34a',
};

const valueTypeLabels: Record<string, string> = {
  'cost-saving': 'Cost Saving',
  'emission-reduction': 'Emission Reduction',
  'resource-saving': 'Resource Saving',
  'waste-reduction': 'Waste Reduction',
};

const dataSourceLabels = {
  measured: 'Measured',
  estimated: 'Estimated',
  imported: 'Imported',
  'user-reported': 'User-reported',
  'not-reported': 'No result reported',
};

export default function Impact() {
  const { currentWorkspace } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [entries, setEntries] = useState<ImpactEntry[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadImpactData() {
      if (!currentWorkspace.id) {
        setEntries([]);
        setActions([]);
        setLoadError('');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadError('');
        const [impactItems, actionItems] = await Promise.all([
          getImpactEntries(currentWorkspace.id),
          getActions(currentWorkspace.id),
        ]);

        if (!isMounted) return;
        setEntries(impactItems);
        setActions(actionItems);
      } catch (error) {
        console.error('Unable to load impact data', error);
        if (isMounted) {
          setEntries([]);
          setActions([]);
          setLoadError(error instanceof Error ? error.message : 'Unable to load the Impact Ledger.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadImpactData();
    return () => {
      isMounted = false;
    };
  }, [currentWorkspace.id, refreshCount]);

  const filteredEntries = useMemo(() =>
    entries
      .filter((e) => statusFilter === 'all' || e.status === statusFilter)
      .filter((e) => sourceFilter === 'all' || e.dataSource === sourceFilter),
    [entries, statusFilter, sourceFilter]
  );

  const completed = actions.filter((a) => a.status === 'completed').length;
  const estimatedEntries = filteredEntries.filter((entry) => entry.estimatedValue !== null);
  const estimated = estimatedEntries.reduce((sum, entry) => sum + (entry.estimatedValue ?? 0), 0);
  const userReported = filteredEntries.filter((entry) => entry.actualValue !== null).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Impact Ledger</h1>
        <p className={styles.pageSubtitle}>
          A record of planned actions once they are in progress or completed. Reported financial results are entered by you and are not independently verified; environmental savings are not calculated here.
        </p>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: '#dcfce7', color: '#16a34a' }}><CheckCircle size={20} /></div>
          <div className={styles.summaryValue}>{completed}</div>
          <div className={styles.summaryLabel}>Actions Completed</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: '#fef3c7', color: '#d97706' }}><TrendingUp size={20} /></div>
          <div className={styles.summaryValue}>{estimatedEntries.length ? formatINR(estimated) : 'Not calculated'}</div>
          <div className={styles.summaryLabel}>Estimated Savings<span className={styles.estimateTag}>Est.</span></div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: '#dbeafe', color: '#2563eb' }}><BarChart2 size={20} /></div>
          <div className={styles.summaryValue}>{userReported}</div>
          <div className={styles.summaryLabel}>User-Reported Results</div>
        </div>
      </div>

      {/* Data quality legend */}
      <div className={styles.legend}>
        <span className={styles.legendTitle}>Data quality:</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#2563eb' }} />User-reported financial result</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#d97706' }} />No result reported</span>
      </div>

      {/* Filters */}
      <div className={styles.filterRow}>
        <Filter size={15} style={{ color: 'var(--color-text-tertiary)' }} />
        <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Tracked Statuses</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In Progress</option>
        </select>
        <select className={styles.select} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">All Sources</option>
          <option value="user-reported">User-reported results</option>
          <option value="not-reported">No result reported</option>
        </select>
        <button className={styles.refreshButton} type="button" onClick={() => setRefreshCount((count) => count + 1)} disabled={isLoading || !currentWorkspace.id}>
          {isLoading ? 'Refreshing…' : 'Refresh Ledger'}
        </button>
      </div>

      {/* Notice */}
      <div className={styles.notice}>
        <AlertTriangle size={14} />
        Actions appear here after you mark them in progress or completed in Action Planner. Enter actual savings there to record a user-reported result. This ledger does not independently verify results or calculate environmental savings.
      </div>

      {/* Timeline */}
      {loadError ? (
        <div className={styles.empty} role="alert">
          <AlertTriangle size={32} strokeWidth={1} />
          <p>Impact Ledger could not load.</p>
          <p>{loadError}</p>
          <button className={styles.refreshButton} type="button" onClick={() => setRefreshCount((count) => count + 1)} disabled={isLoading}>Try Again</button>
        </div>
      ) : !currentWorkspace.id ? (
        <div className={styles.empty} role="status">
          <TrendingUp size={40} strokeWidth={1} />
          <p>Create or select a workspace to track your actions.</p>
        </div>
      ) : isLoading ? (
        <div className={styles.empty} role="status">Loading impact entries…</div>
      ) : filteredEntries.length === 0 ? (
        <div className={styles.empty}>
          <TrendingUp size={40} strokeWidth={1} />
          <p>No tracked actions match these filters.</p>
          <p>Add an action to your Action Planner, change its status to In Progress or Completed, then refresh this ledger.</p>
          <p>To display a reported financial result, enter actual savings for the action in Action Planner. Actual environmental impact is not inferred.</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {filteredEntries.map((entry) => {
            const borderColor = categoryColors[entry.category] ?? '#94a89b';
            return (
              <div key={entry.id} className={styles.entryCard} style={{ borderLeftColor: borderColor }}>
                <div className={styles.entryHeader}>
                  <div>
                    <div className={styles.entryDate}>{entry.date}</div>
                    <div className={styles.entryTitle}>{entry.description}</div>
                  </div>
                  <div className={styles.entryBadges}>
                    <span className={`${styles.statusBadge} ${styles[`status_${entry.status}`]}`}>{entry.status}</span>
                    <span className={`${styles.sourceBadge} ${styles[`src_${entry.dataSource}`]}`}>{dataSourceLabels[entry.dataSource]}</span>
                  </div>
                </div>

                <div className={styles.comparison}>
                  <div className={styles.compCol}>
                    <div className={styles.compLabel}>Estimated</div>
                    <div className={styles.compValue} style={{ color: '#d97706' }}>
                      {entry.estimatedValue != null
                        ? entry.valueType === 'cost-saving' && entry.unit === 'INR'
                          ? formatINR(entry.estimatedValue)
                          : `${entry.estimatedValue} ${entry.unit}`
                        : 'Estimate unavailable'}
                    </div>
                  </div>
                  <div className={styles.compDivider} />
                  <div className={styles.compCol}>
                    <div className={styles.compLabel}>Actual</div>
                    <div className={styles.compValue} style={{ color: '#16a34a' }}>
                      {entry.actualValue != null
                        ? entry.valueType === 'cost-saving' && entry.unit === 'INR'
                          ? formatINR(entry.actualValue)
                          : `${entry.actualValue} ${entry.unit}`
                        : (
                        <span className={styles.awaiting}>Not reported</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.compCol}>
                    <div className={styles.compLabel}>Type</div>
                    <div className={styles.compValue} style={{ fontSize: 'var(--text-xs)' }}>
                      {valueTypeLabels[entry.valueType] ?? entry.valueType}
                    </div>
                  </div>
                </div>

                {entry.notes && <p className={styles.entryNotes}>{entry.notes}</p>}
                <div className={styles.calcVersion}>Calculation: {entry.calculationVersion}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
