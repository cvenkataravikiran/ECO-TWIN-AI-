import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { downloadSustainabilityReportPdf, getActions, getImpactEntries, getResources } from '@/services/api';
import type { Action, ImpactEntry, ResourceRecord } from '@/types';
import styles from './Reports.module.css';

function getCurrentReportPeriod() {
  const today = new Date();
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: formatDate(today),
  };
}

export default function Reports() {
  const { currentWorkspace } = useWorkspace();
  const [period, setPeriod] = useState(getCurrentReportPeriod);
  const [includeEstimates, setIncludeEstimates] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadedPeriod, setDownloadedPeriod] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [resourceRecords, setResourceRecords] = useState<ResourceRecord[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [impactEntries, setImpactEntries] = useState<ImpactEntry[]>([]);
  const periodIsValid = Boolean(period.start && period.end && period.start <= period.end);

  useEffect(() => {
    if (!currentWorkspace.id) return;

    let isMounted = true;

    async function loadReportData() {
      try {
        const [records, actionItems, impactItems] = await Promise.all([
          getResources(currentWorkspace.id),
          getActions(currentWorkspace.id),
          getImpactEntries(currentWorkspace.id),
        ]);

        if (!isMounted) return;
        setResourceRecords(records);
        setActions(actionItems);
        setImpactEntries(impactItems);
      } catch (error) {
        console.error('Unable to load report data', error);
        if (isMounted) {
          setResourceRecords([]);
          setActions([]);
          setImpactEntries([]);
        }
      }
    }

    loadReportData();
    return () => {
      isMounted = false;
    };
  }, [currentWorkspace.id]);

  const handleDownloadPdf = async () => {
    if (!currentWorkspace.id || !periodIsValid) return;

    setDownloading(true);
    setReportError(null);
    try {
      await downloadSustainabilityReportPdf(
        currentWorkspace.id,
        period.start,
        period.end,
        includeEstimates,
        currentWorkspace.name,
      );
      setDownloadedPeriod(`${period.start} to ${period.end}`);
    } catch (error) {
      console.error('Unable to download sustainability report', error);
      setReportError(error instanceof Error ? error.message : 'Unable to download the PDF report.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCSVExport = (type: string) => {
    let rows: string[][] = [];
    let filename = '';

    if (type === 'resources') {
      rows = [['ID', 'Category', 'Description', 'Quantity', 'Unit', 'Cost', 'Currency', 'Period Start', 'Period End', 'Type', 'Source', 'Notes'],
        ...resourceRecords.map((r) => [r.id, r.category, r.description, String(r.quantity), r.unit, String(r.cost), r.currency, r.periodStart, r.periodEnd, r.measurementType, r.source, r.notes])];
      filename = `ecotwin-resources-${currentWorkspace.name.replace(/\s/g, '-')}.csv`;
    } else if (type === 'actions') {
      rows = [['ID', 'Title', 'Category', 'Status', 'Planned Date', 'Completed Date', 'Notes'],
        ...actions.map((a) => [a.id, a.title, a.category, a.status, a.plannedDate, a.completedDate ?? '', a.notes])];
      filename = `ecotwin-actions-${currentWorkspace.name.replace(/\s/g, '-')}.csv`;
    } else {
      rows = [['ID', 'Date', 'Description', 'Status', 'Estimated', 'Actual', 'Unit', 'Type', 'Source'],
        ...impactEntries.map((e) => [e.id, e.date, e.description, e.status, String(e.estimatedValue ?? ''), String(e.actualValue ?? ''), e.unit, e.valueType, e.dataSource])];
      filename = `ecotwin-impact-${currentWorkspace.name.replace(/\s/g, '-')}.csv`;
    }

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Reports &amp; Export</h1>
        <p className={styles.pageSubtitle}>Download a sustainability report generated from this workspace’s records. User-reported actuals and planned estimates are clearly distinguished.</p>
      </div>

      <div className={styles.periodRow}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Report Period Start</label>
          <input type="date" value={period.start} max={period.end || undefined} onChange={(e) => {
            setPeriod({ ...period, start: e.target.value });
            setDownloadedPeriod(null);
          }} className={styles.input} />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Report Period End</label>
          <input type="date" value={period.end} max={getCurrentReportPeriod().end} onChange={(e) => {
            setPeriod({ ...period, end: e.target.value });
            setDownloadedPeriod(null);
          }} className={styles.input} />
        </div>
        <div className={styles.toggleGroup}>
          <label className={styles.toggleLabel}>
            <input type="checkbox" checked={includeEstimates} onChange={(e) => {
              setIncludeEstimates(e.target.checked);
              setDownloadedPeriod(null);
            }} />
            Include planned estimates in PDF
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>PDF Reports</h2>
        <div className={styles.reportGrid}>
          <div className={styles.reportCard}>
            <div className={styles.reportIcon}><FileText size={22} /></div>
            <div className={styles.reportInfo}>
              <div className={styles.reportTitle}>Sustainability Report</div>
              <div className={styles.reportDesc}>Download a period-based PDF of resource records and planned or completed actions. Records overlapping the selected period are included.</div>
            </div>
            <div className={styles.reportActions}>
              <button className={styles.generateBtn} onClick={handleDownloadPdf} disabled={downloading || !currentWorkspace.id || !periodIsValid}>
                {downloading ? 'Preparing PDF…' : <><Download size={15} /> Download PDF</>}
              </button>
            </div>
            {downloadedPeriod && <div className={styles.generatedBadge}><CheckCircle size={14} /> Downloaded for {downloadedPeriod}</div>}
            {reportError && <div className={styles.reportError} role="alert">{reportError}</div>}
            {!periodIsValid && <div className={styles.reportError} role="alert">The start date must be on or before the end date.</div>}
            {!currentWorkspace.id && <div className={styles.reportError} role="status">Create or select a workspace to download its report.</div>}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>CSV Data Export</h2>
        <p className={styles.sectionNote}>Download your raw data as CSV for use in spreadsheets or other tools. All values are clearly labelled as measured or estimated.</p>
        <div className={styles.csvRow}>
          <button className={styles.csvBtn} onClick={() => handleCSVExport('resources')}><Download size={15} /> Resource Records</button>
          <button className={styles.csvBtn} onClick={() => handleCSVExport('actions')}><Download size={15} /> Action History</button>
          <button className={styles.csvBtn} onClick={() => handleCSVExport('impact')}><Download size={15} /> Impact Ledger</button>
        </div>
      </div>

    </div>
  );
}
