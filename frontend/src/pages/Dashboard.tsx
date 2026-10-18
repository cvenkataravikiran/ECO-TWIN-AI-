import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  Receipt,
  Zap,
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
import { getResources, getActions, getRecommendations, getImpactEntries, getEcoScorerStatus } from '@/services/api';
import { formatINR } from '@/utils/currency';
import type { ResourceRecord, Recommendation, Action, KnowledgeCategory } from '@/types';
import styles from './Dashboard.module.css';

/* Category display labels */
const categoryLabels: Record<KnowledgeCategory, string> = {
  'home-energy': 'Home Energy',
  'food-kitchen': 'Food & Kitchen',
  'travel-transport': 'Travel & Transport',
  'water-nature': 'Water & Nature',
  'shopping-products': 'Shopping & Products',
  'waste-circular': 'Waste & Circular',
  'business-institutions': 'Business & Institutions',
  'visual-assessment': 'Visual Assessment',
};

/* Time-aware greeting helper */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, welcome back';
  if (hour < 18) return 'Good afternoon, welcome back';
  return 'Good evening, welcome back';
}

/* Custom Tooltip for Electricity Trend */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      month: string;
      kWh: number;
      cost: number;
      measurementType: string;
    };
  }>;
  label?: string;
}

function TrendTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className={styles.customTooltip}>
        <div className={styles.tooltipLabel}>{data.month}</div>
        <div className={styles.tooltipRow}>
          <span>Consumption:</span>
          <span className={styles.tooltipVal}>{data.kWh.toLocaleString()} kWh</span>
        </div>
        <div className={styles.tooltipRow}>
          <span>Energy Cost:</span>
          <span className={styles.tooltipVal}>{formatINR(data.cost)}</span>
        </div>
        <div className={styles.tooltipRow}>
          <span>Status:</span>
          <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
            {data.measurementType}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();

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

  // Electricity usage calculation
  const electricityRecords = useMemo(() => {
    return workspaceRecords
      .filter((r) => r.category === 'electricity')
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }, [workspaceRecords]);

  const latestElectricity = useMemo(() => {
    if (electricityRecords.length === 0) return null;
    return electricityRecords[electricityRecords.length - 1];
  }, [electricityRecords]);

  const previousElectricity = useMemo(() => {
    if (electricityRecords.length < 2) return null;
    return electricityRecords[electricityRecords.length - 2];
  }, [electricityRecords]);

  const electricityDelta = useMemo(() => {
    if (!latestElectricity || !previousElectricity) return null;
    const diff = latestElectricity.quantity - previousElectricity.quantity;
    const pct = (diff / previousElectricity.quantity) * 100;
    return { diff, pct };
  }, [latestElectricity, previousElectricity]);

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

  /* 4. Top 3 Next Best Actions (sorted by priorityScore) */
  const topRecommendations = useMemo(() => {
    return [...fetchedRecommendations]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 3);
  }, [fetchedRecommendations]);

  /* 5. Electricity Chart Data */
  const chartData = useMemo(() => {
    if (electricityRecords.length === 0) return [];
    return electricityRecords.map((r) => {
      const date = new Date(r.periodStart);
      const monthLabel = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      return {
        month: monthLabel,
        kWh: r.quantity,
        cost: r.cost,
        measurementType: r.measurementType,
      };
    });
  }, [electricityRecords]);

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
  const latestMeasuredElectricity = latestElectricity?.measurementType === 'measured' && latestElectricity.quantity > 0
    ? latestElectricity.cost / latestElectricity.quantity
    : null;

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
            <Sparkles size={28} />
          </div>
          <h2 className={styles.emptyStateTitle}>Welcome to {currentWorkspace.name}</h2>
          <p className={styles.emptyStateText}>
            You haven't logged any resource records in this workspace yet. Add your first electricity
            bill, water meter reading, or commute distance to generate tailor-made savings
            recommendations and emissions analytics.
          </p>
          <div className={styles.emptyStateActions}>
            <Link to="/resources" className={styles.btnPrimary}>
              <PlusCircle size={16} />
              Log Your First Resource
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 2. OVERVIEW CARDS (4 cards in a grid) */}
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

            {/* Card 2: Electricity Usage */}
            <div className={`${styles.overviewCard} ${styles.accentElectricity}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>Electricity Usage</span>
                <span className={`${styles.badge} ${styles.badgeMeasured}`}>
                  <Zap size={11} />
                  {latestElectricity?.measurementType === 'estimated' ? 'Estimated' : 'Measured'}
                </span>
              </div>
              <div className={styles.cardMain}>
                <div className={styles.cardValue}>
                  {latestElectricity ? latestElectricity.quantity.toLocaleString('en-IN') : '—'}
                  <span className={styles.cardValueUnit}>kWh</span>
                </div>
                <div className={styles.cardMeta}>
                  {electricityDelta ? (
                    <span className={electricityDelta.diff <= 0 ? styles.trendGood : styles.trendNeutral}>
                      {electricityDelta.diff <= 0 ? (
                        <TrendingDown size={14} />
                      ) : (
                        <TrendingUp size={14} />
                      )}
                      {electricityDelta.diff > 0 ? '+' : ''}
                      {electricityDelta.diff} kWh ({electricityDelta.pct.toFixed(1)}%) vs Sep
                    </span>
                  ) : (
                    <span>Monthly billing record</span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Active Actions */}
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

            {/* Card 4: Estimated Monthly Savings */}
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
                  Practical actions matched to your recorded data, with assumptions and missing
                  measurements made clear.
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
                    <div className={styles.actionCardHeader}>
                      <div className={styles.badgeRow}>
                        <span className={styles.categoryBadge}>
                          {categoryLabels[rec.category] || rec.category}
                        </span>
                        <span
                          className={`${styles.difficultyBadge} ${
                            rec.difficulty === 'easy'
                              ? styles.difficultyEasy
                              : rec.difficulty === 'moderate'
                              ? styles.difficultyModerate
                              : styles.difficultyChallenging
                          }`}
                        >
                          {rec.difficulty}
                        </span>
                        <span className={styles.scoreBadge} title="Priority Score">
                          Score {rec.priorityScore}
                        </span>
                      </div>

                      <h3 className={styles.actionTitle}>{rec.title}</h3>

                      {rec.guidanceSummary && (
                        <div className={styles.actionReason}>{rec.guidanceSummary}</div>
                      )}

                      <div className={styles.actionReason}>
                        &ldquo;{rec.prioritizationReason}&rdquo;
                      </div>
                    </div>

                    <div className={styles.actionFooter}>
                      <div className={styles.actionImpactRow}>
                        <span className={styles.actionSavingsLabel}>Est. Monthly Savings:</span>
                        <span className={styles.actionSavingsValue}>
                          {rec.estimatedRecurringSavings
                            ? `${rec.estimatedRecurringSavings.currency === 'INR' ? formatINR(rec.estimatedRecurringSavings.amount) : 'Currency correction required'} / mo`
                            : 'Non-monetary'}
                        </span>
                      </div>

                      {rec.estimatedEnvironmentalBenefit && (
                        <div className={styles.actionImpactRow}>
                          <span className={styles.actionSavingsLabel}>Environmental Gain:</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-primary-600)' }}>
                            {rec.estimatedEnvironmentalBenefit.value}{' '}
                            {rec.estimatedEnvironmentalBenefit.unit}
                          </span>
                        </div>
                      )}

                      <Link to="/action-planner" className={styles.actionCta}>
                        <span>Adopt This Action</span>
                        <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <div className={styles.emptyStateCard} style={{ gridColumn: '1 / -1' }}>
                  <div className={styles.emptyStateIcon}>
                    <Sparkles size={28} />
                  </div>
                  <h3 className={styles.emptyStateTitle}>No recommendation data yet</h3>
                  <p className={styles.emptyStateText}>
                    Add resource records to enable the recommendation engine for this workspace.
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
                    Electricity consumption (kWh) over recorded billing periods
                  </p>
                </div>
                <div className={styles.chartStats}>
                  <div className={styles.chartStatItem}>
                    <span className={styles.chartStatLabel}>Latest Reading</span>
                    <span className={styles.chartStatValue}>
                      {latestElectricity ? `${latestElectricity.quantity} kWh` : '—'}
                    </span>
                  </div>
                  {electricityDelta && (
                    <div className={styles.chartStatItem}>
                      <span className={styles.chartStatLabel}>MoM Change</span>
                      <span
                        className={styles.chartStatValue}
                        style={{
                          color:
                            electricityDelta.diff <= 0
                              ? 'var(--color-success)'
                              : 'var(--color-warning)',
                        }}
                      >
                        {electricityDelta.diff > 0 ? '+' : ''}
                        {electricityDelta.pct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className={styles.chartStatItem}>
                    <span className={styles.chartStatLabel}>Avg Rate</span>
                    <span className={styles.chartStatValue}>
                      {latestMeasuredElectricity !== null ? `${formatINR(latestMeasuredElectricity)}/kWh` : 'Insufficient measured data'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="electricityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2d7d5f" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2d7d5f" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
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
                      tickFormatter={(val: number) => `${val}`}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="kWh"
                      stroke="#1f6349"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#electricityGradient)"
                      activeDot={{
                        r: 6,
                        fill: '#1f6349',
                        stroke: '#ffffff',
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
                <span className={styles.quickActionDesc}>Local object detection and knowledge-based guidance</span>
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
