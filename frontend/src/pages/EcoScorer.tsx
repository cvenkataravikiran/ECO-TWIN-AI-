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
  createAction,
  getEcoScorerStatus,
  saveEcoScorerActions,
  updateEcoScorerObservation,
  type EcoScorerAnalysis,
  type EcoScorerDetection,
  type EcoScorerRecommendation,
  type EcoScorerStatus,
} from '@/services/api';
import type { KnowledgeCategory } from '@/types';
import styles from './EcoScorer.module.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CIRCULAR_PATHWAYS = [
  {
    id: 'keep-in-use',
    condition: 'Working and still useful',
    title: 'Keep using and maintain it',
    guidance: 'Continue using the item and maintain it where needed; the photo does not establish its lifespan or impact.',
  },
  {
    id: 'share-or-donate',
    condition: 'Working but no longer needed',
    title: 'Consider sharing, lending, or donating it',
    guidance: 'Only pass it on if it is safe, usable, and wanted by the recipient.',
  },
  {
    id: 'repair-before-replace',
    condition: 'Needs repair',
    title: 'Check repair options before replacing it',
    guidance: 'Describe the fault and compare a repair option with replacement before deciding.',
  },
  {
    id: 'verify-local-disposal',
    condition: 'No longer usable or at end of life',
    title: 'Check local take-back or disposal guidance',
    guidance: 'Ask your local authority or an authorized collection provider. This app has not verified a local facility or that this item is recyclable.',
  },
  {
    id: 'inspect-first',
    condition: 'Not sure',
    title: 'Inspect the item or seek advice before deciding',
    guidance: 'Confirm its condition and material with a reliable source before choosing repair, reuse, or disposal.',
  },
] as const;

const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'food-kitchen',
  'home-energy',
  'travel-transport',
  'water-nature',
  'shopping-products',
  'waste-circular',
  'business-institutions',
  'visual-assessment',
];

function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return KNOWLEDGE_CATEGORIES.some((category) => category === value);
}

function confidenceText(value: number): string {
  if (value >= 0.75) return 'Higher model confidence';
  if (value >= 0.45) return 'Moderate model confidence';
  return 'Lower model confidence';
}

