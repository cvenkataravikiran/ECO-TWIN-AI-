// src/services/api.ts
// Centralized API service wrapper for EcoPath.AI frontend.
// All requests go to the FastAPI backend running on localhost:8000.
// This file provides typed helper functions used by React components.

import type { ResourceRecord, Action, Recommendation, ImpactEntry, Workspace, KnowledgeCategory } from '@/types';

// const BASE_URL = 'http://localhost:8000/api';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
/** Helper to handle HTTP responses */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText;
    try {
      const body = JSON.parse(errorText) as { detail?: unknown };
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
      // Keep the original response text when the server does not return JSON.
    }
    throw new Error(`API error ${response.status}: ${message}`);
  }
  return response.json();
}

export interface EcoScorerStatus {
  operational: boolean;
  model_present: boolean;
  dependencies: Record<string, boolean>;
  licence: string;
  setup: string[];
  limitations: string[];
}

export interface KnowledgeArticleSummary {
  id: string;
  title: string;
  category: string;
  summary: string;
  implementation_steps: string[];
  limitations: string[];
  source_title: string;
  source_publisher: string;
  source_url: string;
  verification_status: string;
}

export async function getKnowledgeArticles(
  category: string,
  size = 3,
): Promise<KnowledgeArticleSummary[]> {
  const query = new URLSearchParams({ category, size: String(size) });
  const response = await fetch(`${BASE_URL}/knowledge/?${query.toString()}`);
  const data = await handleResponse<{ items: KnowledgeArticleSummary[] }>(response);
  return data.items;
}

export interface EcoScorerDetection {
  id: string;
  class_label: string;
  classLabel: string;
  sustainability_category: string;
  sustainabilityCategory: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  status: 'detected' | 'confirmed' | 'corrected' | 'dismissed';
  user_label: string | null;
  userLabel: string | null;
  guidance: string;
}

export interface EcoScorerRecommendation {
  id: string;
  article_id: string;
  title: string;
  category: string;
  summary: string;
  implementation_steps: string[];
  limitations: string[];
  observation_ids: string[];
  requires_confirmation: boolean;
  guidance: string[];
  deterministic_recommendation?: {
    id: string;
    title: string;
    relevance_explanation: string;
    formula_description: string;
    assumptions: string[];
    missing_data: string[];
    estimated_monthly_savings: number | null;
    currency: string;
    confidence_level: string;
    measurement_period: string;
    data_basis: string;
    baseline_monthly_electricity_kwh: number;
    baseline_monthly_electricity_cost: number;
    baseline_currency: string;
  };
}

export interface EcoScorerAssessment {
  score: number | null;
  max_score: number | null;
  is_reliable: boolean;
  assessment_status: string;
  label: string;
  confirmed_observation_count: number;
  review_coverage: number;
  contributions: Array<{ category: string }>;
  formula: string;
  limitations: string[];
}

export interface EcoScorerAnalysis {
  assessment_id: string;
  model: { id: string; version: string; licence: string };
  processing_time_ms: number;
  detections: EcoScorerDetection[];
  eco_score: EcoScorerAssessment;
  recommendations: EcoScorerRecommendation[];
  privacy_notice: string;
}

export async function getEcoScorerStatus(): Promise<EcoScorerStatus> {
  return handleResponse<EcoScorerStatus>(await fetch(`${BASE_URL}/eco-scorer/status`));
}

export async function analyseEcoScorerImage(
  workspaceId: string,
  file: File,
): Promise<EcoScorerAnalysis> {
  const url = `${BASE_URL}/eco-scorer/analyse?workspace_id=${encodeURIComponent(workspaceId)}`;
  return handleResponse<EcoScorerAnalysis>(await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  }));
}

