/* ============================================================
   EcoTwin AI — Core Type Definitions
   ============================================================ */

// --- Workspace ---
export type WorkspaceType = 'individual' | 'business';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  description: string;
  createdAt: string;
}

// --- Resource Records ---
export type ResourceCategory =
  | 'electricity'
  | 'water'
  | 'gas'
  | 'travel'
  | 'food'
  | 'waste'
  | 'shopping'
  | 'other';

export type MeasurementType = 'measured' | 'estimated' | 'imported';

export interface ResourceRecord {
  id: string;
  workspaceId: string;
  category: ResourceCategory;
  description: string;
  quantity: number;
  unit: string;
  cost: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  measurementType: MeasurementType;
  source: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// --- Knowledge Base ---
export type KnowledgeCategory =
  | 'food-kitchen'
  | 'home-energy'
  | 'travel-transport'
  | 'water-nature'
  | 'shopping-products'
  | 'waste-circular'
  | 'business-institutions'
  | 'visual-assessment';

// --- Recommendations & Actions ---
export type ActionStatus = 'suggested' | 'planned' | 'in-progress' | 'completed' | 'deferred';
export type DifficultyLevel = 'easy' | 'moderate' | 'challenging' | 'complex';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export interface Recommendation {
  id: string;
  title: string;
  problemOrOpportunity: string;
  relevanceExplanation: string;
  knowledgeArticleId: string;
  guidanceSummary: string;
  guidanceLimitations: string[];
  implementationSteps: string[];
  difficulty: DifficultyLevel;
  estimatedUpfrontCost: CostEstimate | null;
  estimatedRecurringSavings: CostEstimate | null;
  estimatedEnvironmentalBenefit: EnvironmentalEstimate | null;
  formulaDescription: string;
  assumptions: string[];
  sourceReferences: string[];
  confidenceLevel: ConfidenceLevel;
  prioritizationReason: string;
  priorityScore: number;
  category: KnowledgeCategory;
  tags: string[];
}

export interface CostEstimate {
  amount: number;
  currency: string;
  period: 'one-time' | 'monthly' | 'annual';
  basis: string; // explanation of how calculated
  isEstimate: boolean;
}

export interface EnvironmentalEstimate {
  value: number;
  unit: string;
  period: 'monthly' | 'annual';
  basis: string;
  isEstimate: boolean;
  confidenceLevel: ConfidenceLevel;
}

export interface Action {
  id: string;
  workspaceId: string;
  recommendationId: string;
  title: string;
  category: KnowledgeCategory;
  status: ActionStatus;
  statusHistory: ActionStatusChange[];
  plannedDate: string;
  completedDate: string | null;
  initialEstimate: CostEstimate | null;
  actualExpenditure: CostEstimate | null;
  actualSavings: CostEstimate | null;
  environmentalEstimate: EnvironmentalEstimate | null;
  actualEnvironmentalResult: EnvironmentalEstimate | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionStatusChange {
  fromStatus: ActionStatus;
  toStatus: ActionStatus;
  date: string;
  notes: string;
}

// --- Comparison / Scenarios ---
export interface ComparisonScenario {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  category: KnowledgeCategory;
  options: ComparisonOption[];
  savedAt: string;
}

export interface ComparisonOption {
  id: string;
  name: string;
  inputs: Record<string, number | string>;
  results: ComparisonResult;
}

export interface ComparisonResult {
  upfrontCost: number | null;
  monthlyCost: number | null;
  annualCost: number | null;
  estimatedSavings: number | null;
  estimatedEmissions: number | null;
  paybackPeriodMonths: number | null;
  effortLevel: DifficultyLevel;
  assumptions: string[];
  limitations: string[];
}

// --- Eco-Scorer (Computer Vision) ---
export type ObservationStatus = 'detected' | 'confirmed' | 'corrected' | 'dismissed';

export interface EcoAssessment {
  id: string;
  workspaceId: string;
  imageFilename: string;
  modelId: string;
  modelVersion: string;
  processingTimeMs: number;
  observations: VisualObservation[];
  score: EcoScore | null;
  reviewCoverage: number;
  recommendations: string[];
  createdAt: string;
  imageRetained: boolean;
}

export interface VisualObservation {
  id: string;
  classLabel: string;
  sustainabilityCategory: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  status: ObservationStatus;
  userLabel: string | null;
  userNotes: string | null;
  knowledgeArticleId: string | null;
}

export interface EcoScore {
  value: number | null;
  maxValue: number | null;
  label: string;
  reviewCoverage: number;
  methodology: string;
  contributions: ScoreContribution[];
  limitations: string[];
  isReliable: boolean;
}

export interface ScoreContribution {
  category: string;
}

// --- Impact Ledger ---
export interface ImpactEntry {
  id: string;
  workspaceId: string;
  actionId: string;
  category: KnowledgeCategory;
  date: string;
  description: string;
  status: ActionStatus;
  estimatedValue: number | null;
  actualValue: number | null;
  unit: string;
  valueType: 'cost-saving' | 'emission-reduction' | 'resource-saving' | 'waste-reduction';
  dataSource: MeasurementType | 'user-reported' | 'not-reported';
  notes: string;
  calculationVersion: string;
}

// --- Reports ---
export type ReportType = 'sustainability' | 'comparison' | 'eco-assessment' | 'progress';

export interface ReportConfig {
  type: ReportType;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  includeEstimates: boolean;
  includeActuals: boolean;
  format: 'pdf' | 'csv';
}

// --- Circular Living ---
export type CircularOption = 'maintain' | 'repair' | 'reuse' | 'donate' | 'recycle' | 'replace' | 'dispose';

export interface CircularAssessment {
  itemType: string;
  material: string;
  condition: string;
  options: CircularOptionDetail[];
}

export interface CircularOptionDetail {
  option: CircularOption;
  applicable: boolean;
  guidance: string;
  knowledgeArticleId: string | null;
  considerations: string[];
  isLocationSpecific: boolean;
}

// --- Navigation ---
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  description: string;
}
