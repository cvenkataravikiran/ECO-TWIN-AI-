import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  Compass,
  Leaf,
  LineChart,
  Plus,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import styles from './Landing.module.css';

export default function Landing() {
  const navigate = useNavigate();
  const {
    workspaces,
    workspacesLoading,
    workspacesError,
    reloadWorkspaces,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceType, setWorkspaceType] = useState<'individual' | 'business'>('individual');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreateWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createWorkspace({
        name: workspaceName.trim(),
        type: workspaceType,
        description: '',
      });
      navigate('/dashboard');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create your workspace.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenWorkspace = (id: string) => {
    switchWorkspace(id);
    navigate('/dashboard');
  };

  return (
    <main className={styles.landing}>
      <header className={styles.navbar}>
        <Link className={styles.brand} to="/" aria-label="EcoPath.AI home">
          <span className={styles.brandMark}><Leaf size={18} /></span>
          <span>EcoPath<span className={styles.brandAccent}>.AI</span></span>
        </Link>
        <div className={styles.navActions}>
          <span className={styles.navNote}><ShieldCheck size={14} /> Your data. Your workspace.</span>
          {workspaces.length > 0 && (
            <button className={styles.navLink} type="button" onClick={() => navigate('/dashboard')}>
              Open dashboard <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}><span /> PRACTICAL SUSTAINABILITY, MADE PERSONAL</div>
          <h1>Small choices.<br /><em>Clearer impact.</em></h1>
          <p className={styles.heroText}>
            Understand the resources you use, compare everyday alternatives, and turn what you learn into a plan you can actually follow.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryCta} href="#get-started">
              Build your workspace <ArrowRight size={17} />
            </a>
            <span className={styles.heroFootnote}>A useful first step, not another perfect-score promise.</span>
          </div>
          <div className={styles.trustRow}>
            <span><Check size={14} /> Start with your own records</span>
            <span><Check size={14} /> See assumptions clearly</span>
            <span><Check size={14} /> Choose your next action</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Illustration of a sustainability workspace">
          <div className={styles.visualOrb} />
          <div className={styles.visualCaption}>A clearer view of the everyday</div>
          <div className={styles.visualCard}>
            <div className={styles.visualCardTop}>
              <span className={styles.visualCardIcon}><Compass size={17} /></span>
              <span>YOUR WORKSPACE</span>
              <span className={styles.liveDot} />
            </div>
            <div className={styles.visualTitle}>Make the next choice count.</div>
            <div className={styles.visualRule} />
            <div className={styles.visualMetric}>
              <span className={styles.metricIcon}><Zap size={15} /></span>
              <span><strong>Understand</strong><small>Log energy, water, travel &amp; more</small></span>
              <ArrowUpRight size={15} />
            </div>
            <div className={styles.visualMetric}>
              <span className={`${styles.metricIcon} ${styles.metricIconSage}`}><LineChart size={15} /></span>
              <span><strong>Compare</strong><small>See costs, trade-offs &amp; assumptions</small></span>
              <ArrowUpRight size={15} />
            </div>
            <div className={styles.visualMetric}>
              <span className={`${styles.metricIcon} ${styles.metricIconGold}`}><Leaf size={15} /></span>
              <span><strong>Take action</strong><small>Build a plan at your own pace</small></span>
              <ArrowUpRight size={15} />
            </div>
            <div className={styles.visualCardBottom}>
              <Sparkles size={14} />
              <span>Grounded in your inputs. Clear about what is estimated.</span>
            </div>
          </div>
          <div className={styles.visualStamp}><span>01</span><span>Measure<br />what matters</span></div>
        </div>
      </section>

      <section className={styles.principles} aria-label="How EcoPath.AI works">
        <div className={styles.principleIntro}>
          <span className={styles.sectionEyebrow}>A thoughtful way forward</span>
          <h2>From everyday data<br />to considered action.</h2>
        </div>
        <article className={styles.principle}>
          <span className={styles.principleNumber}>01</span>
          <h3>Start with what you know</h3>
          <p>Record bills, usage, and routines. Keep measured and estimated information distinct.</p>
        </article>
        <article className={styles.principle}>
          <span className={styles.principleNumber}>02</span>
          <h3>Explore realistic options</h3>
          <p>Compare alternatives using your values, with assumptions and limitations in view.</p>
        </article>
        <article className={styles.principle}>
          <span className={styles.principleNumber}>03</span>
          <h3>Make progress your way</h3>
          <p>Choose practical actions, track what happens, and refine your plan over time.</p>
        </article>
      </section>

      <section className={styles.startSection} id="get-started">
        <div className={styles.startCopy}>
          <span className={styles.sectionEyebrow}>Your first step</span>
          <h2>Give your sustainability work a place to grow.</h2>
          <p>
            Create a personal or business workspace. You can add more later, switch between them, or remove one when you no longer need it.
          </p>
          <div className={styles.workspaceNote}>
            <ShieldCheck size={17} />
            <span>Workspaces keep your resource records and plans organized by context.</span>
          </div>
        </div>
        <div className={styles.workspacePanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.panelEyebrow}>CREATE A WORKSPACE</span>
              <h3>Where would you like to begin?</h3>
            </div>
            <span className={styles.panelIcon}><Plus size={18} /></span>
          </div>
          <form className={styles.createForm} onSubmit={(event) => void handleCreateWorkspace(event)}>
            <label htmlFor="landing-workspace-name">Workspace name</label>
            <input
              id="landing-workspace-name"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="e.g. My household"
              maxLength={128}
              required
            />
            <label htmlFor="landing-workspace-type">Workspace type</label>
            <select
              id="landing-workspace-type"
              value={workspaceType}
              onChange={(event) => setWorkspaceType(event.target.value as 'individual' | 'business')}
            >
              <option value="individual">Personal</option>
              <option value="business">Business</option>
            </select>
            {createError && <p className={styles.formError} role="alert">{createError}</p>}
            {workspacesError && (
              <div className={styles.formError} role="alert">
                Workspace connection unavailable. {workspacesError}
                <button type="button" onClick={() => void reloadWorkspaces()}>Retry</button>
              </div>
            )}
            <button className={styles.createButton} type="submit" disabled={creating || workspacesLoading || Boolean(workspacesError)}>
              {creating ? 'Creating workspace…' : 'Create workspace and continue'}
              {!creating && <ArrowRight size={16} />}
            </button>
          </form>

          {(workspacesLoading || workspaces.length > 0) && (
            <div className={styles.existingWorkspaces}>
              <div className={styles.existingHeading}>
                <span>Already have a workspace?</span>
                {workspacesLoading && <span className={styles.loadingText}>Loading…</span>}
              </div>
              {workspaces.map((workspace) => (
                <button
                  className={styles.existingWorkspace}
                  key={workspace.id}
                  type="button"
                  onClick={() => handleOpenWorkspace(workspace.id)}
                >
                  <span className={styles.existingIcon}>
                    <Building2 size={16} />
                  </span>
                  <span className={styles.existingDetails}>
                    <strong>{workspace.name}</strong>
                    <small>{workspace.type === 'business' ? 'Business' : 'Personal'} workspace</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.footerBrand} to="/"><Leaf size={14} /> EcoPath.AI</Link>
        <span>Understand your choices. Make progress that fits your life.</span>
        <span className={styles.footerMeta}>India <span aria-hidden="true">·</span> INR</span>
      </footer>
    </main>
  );
}