export async function updateEcoScorerObservation(
  observationId: string,
  update: {
    status: EcoScorerDetection['status'];
    user_label?: string;
  },
): Promise<{
  observation: EcoScorerDetection;
  eco_score: EcoScorerAssessment;
  recommendations: EcoScorerRecommendation[];
}> {
  const response = await fetch(`${BASE_URL}/eco-scorer/observations/${encodeURIComponent(observationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  return handleResponse(response);
}

export async function saveEcoScorerActions(assessmentId: string): Promise<{
  created_action_ids: string[];
  count: number;
}> {
  const response = await fetch(
    `${BASE_URL}/eco-scorer/assessments/${encodeURIComponent(assessmentId)}/save-actions`,
    { method: 'POST' },
  );
  return handleResponse(response);
}

function normalizeAction(raw: any, fallbackWorkspaceId: string): Action {
  const status = (raw.status ?? 'suggested') as Action['status'];
  const createdAt = raw.created_at ?? raw.createdAt ?? '';
  const plannedDate = raw.planned_date ?? raw.plannedDate ?? '';
  const initialEstimate = raw.initialEstimate ?? (raw.initial_estimate_amount != null ? {
    amount: raw.initial_estimate_amount,
    currency: raw.initial_estimate_currency ?? 'INR',
    period: 'one-time' as const,
    basis: 'Estimate supplied when this action was saved',
    isEstimate: true,
  } : null);

  return {
    id: raw.id ?? '',
    workspaceId: raw.workspace_id ?? raw.workspaceId ?? fallbackWorkspaceId,
    recommendationId: raw.recommendation_id ?? raw.recommendationId ?? '',
    title: raw.title ?? '',
    category: (raw.category ?? 'home-energy') as KnowledgeCategory,
    status,
    statusHistory: Array.isArray(raw.statusHistory) ? raw.statusHistory : [],
    plannedDate,
    completedDate: raw.completed_date ?? raw.completedDate ?? null,
    initialEstimate: initialEstimate,
    actualExpenditure: raw.actualExpenditure ?? (raw.actual_expenditure_amount != null ? {
      amount: raw.actual_expenditure_amount,
      currency: raw.actual_expenditure_currency ?? raw.initial_estimate_currency ?? 'INR',
      period: 'one-time' as const,
      basis: 'Actual verified expenditure',
      isEstimate: false,
    } : null),
    actualSavings: raw.actualSavings ?? (raw.actual_savings_amount != null ? {
      amount: raw.actual_savings_amount,
      currency: raw.actual_savings_currency ?? raw.initial_estimate_currency ?? 'INR',
      period: 'monthly' as const,
      basis: 'Actual verified savings',
      isEstimate: false,
    } : null),
    environmentalEstimate: raw.environmentalEstimate ?? null,
    actualEnvironmentalResult: raw.actualEnvironmentalResult ?? null,
    notes: raw.notes ?? '',
    createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? createdAt,
  };
}

function normalizeRecommendation(raw: any): Recommendation {
  const estimatedMonthly = raw.estimated_monthly_savings ?? raw.estimatedMonthlySavings ?? null;
  const estimatedMonthlyValue =
    typeof estimatedMonthly === 'number' && Number.isFinite(estimatedMonthly)
      ? estimatedMonthly
      : null;
  const confidence = (raw.confidence_level ?? raw.confidenceLevel ?? 'medium') as Recommendation['confidenceLevel'];
  const category = (raw.category ?? 'home-energy') as KnowledgeCategory;
  const environmentalEstimate = raw.environmental_estimate ?? raw.environmentalEstimate;
  const hasEnvironmentalValue =
    typeof environmentalEstimate?.value === 'number' &&
    Number.isFinite(environmentalEstimate.value);

  return {
    id: raw.id ?? '',
    title: raw.title ?? '',
    problemOrOpportunity: raw.problem_or_opportunity ?? raw.problemOrOpportunity ?? raw.relevance_explanation ?? raw.relevanceExplanation ?? '',
    relevanceExplanation: raw.relevance_explanation ?? raw.relevanceExplanation ?? '',
    nextStep: raw.next_step ?? raw.nextStep ?? raw.title ?? 'Review the guidance and choose a practical next step.',
    inputBasis: raw.input_basis ?? raw.inputBasis ?? 'Based on the information available in this workspace.',
    knowledgeArticleId: raw.knowledge_article_id ?? raw.knowledgeArticleId ?? '',
    guidanceSummary: raw.guidance_summary ?? '',
    guidanceLimitations: Array.isArray(raw.guidance_limitations) ? raw.guidance_limitations : [],
    implementationSteps: Array.isArray(raw.implementation_steps)
      ? raw.implementation_steps
      : Array.isArray(raw.implementationSteps)
        ? raw.implementationSteps
        : [],
    difficulty: (raw.difficulty ?? 'moderate') as Recommendation['difficulty'],
    estimatedUpfrontCost: raw.estimatedUpfrontCost ?? null,
    estimatedRecurringSavings: estimatedMonthlyValue !== null ? {
      amount: estimatedMonthlyValue,
      currency: raw.estimated_monthly_savings_currency ?? raw.estimatedMonthlySavingsCurrency ?? 'INR',
      period: 'monthly',
      basis: raw.formula_description ?? raw.formulaDescription ?? '',
      isEstimate: true,
    } : null,
    estimatedEnvironmentalBenefit: hasEnvironmentalValue ? {
      value: environmentalEstimate.value,
      unit: environmentalEstimate.unit ?? 'kg CO₂e/month',
      period: environmentalEstimate.period ?? 'monthly',
      basis: environmentalEstimate.basis ?? '',
      isEstimate: environmentalEstimate.isEstimate ?? true,
      confidenceLevel: (environmentalEstimate.confidenceLevel ?? confidence) as Recommendation['confidenceLevel'],
    } : null,
    formulaDescription: raw.formula_description ?? raw.formulaDescription ?? '',
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
    sourceReferences: Array.isArray(raw.source_references)
      ? raw.source_references
      : Array.isArray(raw.sourceReferences)
        ? raw.sourceReferences
        : [],
    confidenceLevel: confidence,
    prioritizationReason: raw.prioritization_reason ?? raw.prioritizationReason ?? '',
    priorityScore: Number(raw.priority_score ?? raw.priorityScore ?? 0),
    category,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const resp = await fetch(`${BASE_URL}/workspaces`);
  return handleResponse<Workspace[]>(resp);
}

export async function createWorkspace(payload: Pick<Workspace, 'name' | 'type' | 'description'>): Promise<Workspace> {
  const response = await fetch(`${BASE_URL}/workspaces/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Workspace>(response);
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
  });
  await handleResponse<{ deleted: boolean }>(response);
}

