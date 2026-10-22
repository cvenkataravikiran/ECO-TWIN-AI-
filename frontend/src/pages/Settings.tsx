import { useEffect, useState } from 'react';
import { Save, Info, Database } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { updateWorkspace } from '@/services/api';
import styles from './Settings.module.css';

export default function Settings() {
  const { currentWorkspace } = useWorkspace();
  const [wsName, setWsName] = useState(currentWorkspace.name);
  const [wsDesc, setWsDesc] = useState(currentWorkspace.description);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setWsName(currentWorkspace.name);
    setWsDesc(currentWorkspace.description);
  }, [currentWorkspace.id, currentWorkspace.name, currentWorkspace.description]);

  const handleSave = async () => {
    if (!currentWorkspace.id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateWorkspace(currentWorkspace.id, {
        name: wsName.trim(),
        description: wsDesc.trim(),
      });
      setWsName(updated.name);
      setWsDesc(updated.description);
      setMessage('Workspace details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save workspace details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Configure your workspace, display preferences, and data settings.</p>
      </div>

      <div className={styles.sections}>
        {/* Workspace */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Workspace</h2>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Workspace Name</label>
              <input className={styles.input} value={wsName} onChange={(e) => setWsName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <input className={styles.input} value={currentWorkspace.type} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={wsDesc} onChange={(e) => setWsDesc(e.target.value)} rows={2} />
            </div>
          </div>
        </section>

        {/* Display */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Display</h2>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Currency</label>
              <div className={styles.staticValue}>INR · ₹ Indian rupee</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Date Format</label>
              <div className={styles.staticValue}>DD/MM/YYYY · India</div>
            </div>
          </div>
        </section>

        {/* Data */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Data</h2>
          <div className={styles.dataRow}>
            <div className={styles.dataInfo}>
              <Database size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <span>Currently using the live backend data source for your workspace and sustainability records.</span>
            </div>
            <span className={styles.dataNote}>Workspace records are stored by the backend. No local-cache action is required.</span>
          </div>
        </section>

        {/* About */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About EcoPath.AI</h2>
          <div className={styles.aboutGrid}>
            <div className={styles.aboutRow}><span>Version</span><span>1.0.0-MVP</span></div>
            <div className={styles.aboutRow}><span>CV Model</span><span>YOLOX-Tiny (ONNX) · Apache 2.0</span></div>
            <div className={styles.aboutRow}><span>Model Source</span><span>Megvii-BaseDetection / YOLOX</span></div>
            <div className={styles.aboutRow}><span>COCO Classes</span><span>80 everyday object categories</span></div>
            <div className={styles.aboutRow}><span>Frontend</span><span>React 19 + TypeScript + Vite</span></div>
            <div className={styles.aboutRow}><span>Backend</span><span>FastAPI + SQLAlchemy + SQLite</span></div>
          </div>
          <div className={styles.notice}>
            <Info size={14} />
            <span>EcoPath.AI combines live workspace data, documented sustainability rules, and knowledge-based recommendations to support practical decision-making.</span>
          </div>
        </section>

        <div className={styles.saveRow}>
          <button className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving || !currentWorkspace.id}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Workspace Details'}
          </button>
          {message && <span className={styles.savedMsg} role="status">{message}</span>}
          {error && <span className={styles.errorMsg} role="alert">{error}</span>}
        </div>
      </div>
    </div>
  );
}
