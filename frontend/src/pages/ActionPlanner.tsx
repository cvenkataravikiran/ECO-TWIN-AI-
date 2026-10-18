import { useEffect, useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { createAction, deleteAction as deleteActionRequest, getActions, getRecommendations, updateAction } from '@/services/api';
import { formatINR } from '@/utils/currency';
import type { Recommendation, Action, ActionStatus, DifficultyLevel, ConfidenceLevel } from '@/types';
import {
  Sparkles,
  Check,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Pause,
  Trash2,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  Leaf,
  Zap,
  Utensils,
  Bike,
  Droplets,
  ShoppingBag,
  Recycle,
  Building2,
  FileText,
  HelpCircle,
  TrendingDown,
  X,
  ClipboardCheck,
} from 'lucide-react';
import styles from './ActionPlanner.module.css';

/* Helper: Category Label & Icon */
function getCategoryMeta(cat: string) {
  switch (cat) {
    case 'home-energy':
      return { label: 'Home Energy', icon: Zap, className: styles.catHomeEnergy };
    case 'food-kitchen':
      return { label: 'Food & Kitchen', icon: Utensils, className: styles.catFoodKitchen };
    case 'travel-transport':
      return { label: 'Travel & Transport', icon: Bike, className: styles.catTravelTransport };
    case 'water-nature':
      return { label: 'Water & Nature', icon: Droplets, className: styles.catWaterNature };
    case 'shopping-products':
      return { label: 'Shopping & Products', icon: ShoppingBag, className: styles.catShoppingProducts };
    case 'waste-circular':
      return { label: 'Waste & Circular', icon: Recycle, className: styles.catWasteCircular };
    case 'business-institutions':
      return { label: 'Business & Inst.', icon: Building2, className: styles.catHomeEnergy };
    default:
      return { label: 'General', icon: Leaf, className: styles.catHomeEnergy };
  }
}

/* Helper: Difficulty Badge */
function getDifficultyBadge(diff: DifficultyLevel) {
  switch (diff) {
    case 'easy':
      return { label: 'Easy', className: styles.diffEasy };
    case 'moderate':
      return { label: 'Moderate', className: styles.diffModerate };
    case 'challenging':
      return { label: 'Challenging', className: styles.diffChallenging };
    case 'complex':
      return { label: 'Complex', className: styles.diffComplex };
  }
}

/* Helper: Status Badge */
function getStatusBadge(status: ActionStatus) {
  switch (status) {
    case 'suggested':
      return { label: 'Suggested', className: styles.statusPlanned };
    case 'planned':
      return { label: 'Planned', className: styles.statusPlanned };
    case 'in-progress':
      return { label: 'In Progress', className: styles.statusInProgress };
    case 'completed':
      return { label: 'Completed', className: styles.statusCompleted };
    case 'deferred':
      return { label: 'Deferred', className: styles.statusDeferred };
  }
}

/* Helper: Confidence Badge */
function getConfidenceBadge(conf: ConfidenceLevel) {
  switch (conf) {
    case 'high':
      return { label: 'High Confidence', className: styles.confHigh };
    case 'medium':
      return { label: 'Medium Confidence', className: styles.confMedium };
    case 'low':
      return { label: 'Low Confidence', className: styles.confLow };
    case 'insufficient':
      return { label: 'Insufficient Data', className: styles.confInsufficient };
  }
}

/* Helper: Confidence Level Explanation */
function getConfidenceExplanation(conf: ConfidenceLevel): string {
  switch (conf) {
    case 'high':
      return 'High confidence: Directly backed by empirical utility bills, verified metering, and published peer-reviewed emission factors.';
    case 'medium':
      return 'Medium confidence: Derived from regional grid averages and standard equipment benchmarks. Verification with actual bills will elevate this to high confidence.';
    case 'low':
      return 'Low confidence: Based on self-reported estimates or broad demographic proxies. Subject to higher variance until individualized sub-metering is recorded.';
    case 'insufficient':
      return 'Insufficient baseline data: Awaiting initial measurement records before reliable verification can occur.';
  }
}

/* Helper: Date utilities outside component scope for compiler purity */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export default function ActionPlanner() {
  const {
    currentWorkspace,
    workspacesLoading,
    workspacesError,
  } = useWorkspace();

  // Local state for actions and recommendations
  const [actions, setActions] = useState<Action[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [plannerLoadError, setPlannerLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPlannerData() {
      if (!currentWorkspace.id) {
        if (isMounted) {
          setActions([]);
          setRecommendations([]);
          setPlannerLoadError('');
        }
        return;
      }

      try {
        const [actionList, recommendationList] = await Promise.all([
          getActions(currentWorkspace.id),
          getRecommendations(currentWorkspace.id),
        ]);

        if (!isMounted) return;
        setActions(actionList);
        setRecommendations(recommendationList);
        setPlannerLoadError('');
      } catch (error) {
        console.error('Unable to load planner data', error);
        if (isMounted) {
          setActions([]);
          setRecommendations([]);
          setPlannerLoadError(
            error instanceof Error ? error.message : 'Unable to load actions and recommendations.',
          );
        }
      }
    }

    loadPlannerData();
    return () => {
      isMounted = false;
    };
  }, [currentWorkspace.id]);

  // Filter state for status overview
  const [activeStatusFilter, setActiveStatusFilter] = useState<ActionStatus | 'all'>('all');

  // Accordion expand states for recommendations
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Accordion expand states for actions
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({});
  const [expandedRecordResults, setExpandedRecordResults] = useState<Record<string, boolean>>({});

  // Record Result form state for completed actions
  const [resultFormData, setResultFormData] = useState<
    Record<
      string,
      {
        actualExpenditure: string;
        actualSavings: string;
        notes: string;
      }
    >
  >({});

  // Ranking transparency expandable details
  const [showTransparencyWeights, setShowTransparencyWeights] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Toggle "Why this was recommended"
  const toggleWhy = (recId: string) => {
    setExpandedWhy((prev) => ({ ...prev, [recId]: !prev[recId] }));
  };

  // Toggle "View Details"
  const toggleDetails = (recId: string) => {
    setExpandedDetails((prev) => ({ ...prev, [recId]: !prev[recId] }));
  };

  // Toggle Action Timeline
  const toggleTimeline = (actionId: string) => {
    setExpandedTimelines((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
  };

  // Toggle Record Result section
  const toggleRecordResult = (actionId: string) => {
    setExpandedRecordResults((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
  };

  // Handle "Add to Plan" from recommendations
  const handleAddToPlan = async (rec: Recommendation) => {
    const isAlreadyPlanned = actions.some((a) => a.recommendationId === rec.id);
    if (isAlreadyPlanned) {
      setToastMessage({
        text: `"${rec.title}" is already in your action plan.`,
        type: 'info',
      });
      return;
    }

    try {
      const created = await createAction({
        workspace_id: currentWorkspace.id,
        recommendation_id: rec.id,
        title: rec.title,
        category: rec.category,
        status: 'planned',
        planned_date: getTodayString(),
        initial_estimate_amount: rec.estimatedUpfrontCost?.amount ?? null,
        initial_estimate_currency: 'INR',
        notes: [rec.problemOrOpportunity, ...rec.sourceReferences].filter(Boolean).join('\n'),
      });
      setActions((prev) => [created, ...prev]);
      setToastMessage({ text: `Added "${rec.title}" to your action plan.`, type: 'success' });
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Could not save this action.',
        type: 'info',
      });
    }
  };

  // Handle Action Status Transition
  const handleStatusChange = async (actionId: string, toStatus: ActionStatus, defaultNotes?: string) => {
    const today = getTodayString();
    const action = actions.find((item) => item.id === actionId);
    if (!action) return;
    const noteText = defaultNotes ?? (
      toStatus === 'in-progress' ? 'Action initiated' :
      toStatus === 'completed' ? 'User marked this action completed' :
      toStatus === 'deferred' ? 'Action deferred for later review' :
      `Status changed to ${toStatus}`
    );
    try {
      const updated = await updateAction(actionId, {
        status: toStatus,
        completed_date: toStatus === 'completed' ? today : null,
        notes: noteText,
      }, currentWorkspace.id);
      setActions((prev) => prev.map((item) => item.id === actionId ? updated : item));
      setToastMessage({ text: `Action status saved as "${toStatus}".`, type: 'success' });
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Could not update this action.',
        type: 'info',
      });
    }
  };

  // Handle Remove Action
  const handleRemoveAction = async (actionId: string, title: string) => {
    try {
      await deleteActionRequest(actionId);
      setActions((prev) => prev.filter((action) => action.id !== actionId));
      setToastMessage({ text: `Removed "${title}" from your plan.`, type: 'success' });
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Could not remove this action.',
        type: 'info',
      });
    }
  };

  // Handle Form Change for "Record Result"
  const handleFormChange = (actionId: string, field: string, value: string) => {
    setResultFormData((prev) => ({
      ...prev,
      [actionId]: {
        ...prev[actionId],
        [field]: value,
      },
    }));
  };

  // Handle Saving Results for Completed Action
  const handleSaveResult = async (actionId: string) => {
    const form = resultFormData[actionId];
    if (!form) return;
    const action = actions.find((item) => item.id === actionId);
    if (!action) return;
    try {
      const updated = await updateAction(actionId, {
        ...(form.actualExpenditure ? { actual_expenditure_amount: Number(form.actualExpenditure) } : {}),
        ...(form.actualSavings ? { actual_savings_amount: Number(form.actualSavings) } : {}),
        ...(form.notes.trim() ? { notes: [action.notes, form.notes.trim()].filter(Boolean).join('\n') } : {}),
      }, currentWorkspace.id);
      setActions((prev) => prev.map((item) => item.id === actionId ? updated : item));
      setExpandedRecordResults((prev) => ({ ...prev, [actionId]: false }));
      setToastMessage({ text: 'User-reported financial results saved.', type: 'success' });
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Could not save the reported results.',
        type: 'info',
      });
    }
  };

  // Status counts for Horizontal Overview Bar
  // Suggested = recommendations count not yet added to actions
  const suggestedCount = recommendations.filter((r) => !actions.some((a) => a.recommendationId === r.id)).length;
  const plannedCount = actions.filter((a) => a.status === 'planned').length;
  const inProgressCount = actions.filter((a) => a.status === 'in-progress').length;
  const completedCount = actions.filter((a) => a.status === 'completed').length;
  const deferredCount = actions.filter((a) => a.status === 'deferred').length;
  const totalActionsCount = actions.length;

  // Filter actions based on activeStatusFilter
  const filteredActions =
    activeStatusFilter === 'all'
      ? actions
      : activeStatusFilter === 'suggested'
      ? [] // Suggested is represented by recommendations
      : actions.filter((a) => a.status === activeStatusFilter);

  return (
    <div className={styles.container}>
      {/* 1. Page Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleArea}>
            <h1 className={styles.pageTitle}>Sustainability Action Planner</h1>
            <p className={styles.pageSubtitle}>
              Personalized recommendations based on your resources, goals, and circumstances.
            </p>
          </div>
          <div className={styles.workspaceBadge}>
            <span className={styles.workspaceDot} />
            <span>
              {workspacesLoading
                ? 'Loading workspace…'
                : currentWorkspace.id
                ? `Workspace: ${currentWorkspace.name} (${currentWorkspace.type})`
                : workspacesError
                ? 'Workspace connection unavailable'
                : 'No active workspace'}
            </span>
          </div>
        </div>

        {/* Toast Alert Message */}
        {toastMessage && (
          <div className={styles.toastAlert} role="status">
            <span>{toastMessage.text}</span>
            <button
              className={styles.toastClose}
              onClick={() => setToastMessage(null)}
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </header>

      {!currentWorkspace.id && !workspacesLoading && (
        <div className={styles.workspaceNotice} role={workspacesError ? 'alert' : 'status'}>
          {workspacesError
            ? `The planner needs a live backend connection before it can load individual data. Use Retry in the workspace selector after starting the backend. ${workspacesError}`
            : 'Create a personal workspace from the workspace selector in the left sidebar to save resources and manage your action plan.'}
        </div>
      )}
      {plannerLoadError && currentWorkspace.id && (
        <div className={styles.workspaceNotice} role="alert">
          Planner data could not be loaded. Check the backend connection and reload the page. {plannerLoadError}
        </div>
      )}

      {/* 2. Action Status Overview Bar */}
      <section className={styles.statusOverviewContainer} aria-label="Action status overview">
        <div className={styles.statusOverviewBar}>
          {/* All */}
          <button
            className={`${styles.statusItem} ${activeStatusFilter === 'all' ? styles.statusItemActive : ''}`}
            onClick={() => setActiveStatusFilter('all')}
            type="button"
          >
            <span className={`${styles.statusDot} ${styles.dotAll}`} />
            <span>All Actions</span>
            <span className={styles.statusCount}>{totalActionsCount}</span>
          </button>

          {/* Suggested */}
          <button
            className={`${styles.statusItem} ${activeStatusFilter === 'suggested' ? styles.statusItemActive : ''}`}
            onClick={() => setActiveStatusFilter(activeStatusFilter === 'suggested' ? 'all' : 'suggested')}
            type="button"
          >
            <span className={`${styles.statusDot} ${styles.dotSuggested}`} />
            <span>Suggested</span>
            <span className={styles.statusCount}>{suggestedCount}</span>
          </button>

          {/* Planned */}
          <button
            className={`${styles.statusItem} ${activeStatusFilter === 'planned' ? styles.statusItemActive : ''}`}
            onClick={() => setActiveStatusFilter(activeStatusFilter === 'planned' ? 'all' : 'planned')}
            type="button"
          >
            <span className={`${styles.statusDot} ${styles.dotPlanned}`} />
            <span>Planned</span>
            <span className={styles.statusCount}>{plannedCount}</span>
          </button>

          {/* In Progress */}
          <button
            className={`${styles.statusItem} ${activeStatusFilter === 'in-progress' ? styles.statusItemActive : ''}`}
            onClick={() => setActiveStatusFilter(activeStatusFilter === 'in-progress' ? 'all' : 'in-progress')}
            type="button"
          >
            <span className={`${styles.statusDot} ${styles.dotInProgress}`} />
            <span>In Progress</span>
            <span className={styles.statusCount}>{inProgressCount}</span>
          </button>

          {/* Completed */}
          <button
            className={`${styles.statusItem} ${activeStatusFilter === 'completed' ? styles.statusItemActive : ''}`}
            onClick={() => setActiveStatusFilter(activeStatusFilter === 'completed' ? 'all' : 'completed')}
            type="button"
          >
            <span className={`${styles.statusDot} ${styles.dotCompleted}`} />
            <span>Completed</span>
            <span className={styles.statusCount}>{completedCount}</span>
          </button>

          {/* Deferred */}
          <button
            className={`${styles.statusItem} ${activeStatusFilter === 'deferred' ? styles.statusItemActive : ''}`}
            onClick={() => setActiveStatusFilter(activeStatusFilter === 'deferred' ? 'all' : 'deferred')}
            type="button"
          >
            <span className={`${styles.statusDot} ${styles.dotDeferred}`} />
            <span>Deferred</span>
            <span className={styles.statusCount}>{deferredCount}</span>
          </button>
        </div>

        {/* Filter Indicator Notice if filtered */}
        {activeStatusFilter !== 'all' && (
          <div className={styles.activeFilterNotice}>
            <span>
              Filtered view: <strong>{activeStatusFilter.toUpperCase()}</strong> actions.
            </span>
            <button className={styles.clearFilterLink} onClick={() => setActiveStatusFilter('all')}>
              Show all actions
            </button>
          </div>
        )}
      </section>

      {/* 5. Ranking Transparency Info Panel */}
      <aside className={styles.transparencyBox} aria-label="Ranking methodology transparency">
        <div className={styles.transparencyHeader}>
          <Sliders className={styles.transparencyIcon} size={20} />
          <div className={styles.transparencyBody}>
            <h2 className={styles.transparencyTitle}>Ranking Transparency</h2>
            <p className={styles.transparencyText}>
              Recommendations are ranked by: relevance to your goals, affordability, feasibility, evidence quality,
              potential savings, and environmental benefit. All weights are configurable.
            </p>
            <button
              className={styles.transparencyToggle}
              onClick={() => setShowTransparencyWeights(!showTransparencyWeights)}
              type="button"
            >
              <span>{showTransparencyWeights ? 'Hide weighting breakdown' : 'View weighting breakdown'}</span>
              {showTransparencyWeights ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showTransparencyWeights && (
              <div className={styles.transparencyWeightsGrid}>
                <div className={styles.weightCard}>
                  <div className={styles.weightTop}>
                    <span className={styles.weightLabel}>Relevance & Context</span>
                    <span className={styles.weightPct}>25%</span>
                  </div>
                  <div className={styles.weightBarBg}>
                    <div className={styles.weightBarFill} style={{ width: '25%' }} />
                  </div>
                </div>

                <div className={styles.weightCard}>
                  <div className={styles.weightTop}>
                    <span className={styles.weightLabel}>Affordability & Payback</span>
                    <span className={styles.weightPct}>20%</span>
                  </div>
                  <div className={styles.weightBarBg}>
                    <div className={styles.weightBarFill} style={{ width: '20%' }} />
                  </div>
                </div>

                <div className={styles.weightCard}>
                  <div className={styles.weightTop}>
                    <span className={styles.weightLabel}>Feasibility & Effort</span>
                    <span className={styles.weightPct}>20%</span>
                  </div>
                  <div className={styles.weightBarBg}>
                    <div className={styles.weightBarFill} style={{ width: '20%' }} />
                  </div>
                </div>

                <div className={styles.weightCard}>
                  <div className={styles.weightTop}>
                    <span className={styles.weightLabel}>Environmental Benefit</span>
                    <span className={styles.weightPct}>15%</span>
                  </div>
                  <div className={styles.weightBarBg}>
                    <div className={styles.weightBarFill} style={{ width: '15%' }} />
                  </div>
                </div>

                <div className={styles.weightCard}>
                  <div className={styles.weightTop}>
                    <span className={styles.weightLabel}>Evidence Quality</span>
                    <span className={styles.weightPct}>10%</span>
                  </div>
                  <div className={styles.weightBarBg}>
                    <div className={styles.weightBarFill} style={{ width: '10%' }} />
                  </div>
                </div>

                <div className={styles.weightCard}>
                  <div className={styles.weightTop}>
                    <span className={styles.weightLabel}>Recurring Savings</span>
                    <span className={styles.weightPct}>10%</span>
                  </div>
                  <div className={styles.weightBarBg}>
                    <div className={styles.weightBarFill} style={{ width: '10%' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 3. Recommendations Section */}
      <section className={styles.section} aria-labelledby="recommended-actions-heading">
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionHeadingGroup}>
              <h2 id="recommended-actions-heading" className={styles.sectionTitle}>
                Recommended Actions
              </h2>
              <span className={styles.sectionCounter}>{recommendations.length}</span>
            </div>
            <p className={styles.sectionSubtitle}>
              Interventions prioritized for your resource baseline and lifestyle feasibility.
            </p>
          </div>
        </div>

        <div className={styles.recGrid}>
          {recommendations.map((rec) => {
            const catMeta = getCategoryMeta(rec.category);
            const CatIcon = catMeta.icon;
            const diffBadge = getDifficultyBadge(rec.difficulty);
            const isWhyExpanded = Boolean(expandedWhy[rec.id]);
            const isDetailsExpanded = Boolean(expandedDetails[rec.id]);
            const isAlreadyInPlan = actions.some((a) => a.recommendationId === rec.id);

            return (
              <article key={rec.id} className={styles.recCard}>
                {/* Card Top: Badges & Priority Meter */}
                <div className={styles.recCardTop}>
                  <div className={styles.badgeGroup}>
                    <span className={`${styles.categoryBadge} ${catMeta.className}`}>
                      <CatIcon size={12} />
                      {catMeta.label}
                    </span>
                    <span className={`${styles.diffBadge} ${diffBadge.className}`}>
                      {diffBadge.label}
                    </span>
                  </div>

                  {/* Priority score meter */}
                  <div className={styles.priorityMeter} title={`Priority Score: ${rec.priorityScore} / 100`}>
                    <span className={styles.priorityLabel}>Score: {rec.priorityScore}</span>
                    <div className={styles.meterContainer}>
                      <div className={styles.meterFill} style={{ width: `${rec.priorityScore}%` }} />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h3 className={styles.recTitle}>{rec.title}</h3>

                {/* Problem or Opportunity */}
                <p className={styles.recProblem}>{rec.problemOrOpportunity}</p>

                {/* Metrics Box (Savings, Environmental Benefit, Upfront Cost) */}
                <div className={styles.metricsGrid}>
                  {/* Estimated Savings */}
                  {rec.estimatedRecurringSavings && (
                    <div className={styles.metricCard}>
                      <div className={styles.metricHeader}>
                        <span className={styles.metricLabel}>Est. Savings</span>
                        <TrendingDown size={14} className={styles.metricLabel} />
                      </div>
                      <div className={styles.metricValue}>
                        {rec.estimatedRecurringSavings.currency === 'INR'
                          ? formatINR(rec.estimatedRecurringSavings.amount)
                          : 'Currency correction required'}
                        <span className={styles.metricPeriod}>/{rec.estimatedRecurringSavings.period === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                      <div className={styles.metricBasisTooltip} title={rec.estimatedRecurringSavings.basis}>
                        {rec.estimatedRecurringSavings.basis}
                      </div>
                    </div>
                  )}

                  {/* Environmental Benefit */}
                  {rec.estimatedEnvironmentalBenefit && (
                    <div className={styles.metricCard}>
                      <div className={styles.metricHeader}>
                        <span className={styles.metricLabel}>Eco Benefit</span>
                        <span className={`${styles.confBadge} ${getConfidenceBadge(rec.estimatedEnvironmentalBenefit.confidenceLevel).className}`}>
                          {rec.estimatedEnvironmentalBenefit.confidenceLevel}
                        </span>
                      </div>
                      <div className={styles.metricValue}>
                        {rec.estimatedEnvironmentalBenefit.value}
                        <span className={styles.metricPeriod}> {rec.estimatedEnvironmentalBenefit.unit}</span>
                      </div>
                      <div className={styles.metricBasisTooltip} title={rec.estimatedEnvironmentalBenefit.basis}>
                        {rec.estimatedEnvironmentalBenefit.basis}
                      </div>
                    </div>
                  )}

                  {/* Upfront Cost */}
                  <div className={`${styles.metricCard} ${!rec.estimatedRecurringSavings || !rec.estimatedEnvironmentalBenefit ? '' : styles.metricCardFull}`}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Upfront Cost</span>
                      <Info size={13} className={styles.metricLabel} />
                    </div>
                    <div className={styles.metricValue}>
                      {rec.estimatedUpfrontCost
                        ? rec.estimatedUpfrontCost.currency === 'INR'
                          ? formatINR(rec.estimatedUpfrontCost.amount)
                          : 'Currency correction required'
                        : 'No upfront cost recorded'}
                    </div>
                    <div className={styles.metricBasisTooltip}>
                      {rec.estimatedUpfrontCost ? rec.estimatedUpfrontCost.basis : 'Requires zero financial investment to implement'}
                    </div>
                  </div>
                </div>

                {/* "Why this was recommended" Expandable Section */}
                <div className={styles.whyContainer}>
                  <button
                    className={styles.whyHeaderBtn}
                    onClick={() => toggleWhy(rec.id)}
                    type="button"
                    aria-expanded={isWhyExpanded}
                  >
                    <span className={styles.whyHeaderTitle}>
                      <Sparkles size={14} />
                      Why this was recommended
                    </span>
                    {isWhyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isWhyExpanded && (
                    <div className={styles.whyBody}>
                      <div className={styles.whyRow}>
                        <div className={styles.whyLabel}>Relevance to your usage:</div>
                        <div>{rec.relevanceExplanation}</div>
                      </div>
                      <div className={styles.whyRow}>
                        <div className={styles.whyLabel}>Prioritization rationale:</div>
                        <div>{rec.prioritizationReason}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* "View Details" Expanded Section */}
                {isDetailsExpanded && (
                  <div className={styles.detailsContainer}>
                    {rec.guidanceSummary && (
                      <div className={styles.detailBlock}>
                        <div className={styles.detailBlockTitle}>Guidance</div>
                        <p>{rec.guidanceSummary}</p>
                      </div>
                    )}

                    {/* Implementation Steps */}
                    <div className={styles.detailBlock}>
                      <div className={styles.detailBlockTitle}>
                        <FileText size={13} /> Implementation Steps
                      </div>
                      <ol className={styles.stepsList}>
                        {rec.implementationSteps.map((step, idx) => (
                          <li key={idx} className={styles.stepItem}>
                            <span className={styles.stepNumber}>{idx + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Assumptions */}
                    {rec.assumptions.length > 0 && (
                      <div className={styles.detailBlock}>
                        <div className={styles.detailBlockTitle}>
                          <HelpCircle size={13} /> Assumptions & Baseline
                        </div>
                        <ul className={styles.bulletList}>
                          {rec.assumptions.map((assump, idx) => (
                            <li key={idx}>{assump}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {rec.guidanceLimitations.length > 0 && (
                      <div className={styles.detailBlock}>
                        <div className={styles.detailBlockTitle}>Guidance limitations</div>
                        <ul className={styles.bulletList}>
                          {rec.guidanceLimitations.map((limitation, idx) => (
                            <li key={idx}>{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Calculation Formula */}
                    {rec.formulaDescription && (
                      <div className={styles.detailBlock}>
                        <div className={styles.detailBlockTitle}>
                          <Sliders size={13} /> Formula Description
                        </div>
                        <div className={styles.formulaBox}>{rec.formulaDescription}</div>
                      </div>
                    )}

                    {/* Source References */}
                    {rec.sourceReferences.length > 0 && (
                      <div className={styles.detailBlock}>
                        <div className={styles.detailBlockTitle}>
                          <Leaf size={13} /> Internal guidance status
                        </div>
                        <div>
                          {rec.sourceReferences.map((src, idx) => (
                            <span key={idx} className={styles.sourceBadge}>
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence Explanation */}
                    <div className={styles.detailBlock}>
                      <div className={styles.detailBlockTitle}>
                        <Info size={13} /> Confidence Level
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        {getConfidenceExplanation(rec.confidenceLevel)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Card Footer: View Details & Add to Plan Buttons */}
                <div className={styles.recFooter}>
                  <button
                    className={styles.detailsBtn}
                    onClick={() => toggleDetails(rec.id)}
                    type="button"
                  >
                    <span>{isDetailsExpanded ? 'Hide Details' : 'View Details'}</span>
                    {isDetailsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {isAlreadyInPlan ? (
                    <span className={styles.addedBadge}>
                      <Check size={14} /> Added to Plan
                    </span>
                  ) : (
                    <button
                      className={styles.addToPlanBtn}
                      onClick={() => handleAddToPlan(rec)}
                      type="button"
                    >
                      <PlusCircle size={15} />
                      Add to Plan
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. My Actions Section */}
      <section className={styles.section} aria-labelledby="your-actions-heading">
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionHeadingGroup}>
              <h2 id="your-actions-heading" className={styles.sectionTitle}>
                Your Action Plan
              </h2>
              <span className={styles.sectionCounter}>{filteredActions.length}</span>
            </div>
            <p className={styles.sectionSubtitle}>
              Track progress, status milestones, actual expenditures, and verified environmental results.
            </p>
          </div>
        </div>

        {/* Actions List or Empty State */}
        {filteredActions.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Clock size={24} />
            </div>
            <h3 className={styles.emptyTitle}>
              {activeStatusFilter === 'all'
                ? 'No actions currently in your plan'
                : `No actions with status "${activeStatusFilter}"`}
            </h3>
            <p className={styles.emptyText}>
              {activeStatusFilter === 'suggested'
                ? 'Browse the recommendations above and click "Add to Plan" to begin tracking.'
                : 'Select recommended actions from above to add them to your active roadmap.'}
            </p>
          </div>
        ) : (
          <div className={styles.actionsList}>
            {filteredActions.map((action) => {
              const catMeta = getCategoryMeta(action.category);
              const CatIcon = catMeta.icon;
              const statusMeta = getStatusBadge(action.status);
              const isTimelineOpen = Boolean(expandedTimelines[action.id]);
              const isRecordResultOpen = Boolean(expandedRecordResults[action.id]);

              // Calculate financial variance if both actual & estimate exist
              const initialAmt = action.initialEstimate?.amount;
              const actualAmt = action.actualExpenditure?.amount;
              const hasComparison = initialAmt !== undefined
                && actualAmt !== undefined
                && action.initialEstimate?.currency === 'INR'
                && action.actualExpenditure?.currency === 'INR';
              const variance = hasComparison ? initialAmt - actualAmt : null;
              const isUnderBudget = variance !== null && variance >= 0;

              return (
                <article key={action.id} className={styles.actionCard}>
                  {/* Action Header */}
                  <div className={styles.actionCardTop}>
                    <div className={styles.actionTitleArea}>
                      <div className={styles.actionHeaderMeta}>
                        <span className={`${styles.categoryBadge} ${catMeta.className}`}>
                          <CatIcon size={12} />
                          {catMeta.label}
                        </span>
                        <span className={`${styles.statusBadge} ${statusMeta.className}`}>
                          <span
                            className={styles.statusDot}
                            style={{
                              backgroundColor:
                                action.status === 'planned'
                                  ? 'var(--color-info)'
                                  : action.status === 'in-progress'
                                  ? 'var(--color-warning)'
                                  : action.status === 'completed'
                                  ? 'var(--color-success)'
                                  : 'var(--color-text-tertiary)',
                            }}
                          />
                          {statusMeta.label}
                        </span>
                      </div>
                      <h3 className={styles.actionTitle}>{action.title}</h3>
                    </div>

                    {/* Status Change Buttons */}
                    <div className={styles.actionControls}>
                      {action.status === 'planned' && (
                        <>
                          <button
                            className={`${styles.controlBtn} ${styles.controlBtnStart}`}
                            onClick={() => handleStatusChange(action.id, 'in-progress')}
                            type="button"
                          >
                            <Play size={13} />
                            Start Action
                          </button>
                          <button
                            className={`${styles.controlBtn} ${styles.controlBtnDefer}`}
                            onClick={() => handleStatusChange(action.id, 'deferred')}
                            type="button"
                          >
                            <Pause size={13} />
                            Defer
                          </button>
                        </>
                      )}

                      {action.status === 'in-progress' && (
                        <>
                          <button
                            className={`${styles.controlBtn} ${styles.controlBtnComplete}`}
                            onClick={() => handleStatusChange(action.id, 'completed')}
                            type="button"
                          >
                            <CheckCircle2 size={13} />
                            Complete
                          </button>
                          <button
                            className={`${styles.controlBtn} ${styles.controlBtnDefer}`}
                            onClick={() => handleStatusChange(action.id, 'deferred')}
                            type="button"
                          >
                            <Pause size={13} />
                            Pause
                          </button>
                        </>
                      )}

                      {action.status === 'completed' && (
                        <>
                          <button
                            className={`${styles.controlBtn} ${styles.controlBtnRecord}`}
                            onClick={() => toggleRecordResult(action.id)}
                            type="button"
                          >
                            <ClipboardCheck size={13} />
                            {isRecordResultOpen ? 'Hide Record Form' : 'Record Result'}
                          </button>
                          <button
                            className={`${styles.controlBtn} ${styles.controlBtnReopen}`}
                            onClick={() => handleStatusChange(action.id, 'in-progress', 'Reopened from completed')}
                            type="button"
                          >
                            <RotateCcw size={13} />
                            Reopen
                          </button>
                        </>
                      )}

                      {action.status === 'deferred' && (
                        <button
                          className={`${styles.controlBtn} ${styles.controlBtnStart}`}
                          onClick={() => handleStatusChange(action.id, 'planned', 'Reactivated from deferred')}
                          type="button"
                        >
                          <RotateCcw size={13} />
                          Reactivate
                        </button>
                      )}

                      {/* Remove from plan */}
                      <button
                        className={styles.controlBtnDelete}
                        onClick={() => handleRemoveAction(action.id, action.title)}
                        title="Remove from plan"
                        type="button"
                        aria-label="Remove action"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Financial Comparison: Actual Expenditure vs Initial Estimate */}
                  <div className={styles.financialComparison}>
                    <div className={styles.comparisonGrid}>
                      {/* Initial Estimate */}
                      <div className={styles.comparisonItem}>
                        <span className={styles.comparisonLabel}>Initial Estimate</span>
                        <span className={styles.comparisonVal}>
                          {action.initialEstimate
                            ? action.initialEstimate.currency === 'INR' ? formatINR(action.initialEstimate.amount) : 'Currency correction required'
                            : 'None set'}
                        </span>
                        {action.initialEstimate && (
                          <span className={styles.comparisonBasis}>{action.initialEstimate.basis}</span>
                        )}
                      </div>

                      {/* Actual Expenditure */}
                      <div className={styles.comparisonItem}>
                        <span className={styles.comparisonLabel}>Actual Spend</span>
                        <span className={styles.comparisonVal}>
                          {action.actualExpenditure
                            ? action.actualExpenditure.currency === 'INR' ? formatINR(action.actualExpenditure.amount) : 'Currency correction required'
                            : action.status === 'completed'
                            ? 'Awaiting input'
                            : 'Pending completion'}
                        </span>
                        {action.actualExpenditure && (
                          <span className={styles.comparisonBasis}>{action.actualExpenditure.basis}</span>
                        )}
                      </div>

                      {/* Variance / Comparison Badge */}
                      {hasComparison && variance !== null && (
                        <div className={styles.comparisonItem}>
                          <span className={styles.comparisonLabel}>Cost Variance</span>
                          <div>
                            <span className={`${styles.varianceBadge} ${isUnderBudget ? styles.varianceGood : styles.varianceOver}`}>
                              {isUnderBudget
                                ? `${formatINR(variance)} under estimate`
                                : `${formatINR(Math.abs(variance))} over estimate`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Environmental Impact Track */}
                      <div className={styles.comparisonItem}>
                        <span className={styles.comparisonLabel}>Environmental Impact</span>
                        <span className={styles.comparisonVal}>
                          {action.environmentalEstimate
                            ? `${action.environmentalEstimate.value} ${action.environmentalEstimate.unit} (est.)`
                            : 'Not estimated'}
                        </span>
                        <span className={styles.comparisonBasis}>
                          {action.environmentalEstimate ? 'Estimate; not measured' : 'No environmental result recorded'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Notes */}
                  {action.notes && (
                    <div className={styles.notesArea}>
                      <FileText size={14} className={styles.notesIcon} />
                      <div>
                        <strong>Notes: </strong>
                        {action.notes}
                      </div>
                    </div>
                  )}

                  {/* "Record Result" Expandable Section (for completed actions) */}
                  {isRecordResultOpen && (
                    <div className={styles.recordResultContainer}>
                      <div className={styles.recordResultHeader}>
                        <h4 className={styles.recordResultTitle}>
                          <ClipboardCheck size={16} /> Record Empirical Results & Savings
                        </h4>
                      </div>

                      <div className={styles.recordFormGrid}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Actual Expenditure (₹ INR)</label>
                          <input
                            type="number"
                            step="0.01"
                            className={styles.formInput}
                            placeholder="Enter rupee amount"
                            value={resultFormData[action.id]?.actualExpenditure ?? (action.actualExpenditure?.amount ?? '')}
                            onChange={(e) => handleFormChange(action.id, 'actualExpenditure', e.target.value)}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Monthly Savings (₹ INR/mo)</label>
                          <input
                            type="number"
                            step="0.01"
                            className={styles.formInput}
                            placeholder="Enter rupee amount"
                            value={resultFormData[action.id]?.actualSavings ?? (action.actualSavings?.amount ?? '')}
                            onChange={(e) => handleFormChange(action.id, 'actualSavings', e.target.value)}
                          />
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                          <label className={styles.formLabel}>Verification Notes & Findings</label>
                          <input
                            type="text"
                            className={styles.formInput}
                            placeholder="Describe the source of your reported result."
                            value={resultFormData[action.id]?.notes ?? ''}
                            onChange={(e) => handleFormChange(action.id, 'notes', e.target.value)}
                          />
                        </div>
                      </div>

                      <button
                        className={styles.recordSaveBtn}
                        onClick={() => handleSaveResult(action.id)}
                        type="button"
                      >
                        <Check size={14} /> Save Results
                      </button>
                    </div>
                  )}

                  {/* Status History Timeline */}
                  <div className={styles.timelineSection}>
                    <button
                      className={styles.timelineToggle}
                      onClick={() => toggleTimeline(action.id)}
                      type="button"
                    >
                      <Clock size={13} />
                      <span>{isTimelineOpen ? 'Hide History Timeline' : `View Status History (${action.statusHistory.length} events)`}</span>
                      {isTimelineOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isTimelineOpen && (
                      <div className={styles.timelineList}>
                        {action.statusHistory.map((item, idx) => (
                          <div key={idx} className={styles.timelineItem}>
                            <div className={styles.timelineItemDot} />
                            <div className={styles.timelineMeta}>
                              <span className={styles.timelineDate}>{item.date}</span>
                              <span className={styles.timelineTransition}>
                                {item.fromStatus} → {item.toStatus}
                              </span>
                            </div>
                            <div className={styles.timelineNotes}>{item.notes}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