export async function updateWorkspace(
  workspaceId: string,
  payload: Pick<Workspace, 'name' | 'description'>,
): Promise<Workspace> {
  const response = await fetch(`${BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Workspace>(response);
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const resp = await fetch(`${BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}`);
  return handleResponse<Workspace>(resp);
}

/** Fetch resource records for a given workspace */
export async function getResources(workspaceId: string): Promise<ResourceRecord[]> {
  const url = `${BASE_URL}/resources?workspace_id=${encodeURIComponent(workspaceId)}`;
  const resp = await fetch(url);
  const data = await handleResponse<{ items: ResourceRecord[]; unsupported_currency_count?: number }>(resp);
  if (data.unsupported_currency_count) {
    throw new Error(
      `${data.unsupported_currency_count} saved record(s) use a non-INR currency and were excluded. Correct the original amounts to INR before using them in this workspace.`,
    );
  }
  return data.items;
}

export async function createResource(
  payload: {
    workspace_id: string;
    category: ResourceRecord['category'];
    description: string;
    quantity: number;
    unit: string;
    cost: number;
    currency: 'INR';
    period_start: string;
    period_end: string;
    measurement_type: ResourceRecord['measurementType'];
    source: string;
    notes: string;
  },
): Promise<ResourceRecord> {
  const response = await fetch(`${BASE_URL}/resources/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<ResourceRecord>(response);
}

export async function updateResource(
  recordId: string,
  payload: Omit<Parameters<typeof createResource>[0], 'workspace_id'>,
): Promise<ResourceRecord> {
  const response = await fetch(`${BASE_URL}/resources/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<ResourceRecord>(response);
}

export async function deleteResource(recordId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/resources/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
  if (response.status === 204) return;
  await handleResponse(response);
}

/** Fetch actions for a given workspace */
export async function getActions(workspaceId: string): Promise<Action[]> {
  const url = `${BASE_URL}/actions?workspace_id=${encodeURIComponent(workspaceId)}`;
  const resp = await fetch(url);
  const data = await handleResponse<{ items: any[] }>(resp);
  return data.items.map((item) => normalizeAction(item, workspaceId));
}

export async function createAction(payload: {
  workspace_id: string;
  recommendation_id?: string | null;
  title: string;
  category: KnowledgeCategory;
  status: Action['status'];
  planned_date: string;
  initial_estimate_amount?: number | null;
  initial_estimate_currency: 'INR';
  notes: string;
}): Promise<Action> {
  const response = await fetch(`${BASE_URL}/actions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return normalizeAction(await handleResponse(response), payload.workspace_id);
}

export async function updateAction(
  actionId: string,
  payload: {
    status?: Action['status'];
    completed_date?: string | null;
    actual_expenditure_amount?: number | null;
    actual_savings_amount?: number | null;
    notes?: string | null;
  },
  workspaceId: string,
): Promise<Action> {
  const response = await fetch(`${BASE_URL}/actions/${encodeURIComponent(actionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return normalizeAction(await handleResponse(response), workspaceId);
}

export async function deleteAction(actionId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/actions/${encodeURIComponent(actionId)}`, { method: 'DELETE' });
  if (response.status === 204) return;
  await handleResponse(response);
}

/** Generate (or fetch) recommendations for a workspace */
export async function getRecommendations(workspaceId: string): Promise<Recommendation[]> {
  const url = `${BASE_URL}/recommendations/generate`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
  });
  const data = await handleResponse<{ recommendations: any[] }>(resp);
  return data.recommendations.map(normalizeRecommendation);
}