function getLocalDate(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function getCameraErrorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error)) return undefined;
  return typeof error.name === 'string' ? error.name : undefined;
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
  const [pathwayConditions, setPathwayConditions] = useState<Record<string, string>>({});
  const [pathwayNotes, setPathwayNotes] = useState<Record<string, string>>({});
  const [savingPathwayId, setSavingPathwayId] = useState<string | null>(null);
  const [savedPathways, setSavedPathways] = useState<Record<string, boolean>>({});
  const [pathwayError, setPathwayError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);

  const closeCamera = () => {
    cameraRequestIdRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStream(null);
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraReady(false);
  };

  const startCamera = () => {
    setCameraOpen(true);
    setCameraStarting(true);
    setCameraReady(false);
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera access requires HTTPS (or localhost) and a supported browser. Use the device camera or choose a photo instead.');
      setCameraStarting(false);
      return;
    }

    const requestId = ++cameraRequestIdRef.current;
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    }).then((stream) => {
      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    }).catch((cameraStartError: unknown) => {
      if (requestId !== cameraRequestIdRef.current) return;
      const errorName = getCameraErrorName(cameraStartError);
      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        setCameraError("Camera access is blocked by the browser. Confirm this page is open over HTTPS (or localhost), check this site's camera permission and any in-app browser restrictions, then reload. Or use the device camera or choose a photo instead.");
      } else if (errorName === 'NotFoundError') {
        setCameraError('No camera was found on this device. You can choose an existing photo instead.');
      } else if (errorName === 'NotReadableError') {
        setCameraError('The camera is unavailable or being used by another app. Close other camera apps and try again, or choose a photo.');
      } else {
        setCameraError('The camera could not be started. Check browser permissions and try again, or use the device camera or choose a photo instead.');
      }
    }).finally(() => {
      if (requestId === cameraRequestIdRef.current) setCameraStarting(false);
    });
  };

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

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    void video.play().then(() => {
      setCameraReady(true);
    }).catch(() => {
      setCameraError('The camera preview could not be played. Try again or use the device camera or choose a photo instead.');
    });
  }, [cameraOpen, cameraStream]);

  useEffect(() => () => {
    cameraRequestIdRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
    setPathwayConditions({});
    setPathwayNotes({});
    setSavedPathways({});
    setPathwayError('');
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }, []);

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('The camera is not ready yet. Wait for the preview, then try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('This browser could not capture the camera image. Use the device camera or choose a photo instead.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!image) {
      setCameraError('The camera image could not be created. Please try again.');
      return;
    }

    const capturedAt = Date.now();
    chooseFile(new File([image], `ecotwin-photo-${capturedAt}.jpg`, {
      type: 'image/jpeg',
      lastModified: capturedAt,
    }));
    closeCamera();
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setRecommendations([]);
    setError('');
    setSavedCount(null);
    setPathwayConditions({});
    setPathwayNotes({});
    setSavedPathways({});
    setPathwayError('');
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

  const saveCircularPathway = async (observation: EcoScorerDetection) => {
    if (!analysis || !currentWorkspace.id) return;
    const pathwayId = pathwayConditions[observation.id];
    const pathway = CIRCULAR_PATHWAYS.find((item) => item.id === pathwayId);
    if (!pathway) return;

    setPathwayError('');
    setSavingPathwayId(observation.id);
    try {
      const relatedRecommendation = recommendations.find((item) =>
        item.observation_ids.includes(observation.id),
      );
      const category = relatedRecommendation && isKnowledgeCategory(relatedRecommendation.category)
        ? relatedRecommendation.category
        : 'waste-circular';
      const userNote = pathwayNotes[observation.id]?.trim();

      await createAction({
        workspace_id: currentWorkspace.id,
        recommendation_id: `eco-pathway-${analysis.assessment_id}-${observation.id}`,
        title: `${pathway.title}: ${observation.userLabel || observation.classLabel}`.slice(0, 255),
        category,
        status: 'planned',
        planned_date: getLocalDate(),
        initial_estimate_amount: null,
        initial_estimate_currency: 'INR',
        notes: [
          'Photo-assisted circular action selected by the user.',
          `User-confirmed object label: ${observation.userLabel || observation.classLabel}.`,
          `User-selected condition: ${pathway.condition}.`,
          `Planned next step: ${pathway.title}.`,
          pathway.guidance,
          'No environmental impact, material, or recyclability was inferred from the image.',
          userNote ? `User note: ${userNote}` : '',
        ].filter(Boolean).join('\n'),
      });
      setSavedPathways((previous) => ({ ...previous, [observation.id]: true }));
    } catch (saveError) {
      console.error('Unable to save Eco-Scorer action pathway', saveError);
      setPathwayError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not add this action to the Action Planner.',
      );
    } finally {
      setSavingPathwayId(null);
    }
  };

  const hasConfirmedObservations = analysis?.detections.some(
    (item) => item.status === 'confirmed' || item.status === 'corrected',
  ) ?? false;

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
        <p className={styles.pageSubtitle}>Observe. Explore practical guidance. Choose what to do.</p>
        <p className={styles.pageDesc}>
          Local computer vision identifies supported COCO object classes only.
          Review and confirm detections before saving related actions.
          A photo does not establish environmental performance, lifecycle emissions, material composition,
          local recyclability, or actual electricity use. The displayed score measures mapped action
          opportunities, not environmental performance.
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
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                chooseFile(selected);
                if (selected) closeCamera();
                event.target.value = '';
              }}
            />
            <div className={styles.dropIcon}><Camera size={40} strokeWidth={1.5} /></div>
            <div className={styles.dropTitle}>Drop a photo here or choose an image</div>
            <div className={styles.dropSubtitle}>JPEG, PNG, or WebP · Maximum 10 MB</div>
            <div className={styles.uploadBtn}><Upload size={16} /> Choose image</div>
          </div>

          <div className={styles.uploadActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera size={16} /> Take a photo
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={startCamera}
            >
              <Eye size={16} /> Open live camera
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
                <div className={styles.infoCardText}>The image is sent to your EcoPath.AI backend for local processing, then discarded. The image itself is not retained; assessment metadata and confirmed labels are saved.</div>
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

      {cameraOpen && (
        <div className={styles.cameraOverlay}>
          <section className={styles.cameraDialog} role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title">
            <div className={styles.cameraHeader}>
              <h2 id="camera-dialog-title" className={styles.cameraTitle}>Take a photo</h2>
              <button
                className={styles.resetBtn}
                type="button"
                onClick={closeCamera}
                aria-label="Close camera"
              >
                <X size={16} />
              </button>
            </div>
            <video
              ref={videoRef}
              className={styles.cameraPreview}
              autoPlay
              playsInline
              muted
              aria-label="Live camera preview"
            />
            {cameraStarting && (
              <div className={styles.cameraMessage} role="status">Starting camera… Allow camera access if your browser asks.</div>
            )}
            {cameraError && <ErrorMessage>{cameraError}</ErrorMessage>}
            <div className={styles.cameraActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => cameraInputRef.current?.click()}>
                <Upload size={16} /> Use device camera or choose a photo
              </button>
              <button
                className={styles.analyseBtn}
                type="button"
                onClick={() => void capturePhoto()}
                disabled={cameraStarting || !cameraReady}
              >
                <Camera size={16} /> Capture photo
              </button>
            </div>
          </section>
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
              <div className={styles.panelTitle}>{analysis.eco_score.label}</div>
              <div className={styles.actionScore}>
                <div className={styles.actionScoreValue} aria-label={`${analysis.eco_score.score ?? 0} out of 100 action opportunity score`}>
                  {analysis.eco_score.score ?? '—'}
                  <span> / {analysis.eco_score.max_score ?? 100}</span>
                </div>
                <p>
                  {analysis.eco_score.contributions.length > 0
                    ? `${analysis.eco_score.contributions.length} mapped action ${analysis.eco_score.contributions.length === 1 ? 'area' : 'areas'} found in this photo.`
                    : 'No mapped action areas were recognized. Try a clearer photo or a different scene.'}
                </p>
              </div>
              {analysis.eco_score.local_action && (
                <div className={styles.localAction}>
                  <strong>Telangana action cue</strong>
                  <p>{analysis.eco_score.local_action}</p>
                </div>
              )}
              <p className={styles.panelNote}>
                This is an action-opportunity score—not a rating of how green this place or its occupants are.
                A higher score means more mapped guidance areas were visible, not lower emissions or environmental impact.
              </p>
              {analysis.eco_score.contributions.length > 0 && (
                <p className={styles.panelNote}>
                  Detected action areas: {analysis.eco_score.contributions.map((item) => item.category).join(', ')}.
                </p>
              )}
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
                  <p>Observation review coverage = confirmed, corrected, or dismissed detections ÷ all model detections. It describes review progress only.</p>
                  <ul>{analysis.eco_score.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
                  <p>Model confidence is a detector score and may not be a calibrated probability. Corrections are user-provided and are not model-verified.</p>
                </div>
              )}
            </section>

            <section className={styles.panelSection}>
              <div className={styles.panelTitle}><Leaf size={17} /> Circular action pathway</div>
              <p className={styles.panelNote}>
                Turn a user-confirmed observation into a practical next step. Choose the item’s condition;
                EcoPath.AI will save your selected action to the Action Planner, not claim an environmental result.
              </p>
              {pathwayError && <ErrorMessage>{pathwayError}</ErrorMessage>}
              {!analysis.detections.some((item) => item.status === 'confirmed' || item.status === 'corrected') ? (
                <div className={styles.emptyState}>
                  <Check size={20} />
                  <strong>Confirm an observation to plan an action</strong>
                  <span>Review the detected label first so the action is based on an object you have checked.</span>
                </div>
              ) : (
                analysis.detections
                  .filter((item) => item.status === 'confirmed' || item.status === 'corrected')
                  .map((item) => {
                    const selectedPathway = CIRCULAR_PATHWAYS.find(
                      (pathway) => pathway.id === pathwayConditions[item.id],
                    );
                    return (
                      <article key={item.id} className={styles.pathwayCard}>
                        <div className={styles.recommendationTitle}>
                          {item.userLabel || item.classLabel}
                          <span className={styles.pathwayConfirmed}>User confirmed</span>
                        </div>
                        <label className={styles.pathwayLabel} htmlFor={`pathway-${item.id}`}>
                          What best describes this item?
                        </label>
                        <select
                          id={`pathway-${item.id}`}
                          className={styles.pathwaySelect}
                          value={pathwayConditions[item.id] ?? ''}
                          disabled={Boolean(savedPathways[item.id])}
                          onChange={(event) => setPathwayConditions((previous) => ({
                            ...previous,
                            [item.id]: event.target.value,
                          }))}
                        >
                          <option value="">Choose the item’s current condition</option>
                          {CIRCULAR_PATHWAYS.map((pathway) => (
                            <option key={pathway.id} value={pathway.id}>{pathway.condition}</option>
                          ))}
                        </select>
                        {selectedPathway && (
                          <div className={styles.pathwaySuggestion}>
                            <strong>Possible next step: {selectedPathway.title}</strong>
                            <span>{selectedPathway.guidance}</span>
                          </div>
                        )}
                        <label className={styles.pathwayLabel} htmlFor={`pathway-note-${item.id}`}>
                          Add a personal plan or context (optional)
                        </label>
                        <textarea
                          id={`pathway-note-${item.id}`}
                          className={styles.pathwayNote}
                          value={pathwayNotes[item.id] ?? ''}
                          maxLength={1000}
                          disabled={Boolean(savedPathways[item.id])}
                          placeholder="For example: I will ask a local repair shop for an estimate."
                          onChange={(event) => setPathwayNotes((previous) => ({
                            ...previous,
                            [item.id]: event.target.value,
                          }))}
                        />
                        {savedPathways[item.id] ? (
                          <div className={styles.savedConfirm} role="status">
                            <Check size={16} /> Action added to your Action Planner. Record what happened there after you take the step.
                          </div>
                        ) : (
                          <button
                            className={styles.saveBtn}
                            type="button"
                            disabled={!selectedPathway || savingPathwayId !== null}
                            onClick={() => void saveCircularPathway(item)}
                          >
                            <Save size={16} />
                            {savingPathwayId === item.id ? 'Adding action…' : 'Add this action to my planner'}
                          </button>
                        )}
                      </article>
                    );
                  })
              )}
              <p className={styles.pathwayDisclaimer}>
                Repair, sharing, donation and local disposal options depend on item condition and local services.
                Verify those details yourself; Eco-Scorer does not certify recyclability or calculate impact.
              </p>
            </section>

            <section className={styles.panelSection}>
              <div className={styles.panelTitle}>Recommended actions</div>
              <p className={styles.panelNote}>
                Choose a practical next step for a reviewed item. A photo alone does not determine its
                environmental impact or local recyclability.
              </p>
              {recommendations.length === 0 ? (
                <p className={styles.panelNote}>No suitable actions are available for these detections. Review or correct the detected items above.</p>
              ) : recommendations.map((recommendation) => {
                const primarySuggestion = recommendation.guidance[0]
                  || recommendation.implementation_steps[0]
                  || recommendation.summary;
                const additionalSteps = recommendation.implementation_steps.slice(1);
                return (
                  <article key={recommendation.article_id} className={styles.recommendationCard}>
                    <div className={styles.recommendationTitle}>{recommendation.title}</div>
                    <p className={styles.recommendationAction}>{primarySuggestion}</p>
                    {recommendation.requires_confirmation && (
                      <p className={styles.panelNote}>Confirm the detected item before saving this action.</p>
                    )}
                    {additionalSteps.length > 0 && (
                      <details>
                        <summary>More practical steps</summary>
                        <ol>{additionalSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                      </details>
                    )}
                    {recommendation.deterministic_recommendation && (
                      <details>
                        <summary>View workspace calculation details</summary>
                        <div className={styles.calculationNote}>
                          <strong>{recommendation.deterministic_recommendation.title}</strong>
                          <p>{recommendation.deterministic_recommendation.data_basis}</p>
                          <p>
                            For {recommendation.deterministic_recommendation.measurement_period}: measured workspace electricity was{' '}
                            {recommendation.deterministic_recommendation.baseline_monthly_electricity_kwh.toFixed(2)} kWh, with a recorded cost of{' '}
                            {recommendation.deterministic_recommendation.baseline_currency}{' '}
                            {recommendation.deterministic_recommendation.baseline_monthly_electricity_cost.toFixed(2)}.
                            {' '}This estimate is independent of the photo.
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
                      </details>
                    )}
                    {recommendation.limitations.length > 0 && (
                      <details>
                        <summary>Important limitations</summary>
                        <ul>{recommendation.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
                      </details>
                    )}
                  </article>
                );
              })}
              {savedCount === null ? (
                <button className={styles.saveBtn} type="button" onClick={() => void saveActions()} disabled={saving || recommendations.length === 0 || !hasConfirmedObservations}>
                  <Save size={16} /> {saving ? 'Saving to Action Planner…' : 'Add confirmed actions to Action Planner'}
                </button>
              ) : (
                <div className={styles.savedConfirm} role="status">
                  <Check size={16} /> {savedCount > 0 ? `${savedCount} action${savedCount === 1 ? '' : 's'} added to your Action Planner.` : 'No new confirmed actions were added to your Action Planner.'}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
