import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  Edit2,
  Eye,
  Info,
  Leaf,
  RotateCcw,
  Save,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  analyseEcoScorerImage,
  getEcoScorerStatus,
  saveEcoScorerActions,
  updateEcoScorerObservation,
  type EcoScorerAnalysis,
  type EcoScorerDetection,
  type EcoScorerRecommendation,
  type EcoScorerStatus,
} from '@/services/api';
import styles from './EcoScorer.module.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function confidenceText(value: number): string {
  if (value >= 0.75) return 'Higher model confidence';
  if (value >= 0.45) return 'Moderate model confidence';
  return 'Lower model confidence';
}

function ErrorMessage({ children }: { children: string }) {
  return (
    <div className={styles.errorMessage} role="alert">
      <AlertTriangle size={17} />
      <span>{children}</span>
    </div>
  );
}

export default function EcoScorer() {
  const { currentWorkspace } = useWorkspace();
  const [modelStatus, setModelStatus] = useState<EcoScorerStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EcoScorerAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<EcoScorerRecommendation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    getEcoScorerStatus()
      .then((status) => {
        if (isMounted) setModelStatus(status);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setStatusError(err instanceof Error ? err.message : 'Could not check local model availability.');
        setModelStatus(null);
      })
      .finally(() => {
        if (isMounted) setStatusLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const chooseFile = useCallback((selected: File | undefined) => {
    setError('');
    if (!selected) return;
    if (!SUPPORTED_TYPES.includes(selected.type)) {
      setFile(null);
      setPreviewUrl(null);
      setError('Unsupported image. Choose a JPEG, PNG, or WebP file.');
      setFileInputKey((key) => key + 1);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setPreviewUrl(null);
      setError('Image is larger than 10 MB. Choose a smaller image.');
      setFileInputKey((key) => key + 1);
      return;
    }
    setAnalysis(null);
    setRecommendations([]);
    setSavedCount(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }, []);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setRecommendations([]);
    setError('');
    setSavedCount(null);
    setEditingId(null);
    setFileInputKey((key) => key + 1);
  };

  const analyse = async () => {
    if (!file || !currentWorkspace.id) {
      setError('Choose a workspace and image before analysing.');
      return;
    }
    setError('');
    setIsProcessing(true);
    try {
      const result = await analyseEcoScorerImage(currentWorkspace.id, file);
      setAnalysis(result);
      setRecommendations(result.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image analysis failed. Please try another image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateObservation = async (
    detection: EcoScorerDetection,
    status: EcoScorerDetection['status'],
    label?: string,
  ) => {
    setError('');
    setUpdatingId(detection.id);
    try {
      const result = await updateEcoScorerObservation(detection.id, {
        status,
        ...(label !== undefined ? { user_label: label } : {}),
      });
      setAnalysis((previous) => previous && ({
        ...previous,
        detections: previous.detections.map((item) =>
          item.id === result.observation.id ? result.observation : item,
        ),
        eco_score: result.eco_score,
      }));
      setRecommendations(result.recommendations);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your observation correction.');
    } finally {
      setUpdatingId(null);
    }
  };

  const saveActions = async () => {
    if (!analysis) return;
    setError('');
    setSaving(true);
    try {
      const result = await saveEcoScorerActions(analysis.assessment_id);
      setSavedCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recommendations to the Action Planner.');
    } finally {
      setSaving(false);
    }
  };

  const retryStatus = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      setModelStatus(await getEcoScorerStatus());
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not check local model availability.');
      setModelStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const renderAvailability = () => {
    if (statusLoading) {
      return <div className={styles.availability} aria-live="polite">Checking local model availability…</div>;
    }
    if (modelStatus?.operational) return null;
    return (
      <section className={styles.availability} aria-live="polite">
        <div className={styles.availabilityTitle}>
          <AlertTriangle size={19} />
          {statusError ? 'Eco-Scorer service unavailable' : 'Eco-Scorer is not enabled yet'}
        </div>
        <p>
          This optional feature needs the licensed YOLOX-Tiny model, local inference dependencies, and
          its mapped knowledge-base articles. Until all are available, image analysis is disabled;
          no sample or simulated detections are shown.
        </p>
        {statusError ? (
          <ErrorMessage>{statusError}</ErrorMessage>
        ) : (
          <ol className={styles.setupList}>
            {(modelStatus?.setup ?? [
              'From the backend folder, install dependencies with: pip install -r requirements.txt',
              'From the project root, fetch the licensed local weights with: python scripts/download_cv_model.py',
              'Restart the backend after installing the model.',
            ]).map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
        <button className={styles.secondaryButton} type="button" onClick={() => void retryStatus()}>
          <RotateCcw size={14} /> Check again
        </button>
      </section>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Eco-Scorer</h1>
        <p className={styles.pageSubtitle}>Observe. Confirm. Find relevant guidance.</p>
        <p className={styles.pageDesc}>
          Local computer vision identifies supported COCO object classes only.
          Confirmed objects can retrieve curated recommendations from EcoTwin’s private knowledge base.
          A photo does not establish environmental performance, lifecycle emissions, material composition,
          local recyclability, or actual electricity use, so this feature does not invent a numeric eco-score.
        </p>
      </div>

      {renderAvailability()}

      {modelStatus?.operational && !analysis && (
        <div className={styles.uploadSection}>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              chooseFile(event.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              key={fileInputKey}
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_TYPES.join(',')}
              className={styles.hiddenInput}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept={SUPPORTED_TYPES.join(',')}
              capture="environment"
              className={styles.hiddenInput}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div className={styles.dropIcon}><Camera size={40} strokeWidth={1.5} /></div>
            <div className={styles.dropTitle}>Drop a photo here or choose an image</div>
            <div className={styles.dropSubtitle}>JPEG, PNG, or WebP · Maximum 10 MB</div>
            <div className={styles.uploadBtn}><Upload size={16} /> Choose image</div>
          </div>

          <div className={styles.uploadActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => cameraInputRef.current?.click()}>
              <Camera size={16} /> Take a photo
            </button>
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <Eye size={18} style={{ color: 'var(--color-primary-500)' }} />
              <div>
                <div className={styles.infoCardTitle}>What the model detects</div>
                <div className={styles.infoCardText}>COCO object labels and model confidence only. The model does not identify materials, product ratings, energy use, or recyclability.</div>
              </div>
            </div>
            <div className={styles.infoCard}>
              <Shield size={18} style={{ color: 'var(--color-primary-500)' }} />
              <div>
                <div className={styles.infoCardTitle}>Image privacy</div>
                <div className={styles.infoCardText}>The image is sent to your EcoTwin backend for local processing, then discarded. The image itself is not retained; assessment metadata and confirmed labels are saved.</div>
              </div>
            </div>
            <div className={styles.infoCard}>
              <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
              <div>
                <div className={styles.infoCardTitle}>No appearance-based impact score</div>
                <div className={styles.infoCardText}>A detected object is not evidence of environmental benefit or harm. The app withholds a numerical score until suitable measured or user-supplied evidence exists.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {file && previewUrl && !analysis && modelStatus?.operational && (
        <div className={styles.previewSection}>
          <div className={styles.previewCard}>
            <img src={previewUrl} alt="Selected image preview" className={styles.previewImage} />
            <div className={styles.previewInfo}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileMeta}>{(file.size / 1024).toFixed(0)} KB · {file.type}</div>
            </div>
            <div className={styles.previewActions}>
              <button className={styles.resetBtn} type="button" onClick={reset}><X size={16} /> Remove</button>
              <button className={styles.analyseBtn} type="button" onClick={() => void analyse()} disabled={isProcessing}>
                {isProcessing ? <><div className={`${styles.spinner} animate-spin`} /> Analysing locally…</> : <><Camera size={16} /> Analyse image</>}
              </button>
            </div>
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {isProcessing && (
            <div className={styles.processingNote} role="status">
              <Info size={14} /> Running the local ONNX object detector. The photo is not sent to an AI service or stored.
            </div>
          )}
        </div>
      )}

      {analysis && previewUrl && (
        <div className={styles.results}>
          <section className={styles.imagePanel}>
            <div className={styles.imagePanelHeader}>
              <span className={styles.panelTitle}>Detected objects</span>
              <button className={styles.resetBtn} type="button" onClick={reset}><RotateCcw size={14} /> New image</button>
            </div>
            <div className={styles.imageContainer}>
              <img src={previewUrl} alt="Image analysed for supported objects" className={styles.resultImage} />
              <div className={styles.bboxOverlay}>
                {analysis.detections.filter((item) => item.status !== 'dismissed').map((item) => (
                  <div
                    key={item.id}
                    className={styles.bbox}
                    style={{ left: `${item.bbox.x}%`, top: `${item.bbox.y}%`, width: `${item.bbox.w}%`, height: `${item.bbox.h}%` }}
                  >
                    <div className={styles.bboxLabel}>{item.userLabel || item.classLabel} {Math.round(item.confidence * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modelInfo}>
              {analysis.model.id} {analysis.model.version} · {analysis.model.licence} · {analysis.processing_time_ms} ms
            </div>
            <p className={styles.privacyNotice}>{analysis.privacy_notice}</p>
          </section>

          <div className={styles.resultsPanel}>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <section className={styles.panelSection}>
              <div className={styles.panelTitle}>Observations ({analysis.detections.length})</div>
              <p className={styles.panelNote}>Confirm, correct, or dismiss each detection. Confidence describes model output, not whether its guidance applies.</p>
              {analysis.detections.length === 0 ? (
                <div className={styles.emptyState}>
                  <Eye size={20} />
                  <strong>No supported objects detected</strong>
                  <span>Try a clearer image with objects in the model’s supported COCO categories.</span>
                </div>
              ) : (
                <div className={styles.observationList}>
                  {analysis.detections.map((item) => (
                    <article key={item.id} className={`${styles.obCard} ${item.status === 'dismissed' ? styles.dismissed : ''}`}>
                      <div className={styles.obHeader}>
                        <div>
                          <span className={styles.obLabel}>{item.userLabel || item.classLabel}</span>
                          <span className={styles.confBadge}>{Math.round(item.confidence * 100)}% · {confidenceText(item.confidence)}</span>
                        </div>
                        <div className={styles.obActions}>
                          {item.status !== 'dismissed' && (
                            <>
                              <button className={styles.iconBtn} type="button" title="Confirm detection" aria-label={`Confirm ${item.classLabel}`} disabled={updatingId === item.id} onClick={() => void updateObservation(item, 'confirmed')}>
                                <Check size={15} style={{ color: '#16a34a' }} />
                              </button>
                              <button className={styles.iconBtn} type="button" title="Correct label" aria-label={`Correct ${item.classLabel}`} disabled={updatingId === item.id} onClick={() => { setEditingId(item.id); setEditLabel(item.userLabel || item.classLabel); }}>
                                <Edit2 size={14} style={{ color: '#2563eb' }} />
                              </button>
                            </>
                          )}
                          <button className={styles.iconBtn} type="button" title={item.status === 'dismissed' ? 'Restore detection' : 'Dismiss detection'} aria-label={item.status === 'dismissed' ? `Restore ${item.classLabel}` : `Dismiss ${item.classLabel}`} disabled={updatingId === item.id} onClick={() => void updateObservation(item, item.status === 'dismissed' ? 'detected' : 'dismissed')}>
                            <X size={15} style={{ color: item.status === 'dismissed' ? '#16a34a' : '#dc2626' }} />
                          </button>
                        </div>
                      </div>
                      {editingId === item.id && (
                        <div className={styles.editRow}>
                          <input value={editLabel} onChange={(event) => setEditLabel(event.target.value)} className={styles.editInput} maxLength={100} aria-label="Correct object label" />
                          <button className={styles.editSave} type="button" disabled={!editLabel.trim() || updatingId === item.id} onClick={() => void updateObservation(item, 'corrected', editLabel.trim())}>Save</button>
                          <button className={styles.editCancel} type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      )}
                      <div className={styles.obCat}><Leaf size={11} /> {item.sustainabilityCategory}</div>
                      {item.status !== 'dismissed' && item.guidance && <p className={styles.obGuidance}>{item.guidance}</p>}
                      <div className={styles.obStatus}>
                        <span className={`${styles.statusPill} ${styles[`st_${item.status}`]}`}>{item.status}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panelSection}>
              <div className={styles.panelTitle}>Assessment</div>
              <div className={styles.insufficientEvidence}>
                <AlertTriangle size={20} />
                <div>
                  <strong>{analysis.eco_score.label}</strong>
                  <p>No environmental rating is calculated from object presence or model confidence.</p>
                </div>
                {analysis.eco_score.contributions.length > 0 && (
                  <p className={styles.panelNote}>
                    Confirmed observation categories (not score points): {analysis.eco_score.contributions.map((item) => item.category).join(', ')}.
                  </p>
                )}
              </div>
              <div className={styles.evidenceBar}>
                <div className={styles.evidenceLabel}>Observation review coverage</div>
                <div className={styles.evidenceTrack}>
                  <div className={styles.evidenceFill} style={{ width: `${analysis.eco_score.review_coverage * 100}%` }} />
                </div>
                <div className={styles.evidencePct}>
                  {Math.round(analysis.eco_score.review_coverage * 100)}% reviewed · {analysis.eco_score.confirmed_observation_count} confirmed
                </div>
              </div>
              <button className={styles.methodologyBtn} type="button" aria-expanded={showMethodology} onClick={() => setShowMethodology((visible) => !visible)}>
                <ChevronDown size={14} style={{ transform: showMethodology ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                Assessment method and limitations
              </button>
              {showMethodology && (
                <div className={styles.methodology}>
                  <p>{analysis.eco_score.formula}</p>
                  <p>Review coverage = confirmed, corrected, or dismissed detections ÷ all model detections. It describes review progress only, not environmental performance or confidence in a sustainability outcome.</p>
                  <ul>{analysis.eco_score.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
                  <p>Model confidence is a detector score and may not be a calibrated probability. Corrections are user-provided and are not model-verified.</p>
                </div>
              )}
            </section>

            <section className={styles.panelSection}>
              <div className={styles.panelTitle}>Knowledge-base recommendations</div>
              {recommendations.length === 0 ? (
                <p className={styles.panelNote}>Confirm a mapped observation to retrieve relevant guidance from the private knowledge base. No recommendation is inferred for unconfirmed or unsupported labels.</p>
              ) : recommendations.map((recommendation) => (
                <article key={recommendation.article_id} className={styles.recommendationCard}>
                  <div className={styles.recommendationTitle}>{recommendation.title}</div>
                  <p>{recommendation.summary}</p>
                  {recommendation.guidance.map((guidance) => <p key={guidance}>{guidance}</p>)}
                  {recommendation.deterministic_recommendation && (
                    <div className={styles.calculationNote}>
                      <strong>{recommendation.deterministic_recommendation.title}</strong>
                      <p>{recommendation.deterministic_recommendation.data_basis}</p>
                      <p>
                        For {recommendation.deterministic_recommendation.measurement_period}: measured workspace electricity was{' '}
                        {recommendation.deterministic_recommendation.baseline_monthly_electricity_kwh.toFixed(2)} kWh, with a recorded cost of{' '}
                        {recommendation.deterministic_recommendation.baseline_currency}{' '}
                        {recommendation.deterministic_recommendation.baseline_monthly_electricity_cost.toFixed(2)}.
                        {' '}This estimate is not derived from the photo.
                      </p>
                      {recommendation.deterministic_recommendation.estimated_monthly_savings !== null && (
                        <p>
                          Estimated monthly cost savings: {recommendation.deterministic_recommendation.currency}{' '}
                          {recommendation.deterministic_recommendation.estimated_monthly_savings.toFixed(2)} · confidence:{' '}
                          {recommendation.deterministic_recommendation.confidence_level}
                        </p>
                      )}
                      <p>Formula: {recommendation.deterministic_recommendation.formula_description}</p>
                      <p>Assumptions: {recommendation.deterministic_recommendation.assumptions.join(' ')}</p>
                      <p>To improve this estimate: {recommendation.deterministic_recommendation.missing_data.join(' ')}</p>
                    </div>
                  )}
                  {recommendation.implementation_steps.length > 0 && (
                    <details>
                      <summary>Suggested steps from article {recommendation.article_id}</summary>
                      <ol>{recommendation.implementation_steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    </details>
                  )}
                  {recommendation.limitations.map((limitation) => <small key={limitation}>Limitation: {limitation}</small>)}
                </article>
              ))}
              {savedCount === null ? (
                <button className={styles.saveBtn} type="button" onClick={() => void saveActions()} disabled={saving || recommendations.length === 0}>
                  <Save size={16} /> {saving ? 'Saving to Action Planner…' : 'Save suitable actions to Action Planner'}
                </button>
              ) : (
                <div className={styles.savedConfirm} role="status">
                  <Check size={16} /> {savedCount > 0 ? `${savedCount} knowledge-base action${savedCount === 1 ? '' : 's'} added to your Action Planner.` : 'These recommendations are already in your Action Planner.'}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