/** Fetch impact entries (ledger) for a workspace */
export async function getImpactEntries(workspaceId: string): Promise<ImpactEntry[]> {
  const url = `${BASE_URL}/impact?workspace_id=${encodeURIComponent(workspaceId)}`;
  const resp = await fetch(url);
  const data = await handleResponse<{ items: any[] }>(resp);

  return data.items.map((item) => ({
    id: item.id,
    workspaceId: workspaceId,
    actionId: item.id,
    category: (item.category ?? 'home-energy') as KnowledgeCategory,
    date: item.completed_date ?? item.planned_date ?? '',
    description: item.title ?? item.description ?? '',
    status: (item.status ?? 'planned') as ImpactEntry['status'],
    estimatedValue: item.estimated_value ?? item.estimatedValue ?? null,
    actualValue: item.actual_value ?? item.actualValue ?? null,
    unit: item.currency ?? '',
    valueType: (item.value_type ?? item.valueType ?? 'cost-saving') as ImpactEntry['valueType'],
    dataSource: (item.data_source ?? item.dataSource ?? 'estimated') as ImpactEntry['dataSource'],
    notes: item.notes ?? '',
    calculationVersion: 'Action record; no environmental calculation',
  }));
}

/** Generate and download a workspace-scoped sustainability PDF. */
export async function downloadSustainabilityReportPdf(
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
  includeEstimates: boolean,
  workspaceName: string,
): Promise<void> {
  const query = new URLSearchParams({
    workspace_id: workspaceId,
    period_start: periodStart,
    period_end: periodEnd,
    include_estimates: String(includeEstimates),
  });
  const response = await fetch(`${BASE_URL}/reports/generate.pdf?${query.toString()}`);
  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText;
    try {
      const body = JSON.parse(errorText) as { detail?: unknown };
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
      // Keep the original response text when the server does not return JSON.
    }
    throw new Error(`PDF download failed (${response.status}): ${message}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const safeWorkspaceName = workspaceName.trim().replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'workspace';
  const link = document.createElement('a');
  link.href = url;
  link.download = `ecotwin-sustainability-${safeWorkspaceName}-${periodStart}-to-${periodEnd}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export resources CSV – triggers a file download */
export function exportResourcesCsv(workspaceId: string): void {
  const url = `${BASE_URL}/resources/export/csv?workspace_id=${encodeURIComponent(workspaceId)}`;
  // Create a temporary anchor to start download
  const link = document.createElement('a');
  link.href = url;
  link.download = `resources_${workspaceId}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Import resources CSV – returns a summary of the import */
export async function importResourcesCsv(workspaceId: string, file: File): Promise<{ created: number; ids: string[]; errors: any[] }> {
  const url = `${BASE_URL}/resources/import/csv?workspace_id=${encodeURIComponent(workspaceId)}`;
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch(url, { method: 'POST', body: form });
  return handleResponse(resp);
}

// Additional endpoints (e.g., knowledge base, eco‑scorer) can be added here following the same pattern.
