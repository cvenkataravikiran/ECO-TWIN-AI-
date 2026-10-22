import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Calendar,
  Receipt,
  Target,
  PiggyBank,
  ArrowRight,
  ArrowUpRight,
  Info,
  GitCompareArrows,
  Camera,
  PlusCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Building2,
  Home,
  Leaf,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getResources, getActions, getRecommendations, getEcoScorerStatus } from '@/services/api';
import { formatINR } from '@/utils/currency';
import { getGreeting } from '@/utils/greeting';
import type { ResourceRecord, Recommendation, Action, KnowledgeCategory, ResourceCategory } from '@/types';
import styles from './Dashboard.module.css';

const resourceLabels: Record<ResourceCategory, string> = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
  travel: 'Travel',
  food: 'Food',
  waste: 'Waste',
  shopping: 'Shopping',
  other: 'Other',
};

const trendColors = ['#1f6349', '#2684a5', '#bd7a18', '#8556a6', '#c35454', '#5f7b38', '#4d657f', '#aa6a45'];

export default function Dashboard() {
  const { currentWorkspace, workspacesLoading, workspacesError } = useWorkspace();

  // State for data fetched from backend
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [ecoScorerAvailable, setEcoScorerAvailable] = useState(false);
  const [dataLoadError, setDataLoadError] = useState('');

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

  // Load data when workspace changes
  useEffect(() => {
    if (!currentWorkspace.id) {
      setResources([]);
      setActions([]);
      setRecommendations([]);
      return;
    }

    setDataLoadError('');
    Promise.all([
      getResources(currentWorkspace.id),
      getActions(currentWorkspace.id),
      getRecommendations(currentWorkspace.id),
    ])
      .then(([resourceItems, actionItems, recommendationItems]) => {
        setResources(resourceItems);
        setActions(actionItems);
        setRecommendations(recommendationItems);
      })
      .catch((error: unknown) => {
        console.error('Unable to load dashboard data', error);
        setResources([]);
        setActions([]);
        setRecommendations([]);
        setDataLoadError(error instanceof Error ? error.message : 'Dashboard data could not be loaded.');
      });
  }, [currentWorkspace.id]);

  /* 1. Filter resource records for current workspace */
  const workspaceRecords = useMemo(() => resources, [resources]);

  /* 2. Filter actions for current workspace */
  const workspaceActions = useMemo(() => actions, [actions]);

  /* Use fetched recommendations from the actual backend recommendation engine */
  const fetchedRecommendations = useMemo(() => recommendations, [recommendations]);

  /* 3. Calculations for Overview Cards */
  const currentMonthRecords = useMemo(() => {
    if (workspaceRecords.length === 0) return [];
    const periods = workspaceRecords
      .map((record) => record.periodStart.slice(0, 7))
      .sort();
    const latestMonth = periods[periods.length - 1];
    return latestMonth ? workspaceRecords.filter((record) => record.periodStart.startsWith(latestMonth)) : [];
  }, [workspaceRecords]);

  const totalMonthlySpend = useMemo(() => {
    return currentMonthRecords.reduce((sum, r) => sum + r.cost, 0);
  }, [currentMonthRecords]);

  // Measurement breakdown for spend
  const spendMeasurementType = useMemo<'measured' | 'estimated' | 'mixed'>(() => {
    if (currentMonthRecords.length === 0) return 'measured';
    const hasMeasured = currentMonthRecords.some((r) => r.measurementType === 'measured');
    const hasEstimated = currentMonthRecords.some((r) => r.measurementType === 'estimated');
    if (hasMeasured && hasEstimated) return 'mixed';
    if (hasEstimated) return 'estimated';
    return 'measured';
  }, [currentMonthRecords]);

  // Active actions count
  const activeActionsCount = useMemo(() => {
    return workspaceActions.filter(
      (a) => a.status === 'in-progress' || a.status === 'planned' || a.status === 'suggested'
    ).length;
  }, [workspaceActions]);

  const completedActionsCount = useMemo(() => {
    return workspaceActions.filter((a) => a.status === 'completed').length;
  }, [workspaceActions]);

  const recommendationsWithSavings = useMemo(
    () => fetchedRecommendations.filter((rec) => rec.estimatedRecurringSavings !== null),
    [fetchedRecommendations],
  );

  const estimatedMonthlySavings = useMemo(() => {
    return recommendationsWithSavings.reduce(
      (total, rec) => total + (rec.estimatedRecurringSavings?.amount ?? 0),
      0,
    );
  }, [recommendationsWithSavings]);

  /* 4. Top actions favor distinct resource categories before filling by priority. */
  const topRecommendations = useMemo(() => {
    const ranked = [...fetchedRecommendations].sort((a, b) => b.priorityScore - a.priorityScore);
    const top: Recommendation[] = [];
    const seenCategories = new Set<KnowledgeCategory>();
    for (const recommendation of ranked) {
      if (!seenCategories.has(recommendation.category) && top.length < 3) {
        top.push(recommendation);
        seenCategories.add(recommendation.category);
      }
    }
    for (const recommendation of ranked) {
      if (top.length === 3) break;
      if (!top.some((item) => item.id === recommendation.id)) top.push(recommendation);
    }
    return top;
  }, [fetchedRecommendations]);

  /* 5. Resource trends indexed independently so different units are not compared directly. */
  const resourceTrends = useMemo(() => {
    const monthlyValues = new Map<string, Map<string, number>>();
    const seriesMetadata = new Map<
      string,
      { category: ResourceCategory; unit: string; measurementType: ResourceRecord['measurementType'] }
    >();

    workspaceRecords.forEach((record) => {
      const monthKey = record.periodStart.slice(0, 7);
      const unit = record.unit.trim() || 'unit';
      if (!/^\d{4}-\d{2}$/.test(monthKey) || !Number.isFinite(record.quantity)) return;
      const seriesKey = `${record.category}:${unit.toLocaleLowerCase()}:${record.measurementType}`;
      const values = monthlyValues.get(seriesKey) ?? new Map<string, number>();
      values.set(monthKey, (values.get(monthKey) ?? 0) + record.quantity);
      monthlyValues.set(seriesKey, values);
      if (!seriesMetadata.has(seriesKey)) {
        seriesMetadata.set(seriesKey, { category: record.category, unit, measurementType: record.measurementType });
      }
    });

    const monthKeys = [...new Set([...monthlyValues.values()].flatMap((values) => [...values.keys()]))].sort();
    const series = [...monthlyValues.entries()].flatMap(([key, values], index) => {
        const baseline = monthKeys.map((month) => values.get(month)).find((value) => value !== undefined && value > 0);
        const metadata = seriesMetadata.get(key);
        if (!metadata || baseline === undefined) return [];
        return [{
          key: `series-${index}`,
          label: `${resourceLabels[metadata.category]} · ${metadata.unit} · ${metadata.measurementType}`,
          values,
          baseline,
        }];
      });

    const chartData: Array<Record<string, string | number | null>> = monthKeys.map((monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      });
      const point: Record<string, string | number | null> = { month: monthLabel };
      series.forEach(({ key, values, baseline }) => {
        const quantity = values.get(monthKey);
        point[key] = quantity === undefined ? null : (quantity / baseline) * 100;
      });
      return point;
    });

    return { chartData, series };
  }, [workspaceRecords]);

  /* 6. Activity Timeline Events */
  const recentTimeline = useMemo(() => {
    interface TimelineEntry {
      id: string;
      actionTitle: string;
      fromStatus: string;
      toStatus: string;
      date: string;
      notes: string;
      category: KnowledgeCategory;
    }

    const list: TimelineEntry[] = [];
    workspaceActions.forEach((action) => {
      action.statusHistory.forEach((item, idx) => {
        list.push({
          id: `${action.id}-${idx}`,
          actionTitle: action.title,
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
          date: item.date,
          notes: item.notes,
          category: action.category,
        });
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  }, [workspaceActions]);

  /* Empty state check */
  const hasNoData = workspaceRecords.length === 0;
  const latestMonthLabel = currentMonthRecords[0]
    ? new Date(`${currentMonthRecords[0].periodStart.slice(0, 7)}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className={styles.container}>
      {/* 1. GREETING & PERIOD */}
      <header className={styles.header}>
        <div className={styles.greetingBlock}>
          <div className={styles.greetingSub}>
            <Leaf size={14} />
            <span>Sustainability Workspace</span>
          </div>
          <h1 className={styles.title}>{getGreeting()}</h1>
          <p className={styles.subtitle}>
            <span>Overview for</span>
            <span className={styles.workspaceBadge}>
              {currentWorkspace.type === 'business' ? (
                <Building2 size={12} />
              ) : dataLoadError ? (
                <div className={styles.periodBadge} role="status">
                  <Info size={15} style={{ color: 'var(--color-text-secondary)' }} />
                  <span>Period unavailable</span>
                </div>
              ) : (
                <Home size={12} />
              )}
              {currentWorkspace.name}
            </span>
            <span>— Tracking resource consumption, carbon footprint & practical interventions.</span>
          </p>
        </div>

        <div className={styles.headerMeta}>
          {latestMonthLabel ? (
            <div className={styles.periodBadge}>
              <span className={styles.periodPulse} aria-hidden="true" />
              <Calendar size={15} style={{ color: 'var(--color-primary-600)' }} />
              <span>Latest recorded period: {latestMonthLabel}</span>
            </div>
          ) : (
            <Link to="/resources" className={styles.periodPrompt}>
              <span className={styles.periodPromptIcon}><Calendar size={18} /></span>
              <span className={styles.periodPromptCopy}>
                <strong>Start tracking your impact</strong>
                <span>Add a resource record to see its reporting period here.</span>
              </span>
              <span className={styles.periodPromptAction}>
                Add a record <ArrowRight size={14} />
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* ONBOARDING EMPTY STATE IF WORKSPACE HAS NO DATA */}
      {dataLoadError ? (
        <div className={styles.emptyStateCard} role="alert">
          <div className={styles.emptyStateIcon}><Info size={28} /></div>
          <h2 className={styles.emptyStateTitle}>Dashboard data unavailable</h2>
          <p className={styles.emptyStateText}>{dataLoadError}</p>
          <button type="button" className={styles.btnPrimary} onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : hasNoData ? (
        <div className={styles.emptyStateCard}>
          <div className={styles.emptyStateIcon}>
            {!currentWorkspace.id ? <Building2 size={28} /> : <Sparkles size={28} />}
          </div>
          <h2 className={styles.emptyStateTitle}>
            {!currentWorkspace.id
              ? workspacesLoading
                ? 'Loading your workspace'
                : workspacesError
                ? 'Workspace connection unavailable'
                : 'Create a workspace to get started'
              : `Welcome to ${currentWorkspace.name}`}
          </h2>
          <p className={styles.emptyStateText}>
            {!currentWorkspace.id
              ? workspacesError
                ? `We could not load your workspaces. ${workspacesError}`
                : 'Create a personal or business workspace to keep your resource records, comparisons, and action plan together.'
              : "You haven't logged any resource records in this workspace yet. Add your first electricity bill, water meter reading, or commute distance to generate recommendations based on your entries."}
          </p>
          <div className={styles.emptyStateActions}>
            {!currentWorkspace.id ? (
              workspacesError ? (
                <button type="button" className={styles.btnPrimary} onClick={() => window.location.reload()}>
                  <ArrowRight size={16} /> Retry
                </button>
              ) : !workspacesLoading ? (
                <Link to="/" className={styles.btnPrimary}>
                  <PlusCircle size={16} /> Create Workspace
                </Link>
              ) : null
            ) : (
              <Link to="/resources" className={styles.btnPrimary}>
                <PlusCircle size={16} /> Log Your First Resource
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 2. OVERVIEW CARDS */}
          <section className={styles.overviewGrid} aria-label="Key Performance Indicators">
            {/* Card 1: Total Monthly Spend */}
            <div className={`${styles.overviewCard} ${styles.accentSpend}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>Total Monthly Spend</span>
                {spendMeasurementType === 'mixed' && (
                  <span className={`${styles.badge} ${styles.badgeMixed}`}>
                    <ShieldCheck size={11} /> Mixed
                  </span>
                )}
                {spendMeasurementType === 'measured' && (
                  <span className={`${styles.badge} ${styles.badgeMeasured}`}>
                    <CheckCircle2 size={11} /> Measured
                  </span>
                )}
                {spendMeasurementType === 'estimated' && (
                  <span className={`${styles.badge} ${styles.badgeEstimated}`}>
                    <Clock size={11} /> Estimated
                  </span>
                )}
              </div>
              <div className={styles.cardMain}>
                <div className={styles.cardValue}>{currentMonthRecords.length ? formatINR(totalMonthlySpend) : '—'}</div>
                <div className={styles.cardMeta}>
                  <span>{latestMonthLabel ? `For ${latestMonthLabel} (${currentMonthRecords.length} records)` : 'No monthly records yet'}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Actions */}
            <div className={`${styles.overviewCard} ${styles.accentActions}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>Active Actions</span>
                <span className={`${styles.badge} ${styles.badgeActive}`}>
                  <Target size={11} /> In Flight
                </span>
              </div>
              <div className={styles.cardMain}>
                <div className={styles.cardValue}>
                  {activeActionsCount}
                  <span className={styles.cardValueUnit}>in progress</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>{completedActionsCount} completed · tracked in ledger</span>
                </div>
              </div>
            </div>

            {/* Card 3: Estimated Monthly Savings */}
            <div className={`${styles.overviewCard} ${styles.accentSavings}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>Estimated Monthly Savings</span>
                <span className={`${styles.badge} ${styles.badgeEstimated}`}>
                  <PiggyBank size={11} /> Potential
                </span>
              </div>
              <div className={styles.cardMain}>
                <div className={styles.cardValue}>
                  {recommendationsWithSavings.length ? formatINR(estimatedMonthlySavings) : '—'}
                  <span className={styles.cardValueUnit}>/ mo</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>
                    {recommendationsWithSavings.length
                      ? `From ${recommendationsWithSavings.length} recommendation estimate${recommendationsWithSavings.length === 1 ? '' : 's'}`
                      : 'No validated savings estimates available from current records'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. "YOUR NEXT BEST ACTIONS" SECTION */}
          <section className={styles.section} aria-label="Next Best Actions">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Your Next Best Actions</h2>
                <p className={styles.sectionSubtitle}>
                  Practical actions selected from the resource information in this workspace.
                </p>
              </div>
              <Link to="/action-planner" className={styles.sectionLink}>
                <span>View All in Action Planner</span>
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className={styles.actionsGrid}>
              {topRecommendations.length > 0 ? (
                topRecommendations.map((rec) => (
                  <article key={rec.id} className={styles.actionCard}>
                    <h3 className={styles.actionTitle}>
                      {rec.implementationSteps.find((step) => step.trim()) || rec.nextStep || rec.title}
                    </h3>
                    <Link to="/action-planner" className={styles.actionCta}>
                      <span>Plan This Action</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  </article>
                ))
              ) : (
                <div className={styles.emptyStateCard} style={{ gridColumn: '1 / -1' }}>
                  <div className={styles.emptyStateIcon}>
                    <Sparkles size={28} />
                  </div>
                  <h3 className={styles.emptyStateTitle}>No recommendation data yet</h3>
                  <p className={styles.emptyStateText}>
                    Add complete monthly measurements for supported resources to see relevant actions.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 4 & 5. MIDDLE ROW: RESOURCE TRENDS CHART & RECENT ACTIVITY */}
          <div className={styles.middleGrid}>
            {/* Resource Trends Chart */}
            <section className={styles.chartCard} aria-label="Resource Trends">
              <div className={styles.chartHeader}>
                <div>
                  <h2 className={styles.chartTitle}>Resource Trends</h2>
                  <p className={styles.chartSubtitle}>
                    Each resource, unit, and data-quality series indexed to 100 at its first non-zero reading
                  </p>
                </div>
                <div className={styles.chartStats}>
                  <div className={styles.chartStatItem}>
                    <span className={styles.chartStatLabel}>Resource series</span>
                    <span className={styles.chartStatValue}>{resourceTrends.series.length}</span>
                  </div>
                  <div className={styles.chartStatItem}>
                    <span className={styles.chartStatLabel}>Periods</span>
                    <span className={styles.chartStatValue}>{resourceTrends.chartData.length}</span>
                  </div>
                </div>
              </div>

              <div className={styles.chartWrapper}>
                {resourceTrends.series.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={resourceTrends.chartData}
                      margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border-light)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        stroke="var(--color-text-tertiary)"
                        tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                        axisLine={{ stroke: 'var(--color-border-light)' }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--color-text-tertiary)"
                        tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) => `${value}`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          typeof value === 'number'
                            ? `${value.toFixed(1)} index (${value >= 100 ? '+' : ''}${(value - 100).toFixed(1)}% vs first period)`
                            : value,
                          name,
                        ]}
                      />
                      <Legend />
                      {resourceTrends.series.map((series, index) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.label}
                          stroke={trendColors[index % trendColors.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={styles.chartSubtitle}>
                    Add non-zero resource quantities to see their trends over time.
                  </p>
                )}
              </div>
            </section>

            {/* Recent Activity Timeline */}
            <section className={styles.activityCard} aria-label="Recent Activity">
              <div>
                <h2 className={styles.chartTitle}>Recent Activity</h2>
                <p className={styles.chartSubtitle}>Latest status transitions and interventions</p>
              </div>

              {recentTimeline.length > 0 ? (
                <div className={styles.timeline}>
                  {recentTimeline.map((item) => (
                    <div key={item.id} className={styles.timelineItem}>
                      <span
                        className={`${styles.timelineDot} ${
                          item.toStatus === 'completed'
                            ? styles.timelineDotCompleted
                            : item.toStatus === 'planned'
                            ? styles.timelineDotPlanned
                            : ''
                        }`}
                        aria-hidden="true"
                      />
                      <div className={styles.timelineHeader}>
                        <span className={styles.timelineDate}>{item.date}</span>
                        <span
                          style={{
                            textTransform: 'capitalize',
                            fontWeight: 600,
                            color:
                              item.toStatus === 'completed'
                                ? 'var(--color-success)'
                                : 'var(--color-primary-600)',
                          }}
                        >
                          {item.toStatus}
                        </span>
                      </div>
                      <div className={styles.timelineTitle}>{item.actionTitle}</div>
                      {item.notes && <div className={styles.timelineNote}>{item.notes}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.timelineEmpty}>
                  No action updates logged yet for this workspace.
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* 6. QUICK ACTIONS STRIP */}
      <section className={styles.section} aria-label="Quick Actions">
        <div className={styles.quickActionsGrid}>
          <Link to="/resources" className={styles.quickActionBtn}>
            <div className={styles.quickActionIcon}>
              <Receipt size={20} />
            </div>
            <div className={styles.quickActionInfo}>
              <span className={styles.quickActionTitle}>Log a Resource</span>
              <span className={styles.quickActionDesc}>Record bills or meter readings</span>
            </div>
          </Link>

          <Link to="/compare" className={styles.quickActionBtn}>
            <div className={styles.quickActionIcon}>
              <GitCompareArrows size={20} />
            </div>
            <div className={styles.quickActionInfo}>
              <span className={styles.quickActionTitle}>Compare Options</span>
              <span className={styles.quickActionDesc}>Evaluate cost vs. payback</span>
            </div>
          </Link>

          {ecoScorerAvailable && (
            <Link to="/eco-scorer" className={styles.quickActionBtn}>
              <div className={styles.quickActionIcon}>
                <Camera size={20} />
              </div>
              <div className={styles.quickActionInfo}>
                <span className={styles.quickActionTitle}>Open Eco-Scorer</span>
                <span className={styles.quickActionDesc}>Local object detection and practical suggestions</span>
              </div>
            </Link>
          )}

        </div>
      </section>

      {/* 7. DATA QUALITY NOTICE */}
      <footer className={styles.noticeCard} role="note">
        <Info size={16} className={styles.noticeIcon} />
        <div>
          <strong>Data Quality Notice:</strong> Dashboard values are calculated from your resource
          records. Items marked &apos;estimated&apos; have not been independently verified.
        </div>
      </footer>
    </div>
  );
}
