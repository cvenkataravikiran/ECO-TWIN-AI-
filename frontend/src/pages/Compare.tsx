import { useState, useMemo } from 'react';
import {
  Lightbulb,
  Car,
  Coffee,
  Droplets,
  CheckCircle2,
  BookmarkCheck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Scale,
  Calculator,
  Info,
  TrendingDown,
  Trash2,
  Award,
  Layers,
  Sparkles,
  Leaf,
  Building2,
  Home,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useWorkspace } from '@/hooks/useWorkspace';
import KnowledgeGuidance from '@/components/KnowledgeGuidance';
import { formatINR } from '@/utils/currency';
import type { ComparisonOption, DifficultyLevel } from '@/types';
import styles from './Compare.module.css';

// -------------------------------------------------------------
// Scenario IDs & Types
// -------------------------------------------------------------
export type ScenarioId = 'lighting' | 'commute' | 'containers' | 'water';

interface ScenarioMeta {
  id: ScenarioId;
  title: string;
  shortTitle: string;
  subtitle: string;
  category: 'home-energy' | 'travel-transport' | 'waste-circular' | 'water-nature';
  icon: typeof Lightbulb;
  categoryLabel: string;
  formulaDescription: string;
  formulaCode: string;
  emissionFactorText: string;
  emissionSource: string;
  sharedAssumptions: string[];
  sharedLimitations: string[];
}

interface SavedComparisonItem {
  id: string;
  scenarioId: ScenarioId;
  scenarioTitle: string;
  winnerName: string;
  savedAt: string;
  annualSavings: number;
}

// -------------------------------------------------------------
// Pre-built Scenario Metadata
// -------------------------------------------------------------
const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'lighting',
    title: 'Lighting: LED vs Incandescent vs CFL',
    shortTitle: 'Lighting Options',
    subtitle: 'Estimate operating electricity costs from your entered usage, tariff, bulb prices and ratings.',
    category: 'home-energy',
    icon: Lightbulb,
    categoryLabel: 'Home Energy',
    formulaDescription: 'annual_cost = num_bulbs × (wattage ÷ 1000) × hours_per_day × 365 × price_per_kwh + replacement_costs',
    formulaCode: 'Annual Cost (₹) = [N × (W / 1000) × (Hours/day × 365) × User-entered electricity price (₹/kWh)] + replacement costs supplied by the user',
    emissionFactorText: 'Unavailable — no verified India-specific factor is configured.',
    emissionSource: 'Not calculated until a validated India-specific factor is configured.',
    sharedAssumptions: [
      'Constant daily usage pattern across 365 days per year',
      'Stable electricity price throughout evaluation timeline',
      'Bulb lifespans are model inputs, not a guarantee of actual product life.',
    ],
    sharedLimitations: [
      'Frequent power cycling can degrade CFL cathode life faster than rated hours',
      'Older mechanical dimmer switches may require modern trailing-edge dimmer upgrades for LEDs',
      'Waste heat emitted by incandescent lamps is not credited as space heating contribution',
    ],
  },
  {
    id: 'commute',
    title: 'Commute: Car vs Cycling vs Public Transport',
    shortTitle: 'Commuter Mobility',
    subtitle: 'Compare costs using your entered travel distance, frequency and local travel costs.',
    category: 'travel-transport',
    icon: Car,
    categoryLabel: 'Travel & Transport',
    formulaDescription: 'monthly_cost = (distance_km × commute_days × 4.33) × cost_per_km',
    formulaCode: 'Monthly Cost (₹) = user-provided travel cost for the entered distance and frequency',
    emissionFactorText: 'Unavailable — no verified India-specific factors are configured.',
    emissionSource: 'Not calculated until validated India-specific factors are configured.',
    sharedAssumptions: [
      'Monthly distance is derived using 4.333 weeks per month.',
      'All monetary costs must be entered by the user; no local tariff or fare is assumed.',
    ],
    sharedLimitations: [
      'Weather and route conditions affect whether walking or cycling is practical.',
      'Cycling feasibility depends on locally available safe routes and destination facilities.',
      'Public transport costs and door-to-door times depend on services available in your area.',
    ],
  },
  {
    id: 'containers',
    title: 'Containers: Reusable vs Disposable',
    shortTitle: 'Packaging & Containers',
    subtitle: 'Compare packaging waste, single-use recurring purchase costs, and reusable wash lifecycles.',
    category: 'waste-circular',
    icon: Coffee,
    categoryLabel: 'Circular Living',
    formulaDescription: 'annual_cost = annual_uses × (unit_purchase_cost + wash_cost_per_cycle)',
    formulaCode: 'Annual Cost (₹) = user-entered annual use × user-entered item and wash costs',
    emissionFactorText: 'Unavailable — no validated product life-cycle factors are configured.',
    emissionSource: 'No product life-cycle emissions are calculated.',
    sharedAssumptions: [
      'Reusable item lifespan and washing costs are user-entered or model inputs.',
    ],
    sharedLimitations: [
      'Durable items can be accidentally misplaced or dropped before reaching optimal breakeven cycles',
      'Manual washing with running hot water may increase water and energy use compared to efficient dishwashers',
    ],
  },
  {
    id: 'water',
    title: 'Water: Standard vs Low-Flow Fixtures',
    shortTitle: 'Water Conservation',
    subtitle: 'Estimate water use and user-entered costs from shower duration and measured flow rates.',
    category: 'water-nature',
    icon: Droplets,
    categoryLabel: 'Water & Nature',
    formulaDescription: 'annual_cost = (daily_minutes × flow_rate × 365 ÷ 1000) × combined_water_heating_tariff',
    formulaCode: 'Annual Cost (₹) = user-entered water and heating tariff × calculated annual water use',
    emissionFactorText: 'Unavailable — no verified local water/heating factor is configured.',
    emissionSource: 'No water-related emissions are calculated.',
    sharedAssumptions: [
      'Daily shower duration is applied across 365 days.',
      'Flow rates shown are model inputs; measure your fixture for a more relevant estimate.',
    ],
    sharedLimitations: [
      'Low baseline mains pressure (<1.0 bar) may reduce performance without supplementary booster pump',
      'Rinsing long hair with ultra-low flow rates may marginally increase shower duration',
    ],
  },
];

// -------------------------------------------------------------
// Default Inputs State
// -------------------------------------------------------------
interface LightingInputs {
  numBulbs: number;
  hoursPerDay: number;
  pricePerKwh: number;
  incandescentWatts: number;
  cflWatts: number;
  ledWatts: number;
  incandescentBulbPrice: number;
  cflBulbPrice: number;
  ledBulbPrice: number;
}

interface CommuteInputs {
  distanceKm: number;
  daysPerWeek: number;
  carCostPerKm: number;
  bikeMonthlyMaintenance: number;
  bikePurchaseCost: number;
  transitMonthlyPass: number;
}

interface ContainersInputs {
  usesPerWeek: number;
  disposableUnitCost: number;
  washCostPerCycle: number;
  polyContainerCost: number;
  polyLifespanYears: number;
  steelContainerCost: number;
  steelLifespanYears: number;
}

interface WaterInputs {
  showerMinutesPerDay: number;
  waterAndHeatingCostPerM3: number;
  standardFlowRate: number;
  aeratedFlowRate: number;
  highEfficiencyFlowRate: number;
  aeratedFixtureCost: number;
  highEfficiencyFixtureCost: number;
}

const DEFAULT_LIGHTING: LightingInputs = {
  numBulbs: 0,
  hoursPerDay: 0,
  pricePerKwh: 0,
  incandescentWatts: 60,
  cflWatts: 14,
  ledWatts: 9,
  incandescentBulbPrice: 0,
  cflBulbPrice: 0,
  ledBulbPrice: 0,
};

const DEFAULT_COMMUTE: CommuteInputs = {
  distanceKm: 0,
  daysPerWeek: 0,
  carCostPerKm: 0,
  bikeMonthlyMaintenance: 0,
  bikePurchaseCost: 0,
  transitMonthlyPass: 0,
};

const DEFAULT_CONTAINERS: ContainersInputs = {
  usesPerWeek: 0,
  disposableUnitCost: 0,
  washCostPerCycle: 0,
  polyContainerCost: 0,
  polyLifespanYears: 2,
  steelContainerCost: 0,
  steelLifespanYears: 5,
};

const DEFAULT_WATER: WaterInputs = {
  showerMinutesPerDay: 0,
  waterAndHeatingCostPerM3: 0,
  standardFlowRate: 12.0,
  aeratedFlowRate: 7.5,
  highEfficiencyFlowRate: 5.5,
  aeratedFixtureCost: 0,
  highEfficiencyFixtureCost: 0,
};

const COST_INPUTS_BY_SCENARIO: Record<ScenarioId, string[]> = {
  lighting: [
    'pricePerKwh',
    'incandescentBulbPrice',
    'cflBulbPrice',
    'ledBulbPrice',
  ],
  commute: [
    'carCostPerKm',
    'bikePurchaseCost',
    'bikeMonthlyMaintenance',
    'transitMonthlyPass',
  ],
  containers: [
    'disposableUnitCost',
    'washCostPerCycle',
    'polyContainerCost',
    'steelContainerCost',
  ],
  water: [
    'waterAndHeatingCostPerM3',
    'aeratedFixtureCost',
    'highEfficiencyFixtureCost',
  ],
};

function isCostEntered(value: number, id: string, explicitlyEnteredCosts: string[]): boolean {
  return value > 0 || explicitlyEnteredCosts.includes(id);
}

// -------------------------------------------------------------
// Component
// -------------------------------------------------------------
export default function Compare() {
  const {
    currentWorkspace,
    workspacesLoading,
    workspacesError,
  } = useWorkspace();

  // Active scenario
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('lighting');

  // Input states
  const [lighting, setLighting] = useState<LightingInputs>(DEFAULT_LIGHTING);
  const [commute, setCommute] = useState<CommuteInputs>(DEFAULT_COMMUTE);
  const [containers, setContainers] = useState<ContainersInputs>(DEFAULT_CONTAINERS);
  const [water, setWater] = useState<WaterInputs>(DEFAULT_WATER);
  const [explicitlyEnteredCosts, setExplicitlyEnteredCosts] = useState<string[]>([]);
  const [submittedInputSnapshot, setSubmittedInputSnapshot] = useState<string | null>(null);

  const recordCostInput = (id: string) => {
    setExplicitlyEnteredCosts((previous) => previous.includes(id) ? previous : [...previous, id]);
  };

  // UI States
  const [transparencyOpen, setTransparencyOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<'annualCost' | 'savings'>('annualCost');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [savedComparisons, setSavedComparisons] = useState<SavedComparisonItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Scenario Metadata
  const currentScenarioMeta = useMemo(() => {
    return SCENARIOS.find((s) => s.id === activeScenarioId) ?? SCENARIOS[0];
  }, [activeScenarioId]);

  // Reset inputs handler
  const handleResetCurrentScenario = () => {
    if (activeScenarioId === 'lighting') setLighting(DEFAULT_LIGHTING);
    if (activeScenarioId === 'commute') setCommute(DEFAULT_COMMUTE);
    if (activeScenarioId === 'containers') setContainers(DEFAULT_CONTAINERS);
    if (activeScenarioId === 'water') setWater(DEFAULT_WATER);
    setExplicitlyEnteredCosts((previous) =>
      previous.filter((id) => !COST_INPUTS_BY_SCENARIO[activeScenarioId].includes(id)),
    );
    setToastMessage('Inputs cleared. Enter your own values to compare options.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle notes accordion
  const toggleNotes = (optionId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  const missingInputs = useMemo(() => {
    if (activeScenarioId === 'lighting') {
      return [
        lighting.numBulbs > 0 ? '' : 'number of bulbs',
        lighting.hoursPerDay > 0 ? '' : 'daily operating hours',
        isCostEntered(lighting.pricePerKwh, 'pricePerKwh', explicitlyEnteredCosts) ? '' : 'electricity tariff',
        isCostEntered(lighting.incandescentBulbPrice, 'incandescentBulbPrice', explicitlyEnteredCosts) ? '' : 'incandescent bulb price',
        isCostEntered(lighting.cflBulbPrice, 'cflBulbPrice', explicitlyEnteredCosts) ? '' : 'CFL bulb price',
        isCostEntered(lighting.ledBulbPrice, 'ledBulbPrice', explicitlyEnteredCosts) ? '' : 'LED bulb price',
      ].filter(Boolean);
    }
    if (activeScenarioId === 'commute') {
      return [
        commute.distanceKm > 0 ? '' : 'round-trip distance',
        commute.daysPerWeek > 0 ? '' : 'commute days per week',
        isCostEntered(commute.carCostPerKm, 'carCostPerKm', explicitlyEnteredCosts) ? '' : 'car variable cost per kilometre',
        isCostEntered(commute.bikePurchaseCost, 'bikePurchaseCost', explicitlyEnteredCosts) ? '' : 'bicycle purchase cost',
        isCostEntered(commute.bikeMonthlyMaintenance, 'bikeMonthlyMaintenance', explicitlyEnteredCosts) ? '' : 'bicycle monthly upkeep',
        isCostEntered(commute.transitMonthlyPass, 'transitMonthlyPass', explicitlyEnteredCosts) ? '' : 'monthly transit cost',
      ].filter(Boolean);
    }
    if (activeScenarioId === 'containers') {
      return [
        containers.usesPerWeek > 0 ? '' : 'container uses per week',
        isCostEntered(containers.disposableUnitCost, 'disposableUnitCost', explicitlyEnteredCosts) ? '' : 'disposable item cost',
        isCostEntered(containers.washCostPerCycle, 'washCostPerCycle', explicitlyEnteredCosts) ? '' : 'wash cost per cycle',
        isCostEntered(containers.polyContainerCost, 'polyContainerCost', explicitlyEnteredCosts) ? '' : 'reusable container cost',
        isCostEntered(containers.steelContainerCost, 'steelContainerCost', explicitlyEnteredCosts) ? '' : 'durable container cost',
      ].filter(Boolean);
    }
    return [
      water.showerMinutesPerDay > 0 ? '' : 'daily shower duration',
      isCostEntered(water.waterAndHeatingCostPerM3, 'waterAndHeatingCostPerM3', explicitlyEnteredCosts) ? '' : 'water and heating tariff',
      isCostEntered(water.aeratedFixtureCost, 'aeratedFixtureCost', explicitlyEnteredCosts) ? '' : 'aerated fixture cost',
      isCostEntered(water.highEfficiencyFixtureCost, 'highEfficiencyFixtureCost', explicitlyEnteredCosts) ? '' : 'high-efficiency fixture cost',
    ].filter(Boolean);
  }, [activeScenarioId, lighting, commute, containers, water, explicitlyEnteredCosts]);

  const inputSnapshot = JSON.stringify([
    activeScenarioId,
    lighting,
    commute,
    containers,
    water,
    explicitlyEnteredCosts,
  ]);

  // -------------------------------------------------------------
  // CALCULATIONS ENGINE
  // -------------------------------------------------------------
  const computedOptions = useMemo<ComparisonOption[]>(() => {
    if (missingInputs.length > 0) return [];

    if (activeScenarioId === 'lighting') {
      const annualHours = lighting.hoursPerDay * 365;

      // 1. Incandescent (Baseline)
      const incKwh = (lighting.numBulbs * lighting.incandescentWatts * annualHours) / 1000;
      const incEnergyCost = incKwh * lighting.pricePerKwh;
      const incReplacements = annualHours / 1000;
      const incBulbCost = lighting.numBulbs * incReplacements * lighting.incandescentBulbPrice;
      const incAnnualCost = incEnergyCost + incBulbCost;
      const incMonthlyCost = incAnnualCost / 12;

      // 2. CFL
      const cflKwh = (lighting.numBulbs * lighting.cflWatts * annualHours) / 1000;
      const cflEnergyCost = cflKwh * lighting.pricePerKwh;
      const cflReplacements = annualHours / 8000;
      const cflBulbCost = lighting.numBulbs * cflReplacements * lighting.cflBulbPrice;
      const cflAnnualCost = cflEnergyCost + cflBulbCost;
      const cflMonthlyCost = cflAnnualCost / 12;
      const cflUpfront = lighting.numBulbs * lighting.cflBulbPrice;
      const cflSavings = incAnnualCost - cflAnnualCost;
      const cflPayback = cflSavings > 0 ? (cflUpfront / cflSavings) * 12 : null;

      // 3. LED
      const ledKwh = (lighting.numBulbs * lighting.ledWatts * annualHours) / 1000;
      const ledEnergyCost = ledKwh * lighting.pricePerKwh;
      const ledReplacements = annualHours / 25000;
      const ledBulbCost = lighting.numBulbs * ledReplacements * lighting.ledBulbPrice;
      const ledAnnualCost = ledEnergyCost + ledBulbCost;
      const ledMonthlyCost = ledAnnualCost / 12;
      const ledUpfront = lighting.numBulbs * lighting.ledBulbPrice;
      const ledSavings = incAnnualCost - ledAnnualCost;
      const ledPayback = ledSavings > 0 ? (ledUpfront / ledSavings) * 12 : null;

      const opt1: ComparisonOption = {
        id: 'incandescent',
        name: 'Incandescent Bulbs (Baseline)',
        inputs: {
          wattage: lighting.incandescentWatts,
          bulbPrice: lighting.incandescentBulbPrice,
          lifespan: 1000,
        },
        results: {
          upfrontCost: 0,
          monthlyCost: incMonthlyCost,
          annualCost: incAnnualCost,
          estimatedSavings: 0,
          estimatedEmissions: null,
          paybackPeriodMonths: null,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            '1,000 hour rated filament life',
            'Electricity tariff entered by the user.',
          ],
          limitations: [
            'Approx 90% of electricity emitted as waste thermal heat',
            'High frequency of bulb burn-out and replacement trips',
          ],
        },
      };

      const opt2: ComparisonOption = {
        id: 'cfl',
        name: 'CFL Bulbs (Compact Fluorescent)',
        inputs: {
          wattage: lighting.cflWatts,
          bulbPrice: lighting.cflBulbPrice,
          lifespan: 8000,
        },
        results: {
          upfrontCost: cflUpfront,
          monthlyCost: cflMonthlyCost,
          annualCost: cflAnnualCost,
          estimatedSavings: cflSavings,
          estimatedEmissions: null,
          paybackPeriodMonths: cflPayback,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            '8,000 hour rated fluorescent tube lifespan',
            'Reduced energy consumption by ~76% relative to incandescent',
          ],
          limitations: [
            'Requires 30–60 seconds to achieve full lumen output',
            'Some CFL models contain mercury; follow local hazardous-waste collection guidance.',
          ],
        },
      };

      const opt3: ComparisonOption = {
        id: 'led',
        name: 'LED Bulbs (High Efficiency)',
        inputs: {
          wattage: lighting.ledWatts,
          bulbPrice: lighting.ledBulbPrice,
          lifespan: 25000,
        },
        results: {
          upfrontCost: ledUpfront,
          monthlyCost: ledMonthlyCost,
          annualCost: ledAnnualCost,
          estimatedSavings: ledSavings,
          estimatedEmissions: null,
          paybackPeriodMonths: ledPayback,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            '25,000 hour solid-state semiconductor lifespan',
            'Instant full brightness with negligible heat generation',
            'Over 85% energy savings compared to incandescent lamps',
          ],
          limitations: [
            'Older wall dimmer switches may require LED-compatible replacement',
          ],
        },
      };

      return [opt1, opt2, opt3];
    }

    if (activeScenarioId === 'commute') {
      const monthlyKm = commute.distanceKm * commute.daysPerWeek * 4.333;
      // 1. Car (Baseline)
      const carMonthlyCost = monthlyKm * commute.carCostPerKm;
      const carAnnualCost = carMonthlyCost * 12;

      // 2. Cycling
      const bikeMonthlyCost = commute.bikeMonthlyMaintenance;
      const bikeAnnualCost = bikeMonthlyCost * 12;
      const bikeSavings = carAnnualCost - bikeAnnualCost;
      const bikePayback = bikeSavings > 0 ? (commute.bikePurchaseCost / bikeSavings) * 12 : null;

      // 3. Public Transit
      const transitMonthlyCost = commute.transitMonthlyPass;
      const transitAnnualCost = transitMonthlyCost * 12;
      const transitSavings = carAnnualCost - transitAnnualCost;

      const opt1: ComparisonOption = {
        id: 'car',
        name: 'Solo Petrol Car (Baseline)',
        inputs: {
          costPerKm: commute.carCostPerKm,
          monthlyDistanceKm: Math.round(monthlyKm),
        },
        results: {
          upfrontCost: 0,
          monthlyCost: carMonthlyCost,
          annualCost: carAnnualCost,
          estimatedSavings: 0,
          estimatedEmissions: null,
          paybackPeriodMonths: null,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            'Car cost per kilometre is entered by the user.',
            'Baseline vehicle already owned; zero incremental acquisition capital',
          ],
          limitations: [
            'Does not include municipal parking fees or highway tolls',
            'Maximum vehicle traffic congestion exposure and idle loss',
          ],
        },
      };

      const opt2: ComparisonOption = {
        id: 'cycling',
        name: 'Commuter Bicycle / E-Bike',
        inputs: {
          upfrontBikeCost: commute.bikePurchaseCost,
          monthlyMaintenance: commute.bikeMonthlyMaintenance,
        },
        results: {
          upfrontCost: commute.bikePurchaseCost,
          monthlyCost: bikeMonthlyCost,
          annualCost: bikeAnnualCost,
          estimatedSavings: bikeSavings,
          estimatedEmissions: null,
          paybackPeriodMonths: bikePayback,
          effortLevel: 'moderate' as DifficultyLevel,
          assumptions: [
            'Monthly bicycle maintenance cost is entered by the user.',
            'Rider uses existing road/bike lane network with shower/storage access',
          ],
          limitations: [
            'Adverse winter weather or storms require backup transit preparation',
            'Physical stamina needed; cargo carrying capacity is limited to panniers',
          ],
        },
      };

      const opt3: ComparisonOption = {
        id: 'transit',
        name: 'Public Transit (Bus / Metro)',
        inputs: {
          monthlyPass: commute.transitMonthlyPass,
        },
        results: {
          upfrontCost: 0,
          monthlyCost: transitMonthlyCost,
          annualCost: transitAnnualCost,
          estimatedSavings: transitSavings,
          estimatedEmissions: null,
          paybackPeriodMonths: transitSavings > 0 ? 0 : null,
          effortLevel: 'moderate' as DifficultyLevel,
          assumptions: [
            'Monthly public transit cost is entered by the user.',
          ],
          limitations: [
            'Commute schedule constrained by timetable and intermediate transfer connections',
            'Walking distances between transit stops and final destinations',
          ],
        },
      };

      return [opt1, opt2, opt3];
    }

    if (activeScenarioId === 'containers') {
      const annualUses = containers.usesPerWeek * 52;
      // 1. Disposable (Baseline)
      const dispAnnualCost = annualUses * containers.disposableUnitCost;
      const dispMonthlyCost = dispAnnualCost / 12;

      // 2. Polypropylene / Silicone Reusable
      const polyWashCost = annualUses * containers.washCostPerCycle;
      const polyAmortizedCost = containers.polyContainerCost / containers.polyLifespanYears;
      const polyAnnualCost = polyWashCost + polyAmortizedCost;
      const polyMonthlyCost = polyAnnualCost / 12;
      const polySavings = dispAnnualCost - polyAnnualCost;
      const polyPayback = polySavings > 0
        ? (containers.polyContainerCost / (annualUses * (containers.disposableUnitCost - containers.washCostPerCycle))) * 12
        : null;

      // 3. Stainless Steel / Borosilicate
      const steelWashCost = annualUses * containers.washCostPerCycle;
      const steelAmortizedCost = containers.steelContainerCost / containers.steelLifespanYears;
      const steelAnnualCost = steelWashCost + steelAmortizedCost;
      const steelMonthlyCost = steelAnnualCost / 12;
      const steelSavings = dispAnnualCost - steelAnnualCost;
      const steelPayback = steelSavings > 0
        ? (containers.steelContainerCost / (annualUses * (containers.disposableUnitCost - containers.washCostPerCycle))) * 12
        : null;

      const opt1: ComparisonOption = {
        id: 'disposable',
        name: 'Single-Use Disposables (Baseline)',
        inputs: {
          costPerUnit: containers.disposableUnitCost,
          annualDisposables: annualUses,
        },
        results: {
          upfrontCost: 0,
          monthlyCost: dispMonthlyCost,
          annualCost: dispAnnualCost,
          estimatedSavings: 0,
          estimatedEmissions: null,
          paybackPeriodMonths: null,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            'Disposable item price is entered by the user.',
            'Disposed into general municipal solid waste or single-use paper recycling',
          ],
          limitations: [
            'Continuous stream of non-biodegradable waste to landfill or incinerator',
            'Zero asset equity; 100% recurring operational expenditure',
          ],
        },
      };

      const opt2: ComparisonOption = {
        id: 'polypropylene',
        name: 'Polypropylene Food Box / Cup',
        inputs: {
          containerCost: containers.polyContainerCost,
          lifespanYears: containers.polyLifespanYears,
        },
        results: {
          upfrontCost: containers.polyContainerCost,
          monthlyCost: polyMonthlyCost,
          annualCost: polyAnnualCost,
          estimatedSavings: polySavings,
          estimatedEmissions: null,
          paybackPeriodMonths: polyPayback,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            'Container utilized consistently for ' + containers.polyLifespanYears + ' years (' + (annualUses * containers.polyLifespanYears) + ' uses)',
            'Wash cost is not included because it has not been entered.',
          ],
          limitations: [
            'Lightweight plastic can develop minor discoloration or scratches',
            'Requires habit of rinsing and returning to workplace or backpack',
          ],
        },
      };

      const opt3: ComparisonOption = {
        id: 'stainless',
        name: 'Stainless Steel / Glass Container',
        inputs: {
          containerCost: containers.steelContainerCost,
          lifespanYears: containers.steelLifespanYears,
        },
        results: {
          upfrontCost: containers.steelContainerCost,
          monthlyCost: steelMonthlyCost,
          annualCost: steelAnnualCost,
          estimatedSavings: steelSavings,
          estimatedEmissions: null,
          paybackPeriodMonths: steelPayback,
          effortLevel: 'easy' as DifficultyLevel,
          assumptions: [
            'Durable surgical grade stainless steel or borosilicate body lasts ' + containers.steelLifespanYears + '+ years',
            '100% inert, BPA-free, odor-resistant food-safe surface',
          ],
          limitations: [
            'Heavier tare weight in commute bags compared to plastic or paper',
            'Higher initial retail acquisition price',
          ],
        },
      };

      return [opt1, opt2, opt3];
    }

    // Default: activeScenarioId === 'water'
    const annualShowerMinutes = water.showerMinutesPerDay * 365;

    // 1. Standard (Baseline)
    const stdLitres = annualShowerMinutes * water.standardFlowRate;
    const stdM3 = stdLitres / 1000;
    const stdAnnualCost = stdM3 * water.waterAndHeatingCostPerM3;
    const stdMonthlyCost = stdAnnualCost / 12;

    // 2. Aerated Eco
    const aerLitres = annualShowerMinutes * water.aeratedFlowRate;
    const aerM3 = aerLitres / 1000;
    const aerAnnualCost = aerM3 * water.waterAndHeatingCostPerM3;
    const aerMonthlyCost = aerAnnualCost / 12;
    const aerSavings = stdAnnualCost - aerAnnualCost;
    const aerPayback = aerSavings > 0 ? (water.aeratedFixtureCost / aerSavings) * 12 : null;

    // 3. High-Efficiency Low-Flow
    const hiLitres = annualShowerMinutes * water.highEfficiencyFlowRate;
    const hiM3 = hiLitres / 1000;
    const hiAnnualCost = hiM3 * water.waterAndHeatingCostPerM3;
    const hiMonthlyCost = hiAnnualCost / 12;
    const hiSavings = stdAnnualCost - hiAnnualCost;
    const hiPayback = hiSavings > 0 ? (water.highEfficiencyFixtureCost / hiSavings) * 12 : null;

    const opt1: ComparisonOption = {
      id: 'standard',
      name: 'Standard Fixtures (12 L/min)',
      inputs: {
        flowRate: water.standardFlowRate,
        annualWaterLitres: Math.round(stdLitres),
      },
      results: {
        upfrontCost: 0,
        monthlyCost: stdMonthlyCost,
        annualCost: stdAnnualCost,
        estimatedSavings: 0,
        estimatedEmissions: null,
        paybackPeriodMonths: null,
        effortLevel: 'easy' as DifficultyLevel,
        assumptions: [
          'Conventional non-aerated showerhead flowing at ' + water.standardFlowRate + ' L/min',
          'Combined water and heating tariff is entered by the user.',
        ],
        limitations: [
          'Excessive volume of heated water discharged straight into the drain',
          'High water heater electrical or natural gas demand',
        ],
      },
    };

    const opt2: ComparisonOption = {
      id: 'aerated',
      name: 'Aerated Eco Fixture (7.5 L/min)',
      inputs: {
        flowRate: water.aeratedFlowRate,
        fixtureCost: water.aeratedFixtureCost,
      },
      results: {
        upfrontCost: water.aeratedFixtureCost,
        monthlyCost: aerMonthlyCost,
        annualCost: aerAnnualCost,
        estimatedSavings: aerSavings,
        estimatedEmissions: null,
        paybackPeriodMonths: aerPayback,
        effortLevel: 'easy' as DifficultyLevel,
        assumptions: [
          'Venturi aeration stream mixes ambient air into water flow to preserve jet pressure',
          'Standard 1/2" threaded coupling screws onto existing shower hose in under 5 minutes',
        ],
        limitations: [
          'In poorly heated bathrooms, aerated mist can cool down slightly faster in free air',
        ],
      },
    };

    const opt3: ComparisonOption = {
      id: 'hiefficiency',
      name: 'High-Efficiency Low-Flow (5.5 L/min)',
      inputs: {
        flowRate: water.highEfficiencyFlowRate,
        fixtureCost: water.highEfficiencyFixtureCost,
      },
      results: {
        upfrontCost: water.highEfficiencyFixtureCost,
        monthlyCost: hiMonthlyCost,
        annualCost: hiAnnualCost,
        estimatedSavings: hiSavings,
        estimatedEmissions: null,
        paybackPeriodMonths: hiPayback,
        effortLevel: 'moderate' as DifficultyLevel,
        assumptions: [
          'Micro-orifice pulsing or pressure-compensating aerator delivering 5.5 L/min',
          'Saves over 54% warm water and heating fuel annually',
        ],
        limitations: [
          'Requires minimum mains dynamic water pressure of 1.5 bar for optimal spray pattern',
          'Rinsing dense or heavy hair may take slightly longer',
        ],
      },
    };

    return [opt1, opt2, opt3];
  }, [activeScenarioId, lighting, commute, containers, water, missingInputs]);

  const calculatedOptions = useMemo(
    () => submittedInputSnapshot === inputSnapshot ? computedOptions : [],
    [submittedInputSnapshot, inputSnapshot, computedOptions],
  );

  const personaComparison = useMemo(() => {
    if (calculatedOptions.length < 2) return null;

    const baseline = calculatedOptions[0];
    const alternative = [...calculatedOptions.slice(1)].sort(
      (a, b) => (a.results.annualCost ?? Infinity) - (b.results.annualCost ?? Infinity),
    )[0];
    const baselineFiveYearCost =
      (baseline.results.upfrontCost ?? 0) + (baseline.results.annualCost ?? 0) * 5;
    const alternativeFiveYearCost =
      (alternative.results.upfrontCost ?? 0) + (alternative.results.annualCost ?? 0) * 5;

    let activity: { label: string; baseline: string; alternative: string; change: string; note: string };
    if (activeScenarioId === 'lighting') {
      const annualHours = lighting.hoursPerDay * 365;
      const baselineKwh =
        (lighting.numBulbs * Number(baseline.inputs.wattage) * annualHours) / 1000;
      const alternativeKwh =
        (lighting.numBulbs * Number(alternative.inputs.wattage) * annualHours) / 1000;
      activity = {
        label: 'Modeled electricity use per year',
        baseline: `${baselineKwh.toFixed(1)} kWh`,
        alternative: `${alternativeKwh.toFixed(1)} kWh`,
        change: alternativeKwh < baselineKwh
          ? `${(baselineKwh - alternativeKwh).toFixed(1)} kWh less per year in this model.`
          : alternativeKwh > baselineKwh
          ? `${(alternativeKwh - baselineKwh).toFixed(1)} kWh more per year in this model.`
          : 'No modeled electricity-use difference.',
        note: 'Calculated from your bulb count, wattage, and daily operating hours; emissions are not calculated.',
      };
    } else if (activeScenarioId === 'water') {
      const annualMinutes = water.showerMinutesPerDay * 365;
      const baselineLitres = annualMinutes * Number(baseline.inputs.flowRate);
      const alternativeLitres = annualMinutes * Number(alternative.inputs.flowRate);
      activity = {
        label: 'Modeled shower water use per year',
        baseline: `${Math.round(baselineLitres).toLocaleString()} L`,
        alternative: `${Math.round(alternativeLitres).toLocaleString()} L`,
        change: alternativeLitres < baselineLitres
          ? `${Math.round(baselineLitres - alternativeLitres).toLocaleString()} L less per year in this model.`
          : alternativeLitres > baselineLitres
          ? `${Math.round(alternativeLitres - baselineLitres).toLocaleString()} L more per year in this model.`
          : 'No modeled water-use difference.',
        note: 'Based on your entered shower duration and fixture flow rates; actual use varies with behavior and conditions.',
      };
    } else if (activeScenarioId === 'containers') {
      const annualUses = Number(baseline.inputs.annualDisposables);
      activity = {
        label: 'Single-use items per year',
        baseline: `${annualUses.toLocaleString()} modeled uses`,
        alternative: 'Potentially avoided',
        change: `Up to ${annualUses.toLocaleString()} single-use items avoided per year if the reusable replaces each use.`,
        note: 'Assumes the reusable container replaces one disposable item for each modeled use and is consistently reused.',
      };
    } else {
      const annualDistance = commute.distanceKm * commute.daysPerWeek * 52.14;
      activity = {
        label: 'Commute distance per year',
        baseline: `${annualDistance.toFixed(0)} km`,
        alternative: `${annualDistance.toFixed(0)} km`,
        change: 'The modeled distance stays the same; mode-specific emissions are unavailable.',
        note: 'The model holds trip distance constant; it does not calculate or verify emissions for either travel mode.',
      };
    }

    return {
      baseline,
      alternative,
      baselineFiveYearCost,
      alternativeFiveYearCost,
      fiveYearDifference: baselineFiveYearCost - alternativeFiveYearCost,
      activity,
    };
  }, [calculatedOptions, activeScenarioId, lighting, water, commute]);

  // -------------------------------------------------------------
  // WINNER DETERMINATION
  // -------------------------------------------------------------
  const winner = useMemo(() => {
    if (!calculatedOptions.length) return null;
    // Find option with lowest annual cost
    const sorted = [...calculatedOptions].sort((a, b) => {
      const costA = a.results.annualCost ?? Infinity;
      const costB = b.results.annualCost ?? Infinity;
      return costA - costB;
    });

    const bestOption = sorted[0];
    const baselineOption = calculatedOptions[0];
    const annualSavings = (baselineOption.results.annualCost ?? 0) - (bestOption.results.annualCost ?? 0);

    return {
      option: bestOption,
      annualSavings: Math.max(0, annualSavings),
      baselineName: baselineOption.name,
    };
  }, [calculatedOptions]);

  // -------------------------------------------------------------
  // BAR CHART DATA
  // -------------------------------------------------------------
  const chartData = useMemo(() => {
    return calculatedOptions.map((opt) => ({
      name: opt.name.split(' (')[0], // Cleaner labels for chart axis
      'Annual Cost (₹)': Number((opt.results.annualCost ?? 0).toFixed(2)),
      'Annual Savings (₹)': Number((opt.results.estimatedSavings ?? 0).toFixed(2)),
    }));
  }, [calculatedOptions]);

  // -------------------------------------------------------------
  // SAVE COMPARISON HANDLER
  // -------------------------------------------------------------
  const handleSaveComparison = () => {
    if (!winner) return;

    const newSave: SavedComparisonItem = {
      id: `saved-${Date.now()}`,
      scenarioId: activeScenarioId,
      scenarioTitle: currentScenarioMeta.title,
      winnerName: winner.option.name,
      savedAt: new Date().toLocaleDateString('en-IN'),
      annualSavings: winner.annualSavings,
    };

    setSavedComparisons((prev) => [newSave, ...prev]);
    setToastMessage('Added to this page session only. This comparison is not saved to your workspace.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteSaved = (id: string) => {
    setSavedComparisons((prev) => prev.filter((item) => item.id !== id));
  };

  // Helper formatting currency
  const formatRupees = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return formatINR(val);
  };

  return (
    <div className={styles.page}>
      {/* --- PAGE HEADER --- */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Compare Before You Change</h1>
            <p className={styles.subtitle}>
              Compare alternatives side by side to make informed sustainability decisions.
            </p>
          </div>
          <div className={styles.headerMeta}>
            <div className={styles.workspaceBadge}>
              {!currentWorkspace.id || currentWorkspace.type !== 'business' ? (
                <Home size={13} />
              ) : (
                <Building2 size={13} />
              )}
              {workspacesLoading
                ? 'Loading workspace…'
                : currentWorkspace.id
                ? `Workspace: ${currentWorkspace.name}`
                : workspacesError
                ? 'Workspace connection unavailable'
                : 'No workspace created'}
            </div>
            <div className={styles.demoBadge}>
              <Info size={13} />
              User-entered costs • emissions unavailable
            </div>
          </div>
        </div>
      </header>

      {!currentWorkspace.id && !workspacesLoading && (
        <div className={styles.demoDisclaimerBanner} role={workspacesError ? 'alert' : 'status'}>
          <Info size={16} />
          <span>
            {workspacesError
              ? `Could not load live workspaces. Open the workspace selector in the sidebar to retry. ${workspacesError}`
              : 'Create a workspace from the left sidebar to use features that save live data. Comparisons can still be calculated here, but are kept only for this page session.'}
          </span>
        </div>
      )}

      {/* --- TOAST CONFIRMATION --- */}
      {toastMessage && (
        <div className={styles.toastSuccess} role="status">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --- SCENARIO SELECTOR (4 TABS/CARDS) --- */}
      <section className={styles.scenarioSection} aria-label="Select comparison scenario">
        <div className={styles.sectionLabel}>
          <Layers size={13} />
          Select a Pre-Built Scenario
        </div>
        <div className={styles.scenarioGrid} role="tablist">
          {SCENARIOS.map((sc) => {
            const IconComponent = sc.icon;
            const isActive = sc.id === activeScenarioId;
            return (
              <button
                key={sc.id}
                role="tab"
                aria-selected={isActive}
                className={`${styles.scenarioCard} ${isActive ? styles.scenarioCardActive : ''}`}
                onClick={() => setActiveScenarioId(sc.id)}
              >
                <div className={styles.scenarioIconRow}>
                  <div className={styles.scenarioIconBox}>
                    <IconComponent size={18} />
                  </div>
                  <span className={styles.scenarioCategoryTag}>{sc.categoryLabel}</span>
                </div>
                <div className={styles.scenarioTitle}>{sc.title}</div>
                <p className={styles.scenarioSubtitle}>{sc.subtitle}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* --- WINNER HIGHLIGHT --- */}
      {winner && (
        <section className={styles.winnerBanner} aria-label="Recommendation outcome">
          <div className={styles.winnerIconBox}>
            <Award size={22} />
          </div>
          <div className={styles.winnerContent}>
            <div className={styles.winnerHeader}>
              <span className={styles.winnerBadge}>Lowest Annual Cost Option:</span>
              <span className={styles.winnerName}>{winner.option.name}</span>
            </div>
            <div className={styles.winnerSummary}>
              Projected annual cost of <strong>{formatRupees(winner.option.results.annualCost)}</strong> (monthly{' '}
              {formatRupees(winner.option.results.monthlyCost)}
              {winner.annualSavings > 0
                ? `, saving an estimated ${formatRupees(winner.annualSavings)} / year vs ${winner.baselineName}`
                : ', baseline option'}
              ).
            </div>
            <div className={styles.winnerNote}>
              The best choice depends on your specific circumstances.
            </div>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSaveComparison}
            title="Keep this comparison in the current page session only"
          >
            <BookmarkCheck size={16} />
            Keep for This Session
          </button>
        </section>
      )}

      {/* --- SCENARIO CONTROLS BAR (Shared Inputs) --- */}
      <section className={styles.controlsBar} aria-label="Scenario configuration parameters">
        <div className={styles.controlsBarHeader}>
          <div className={styles.controlsTitle}>
            <Scale size={16} />
            <span>Scenario Parameters ({currentScenarioMeta.shortTitle})</span>
          </div>
          <div className={styles.controlsActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleResetCurrentScenario}
              title="Clear this scenario's user-entered inputs"
            >
              <RotateCcw size={13} />
              Clear Inputs
            </button>
          </div>
        </div>

        {/* Dynamic Shared Inputs by Scenario */}
        <div className={styles.sharedInputsGrid}>
          {activeScenarioId === 'lighting' && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="numBulbs" className={styles.inputLabel}>
                  Number of Bulbs <span className={styles.inputUnit}>(fixtures)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="numBulbs"
                    type="number"
                    min={0}
                    max={150}
                    step={1}
                    className={styles.inputField}
                    value={lighting.numBulbs}
                    onChange={(e) =>
                      setLighting({ ...lighting, numBulbs: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  <span className={styles.inputSuffix}>bulbs</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="hoursPerDay" className={styles.inputLabel}>
                  Operating Hours <span className={styles.inputUnit}>(daily)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="hoursPerDay"
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    className={styles.inputField}
                    value={lighting.hoursPerDay}
                    onChange={(e) =>
                      setLighting({
                        ...lighting,
                        hoursPerDay: Math.max(0, Math.min(24, Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <span className={styles.inputSuffix}>hrs/day</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="pricePerKwh" className={styles.inputLabel}>
                  Electricity Tariff <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="pricePerKwh"
                    type="number"
                    min={0}
                    step={0.01}
                    className={styles.inputField}
                    value={lighting.pricePerKwh}
                    onChange={(e) => {
                      recordCostInput('pricePerKwh');
                      setLighting({
                        ...lighting,
                        pricePerKwh: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / kWh</span>
                </div>
              </div>
              {([
                ['incandescentBulbPrice', 'Incandescent bulb price', lighting.incandescentBulbPrice],
                ['cflBulbPrice', 'CFL bulb price', lighting.cflBulbPrice],
                ['ledBulbPrice', 'LED bulb price', lighting.ledBulbPrice],
              ] as const).map(([id, label, value]) => (
                <div className={styles.inputGroup} key={id}>
                  <label htmlFor={id} className={styles.inputLabel}>
                    {label} <span className={styles.inputUnit}>(INR each)</span>
                  </label>
                  <div className={styles.inputFieldWrapper}>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      step={0.5}
                      className={styles.inputField}
                      value={value}
                      onChange={(e) => {
                        recordCostInput(id);
                        setLighting({
                          ...lighting,
                          [id]: Math.max(0, Number(e.target.value) || 0),
                        });
                      }}
                    />
                    <span className={styles.inputSuffix}>₹ / bulb</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeScenarioId === 'commute' && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="distanceKm" className={styles.inputLabel}>
                  Round-Trip Distance <span className={styles.inputUnit}>(km)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="distanceKm"
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    className={styles.inputField}
                    value={commute.distanceKm}
                    onChange={(e) =>
                      setCommute({ ...commute, distanceKm: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  <span className={styles.inputSuffix}>km / day</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="daysPerWeek" className={styles.inputLabel}>
                  Commute Days <span className={styles.inputUnit}>(per week)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="daysPerWeek"
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    className={styles.inputField}
                    value={commute.daysPerWeek}
                    onChange={(e) =>
                      setCommute({
                        ...commute,
                        daysPerWeek: Math.max(0, Math.min(7, Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <span className={styles.inputSuffix}>days / wk</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="carCostPerKm" className={styles.inputLabel}>
                  Car Variable Cost <span className={styles.inputUnit}>(fuel + wear)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="carCostPerKm"
                    type="number"
                    min={0}
                    step={0.02}
                    className={styles.inputField}
                    value={commute.carCostPerKm}
                    onChange={(e) => {
                      recordCostInput('carCostPerKm');
                      setCommute({
                        ...commute,
                        carCostPerKm: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / km</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="transitMonthlyPass" className={styles.inputLabel}>
                  Monthly Transit Pass <span className={styles.inputUnit}>(bus/metro)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="transitMonthlyPass"
                    type="number"
                    min={0}
                    step={5}
                    className={styles.inputField}
                    value={commute.transitMonthlyPass}
                    onChange={(e) => {
                      recordCostInput('transitMonthlyPass');
                      setCommute({
                        ...commute,
                        transitMonthlyPass: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / month</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="bikePurchaseCost" className={styles.inputLabel}>
                  Bicycle Purchase Cost <span className={styles.inputUnit}>(one-time)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="bikePurchaseCost"
                    type="number"
                    min={0}
                    step={50}
                    className={styles.inputField}
                    value={commute.bikePurchaseCost}
                    onChange={(e) => {
                      recordCostInput('bikePurchaseCost');
                      setCommute({
                        ...commute,
                        bikePurchaseCost: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="bikeMonthlyMaintenance" className={styles.inputLabel}>
                  Bicycle Monthly Upkeep
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="bikeMonthlyMaintenance"
                    type="number"
                    min={0}
                    step={2}
                    className={styles.inputField}
                    value={commute.bikeMonthlyMaintenance}
                    onChange={(e) => {
                      recordCostInput('bikeMonthlyMaintenance');
                      setCommute({
                        ...commute,
                        bikeMonthlyMaintenance: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / month</span>
                </div>
              </div>
            </>
          )}

          {activeScenarioId === 'containers' && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="usesPerWeek" className={styles.inputLabel}>
                  Container Uses <span className={styles.inputUnit}>(weekly)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="usesPerWeek"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    className={styles.inputField}
                    value={containers.usesPerWeek}
                    onChange={(e) =>
                      setContainers({
                        ...containers,
                        usesPerWeek: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <span className={styles.inputSuffix}>uses / wk</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="disposableUnitCost" className={styles.inputLabel}>
                  Disposable Unit Price <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="disposableUnitCost"
                    type="number"
                    min={0}
                    step={0.05}
                    className={styles.inputField}
                    value={containers.disposableUnitCost}
                    onChange={(e) => {
                      recordCostInput('disposableUnitCost');
                      setContainers({
                        ...containers,
                        disposableUnitCost: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / unit</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="washCostPerCycle" className={styles.inputLabel}>
                  Dishwasher Wash Cost <span className={styles.inputUnit}>(hot water + soap)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="washCostPerCycle"
                    type="number"
                    min={0}
                    step={0.005}
                    className={styles.inputField}
                    value={containers.washCostPerCycle}
                    onChange={(e) => {
                      recordCostInput('washCostPerCycle');
                      setContainers({
                        ...containers,
                        washCostPerCycle: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / wash</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="polyContainerCost" className={styles.inputLabel}>
                  Reusable Container Cost <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="polyContainerCost"
                    type="number"
                    min={0}
                    step={5}
                    className={styles.inputField}
                    value={containers.polyContainerCost}
                    onChange={(e) => {
                      recordCostInput('polyContainerCost');
                      setContainers({
                        ...containers,
                        polyContainerCost: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="steelContainerCost" className={styles.inputLabel}>
                  Durable Container Cost <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="steelContainerCost"
                    type="number"
                    min={0}
                    step={5}
                    className={styles.inputField}
                    value={containers.steelContainerCost}
                    onChange={(e) => {
                      recordCostInput('steelContainerCost');
                      setContainers({
                        ...containers,
                        steelContainerCost: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹</span>
                </div>
              </div>
            </>
          )}

          {activeScenarioId === 'water' && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="showerMinutesPerDay" className={styles.inputLabel}>
                  Total Shower Duration <span className={styles.inputUnit}>(household daily)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="showerMinutesPerDay"
                    type="number"
                    min={0}
                    max={120}
                    step={2}
                    className={styles.inputField}
                    value={water.showerMinutesPerDay}
                    onChange={(e) =>
                      setWater({
                        ...water,
                        showerMinutesPerDay: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <span className={styles.inputSuffix}>min / day</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="waterAndHeatingCostPerM3" className={styles.inputLabel}>
                  Combined Water & Heating Tariff <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="waterAndHeatingCostPerM3"
                    type="number"
                    min={0}
                    step={0.5}
                    className={styles.inputField}
                    value={water.waterAndHeatingCostPerM3}
                    onChange={(e) => {
                      recordCostInput('waterAndHeatingCostPerM3');
                      setWater({
                        ...water,
                        waterAndHeatingCostPerM3: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹ / m³</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="aeratedFixtureCost" className={styles.inputLabel}>
                  Aerated Fixture Cost <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="aeratedFixtureCost"
                    type="number"
                    min={0}
                    step={5}
                    className={styles.inputField}
                    value={water.aeratedFixtureCost}
                    onChange={(e) => {
                      recordCostInput('aeratedFixtureCost');
                      setWater({
                        ...water,
                        aeratedFixtureCost: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹</span>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="highEfficiencyFixtureCost" className={styles.inputLabel}>
                  High-Efficiency Fixture Cost <span className={styles.inputUnit}>(INR)</span>
                </label>
                <div className={styles.inputFieldWrapper}>
                  <input
                    id="highEfficiencyFixtureCost"
                    type="number"
                    min={0}
                    step={5}
                    className={styles.inputField}
                    value={water.highEfficiencyFixtureCost}
                    onChange={(e) => {
                      recordCostInput('highEfficiencyFixtureCost');
                      setWater({
                        ...water,
                        highEfficiencyFixtureCost: Math.max(0, Number(e.target.value) || 0),
                      });
                    }}
                  />
                  <span className={styles.inputSuffix}>₹</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {!calculatedOptions.length && (
        <div className={styles.demoDisclaimerBanner} role="status">
          <Info size={16} />
          <span>
            {missingInputs.length > 0
              ? <>To calculate this comparison, enter: {missingInputs.join(', ')}.</>
              : 'Your inputs are ready. Select Submit to Compare to calculate results.'}{' '}
            Blank values are not estimated, and emissions are withheld because validated India-specific factors are not configured.
          </span>
        </div>
      )}

      <div className={styles.comparisonSubmitRow}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setSubmittedInputSnapshot(inputSnapshot)}
          disabled={missingInputs.length > 0}
        >
          <Calculator size={16} />
          Submit to Compare
        </button>
      </div>

      {/* --- COMPARISON BUILDER: 3 COLUMNS --- */}
      <section
        className={`${styles.comparisonColumns} ${
          calculatedOptions.length === 2 ? styles.comparisonColumnTwo : ''
        }`}
        aria-label="Comparison columns for selected scenario"
      >
        {calculatedOptions.map((option, index) => {
          const isWinner = winner?.option.id === option.id;
          const isBaseline = index === 0;
          const notesOpen = !!expandedNotes[option.id];

          return (
            <article
              key={option.id}
              className={`${styles.optionCard} ${isWinner ? styles.optionCardWinner : ''} ${
                isBaseline ? styles.optionCardBaseline : ''
              }`}
            >
              {/* Option Header */}
              <div className={styles.optionHeader}>
                <div className={styles.optionBadgeRow}>
                  {isBaseline ? (
                    <span className={styles.baselinePill}>Current Baseline</span>
                  ) : isWinner ? (
                    <span className={styles.winnerPill}>
                      <Sparkles size={11} />
                      Lowest Annual Cost
                    </span>
                  ) : (
                    <span className={styles.baselinePill}>Alternative {index}</span>
                  )}
                  <span
                    className={`${styles.effortBadge} ${
                      option.results.effortLevel === 'easy'
                        ? styles.effortEasy
                        : option.results.effortLevel === 'moderate'
                        ? styles.effortModerate
                        : styles.effortChallenging
                    }`}
                  >
                    Effort: {option.results.effortLevel}
                  </span>
                </div>
                <h2 className={styles.optionTitle}>{option.name}</h2>
              </div>

              {/* Main Cost Callout */}
              <div className={styles.optionCostCallout}>
                <div className={styles.costAmount}>
                  {formatRupees(option.results.annualCost)}
                  <span className={styles.costPeriod}>/ year</span>
                </div>
                {isBaseline ? (
                  <div className={styles.neutralCallout}>Standard baseline expenditure</div>
                ) : (option.results.estimatedSavings ?? 0) > 0 ? (
                  <div className={styles.savingsCallout}>
                    <TrendingDown size={14} />
                    Saves {formatRupees(option.results.estimatedSavings)} / year vs baseline
                  </div>
                ) : (
                  <div className={styles.neutralCallout}>
                    Net cost difference: {formatRupees(option.results.estimatedSavings)} / yr
                  </div>
                )}
              </div>

              {/* Editable Option Inputs */}
              <div className={styles.optionInputsSection}>
                <div className={styles.optionInputsTitle}>Option Variables</div>
                <div className={styles.optionInputsList}>
                  {activeScenarioId === 'lighting' && (
                    <>
                      {option.id === 'incandescent' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Bulb Rating <span className={styles.inputUnit}>(Watts)</span>
                            </label>
                            <input
                              type="number"
                              min={25}
                              max={150}
                              className={styles.inputField}
                              value={lighting.incandescentWatts}
                              onChange={(e) =>
                                setLighting({
                                  ...lighting,
                                  incandescentWatts: Number(e.target.value) || 60,
                                })
                              }
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Bulb Purchase Price <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.2}
                              className={styles.inputField}
                              value={lighting.incandescentBulbPrice}
                              onChange={(e) => {
                                recordCostInput('incandescentBulbPrice');
                                setLighting({
                                  ...lighting,
                                  incandescentBulbPrice: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                      {option.id === 'cfl' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Bulb Rating <span className={styles.inputUnit}>(Watts)</span>
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={30}
                              className={styles.inputField}
                              value={lighting.cflWatts}
                              onChange={(e) =>
                                setLighting({
                                  ...lighting,
                                  cflWatts: Number(e.target.value) || 14,
                                })
                              }
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Bulb Purchase Price <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              className={styles.inputField}
                              value={lighting.cflBulbPrice}
                              onChange={(e) => {
                                recordCostInput('cflBulbPrice');
                                setLighting({
                                  ...lighting,
                                  cflBulbPrice: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                      {option.id === 'led' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Bulb Rating <span className={styles.inputUnit}>(Watts)</span>
                            </label>
                            <input
                              type="number"
                              min={3}
                              max={25}
                              className={styles.inputField}
                              value={lighting.ledWatts}
                              onChange={(e) =>
                                setLighting({
                                  ...lighting,
                                  ledWatts: Number(e.target.value) || 9,
                                })
                              }
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Bulb Purchase Price <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              className={styles.inputField}
                              value={lighting.ledBulbPrice}
                              onChange={(e) => {
                                recordCostInput('ledBulbPrice');
                                setLighting({
                                  ...lighting,
                                  ledBulbPrice: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {activeScenarioId === 'commute' && (
                    <>
                      {option.id === 'car' && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>
                            Fuel + Maintenance <span className={styles.inputUnit}>(₹/km)</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.02}
                            className={styles.inputField}
                            value={commute.carCostPerKm}
                            onChange={(e) => {
                              recordCostInput('carCostPerKm');
                              setCommute({
                                ...commute,
                                carCostPerKm: Number(e.target.value) || 0,
                              });
                            }}
                          />
                        </div>
                      )}
                      {option.id === 'cycling' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Upfront Bike Purchase <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={50}
                              className={styles.inputField}
                              value={commute.bikePurchaseCost}
                              onChange={(e) => {
                                recordCostInput('bikePurchaseCost');
                                setCommute({
                                  ...commute,
                                  bikePurchaseCost: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Monthly Upkeep <span className={styles.inputUnit}>(₹/mo)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={2}
                              className={styles.inputField}
                              value={commute.bikeMonthlyMaintenance}
                              onChange={(e) => {
                                recordCostInput('bikeMonthlyMaintenance');
                                setCommute({
                                  ...commute,
                                  bikeMonthlyMaintenance: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                      {option.id === 'transit' && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>
                            Monthly Transit Pass <span className={styles.inputUnit}>(INR)</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            className={styles.inputField}
                            value={commute.transitMonthlyPass}
                            onChange={(e) => {
                              recordCostInput('transitMonthlyPass');
                              setCommute({
                                ...commute,
                                transitMonthlyPass: Number(e.target.value) || 0,
                              });
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {activeScenarioId === 'containers' && (
                    <>
                      {option.id === 'disposable' && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>
                            Cost Per Single-Use <span className={styles.inputUnit}>(INR)</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.05}
                            className={styles.inputField}
                            value={containers.disposableUnitCost}
                            onChange={(e) => {
                              recordCostInput('disposableUnitCost');
                              setContainers({
                                ...containers,
                                disposableUnitCost: Number(e.target.value) || 0,
                              });
                            }}
                          />
                        </div>
                      )}
                      {option.id === 'polypropylene' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Container Price <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={3}
                              step={1}
                              className={styles.inputField}
                              value={containers.polyContainerCost}
                              onChange={(e) => {
                                recordCostInput('polyContainerCost');
                                setContainers({
                                  ...containers,
                                  polyContainerCost: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Expected Life <span className={styles.inputUnit}>(years)</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              step={1}
                              className={styles.inputField}
                              value={containers.polyLifespanYears}
                              onChange={(e) =>
                                setContainers({
                                  ...containers,
                                  polyLifespanYears: Number(e.target.value) || 2,
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                      {option.id === 'stainless' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Container Price <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={10}
                              step={2}
                              className={styles.inputField}
                              value={containers.steelContainerCost}
                              onChange={(e) => {
                                recordCostInput('steelContainerCost');
                                setContainers({
                                  ...containers,
                                  steelContainerCost: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Expected Life <span className={styles.inputUnit}>(years)</span>
                            </label>
                            <input
                              type="number"
                              min={2}
                              step={1}
                              className={styles.inputField}
                              value={containers.steelLifespanYears}
                              onChange={(e) =>
                                setContainers({
                                  ...containers,
                                  steelLifespanYears: Number(e.target.value) || 5,
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {activeScenarioId === 'water' && (
                    <>
                      {option.id === 'standard' && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>
                            Standard Flow Rate <span className={styles.inputUnit}>(L/min)</span>
                          </label>
                          <input
                            type="number"
                            min={8}
                            max={22}
                            step={0.5}
                            className={styles.inputField}
                            value={water.standardFlowRate}
                            onChange={(e) =>
                              setWater({
                                ...water,
                                standardFlowRate: Number(e.target.value) || 12,
                              })
                            }
                          />
                        </div>
                      )}
                      {option.id === 'aerated' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Aerated Flow Rate <span className={styles.inputUnit}>(L/min)</span>
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={10}
                              step={0.5}
                              className={styles.inputField}
                              value={water.aeratedFlowRate}
                              onChange={(e) =>
                                setWater({
                                  ...water,
                                  aeratedFlowRate: Number(e.target.value) || 7.5,
                                })
                              }
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Fixture Hardware Cost <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={2}
                              className={styles.inputField}
                              value={water.aeratedFixtureCost}
                              onChange={(e) => {
                                recordCostInput('aeratedFixtureCost');
                                setWater({
                                  ...water,
                                  aeratedFixtureCost: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                      {option.id === 'hiefficiency' && (
                        <>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Low-Flow Rate <span className={styles.inputUnit}>(L/min)</span>
                            </label>
                            <input
                              type="number"
                              min={3}
                              max={7}
                              step={0.5}
                              className={styles.inputField}
                              value={water.highEfficiencyFlowRate}
                              onChange={(e) =>
                                setWater({
                                  ...water,
                                  highEfficiencyFlowRate: Number(e.target.value) || 5.5,
                                })
                              }
                            />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                              Fixture Hardware Cost <span className={styles.inputUnit}>(INR)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={5}
                              className={styles.inputField}
                              value={water.highEfficiencyFixtureCost}
                              onChange={(e) => {
                                recordCostInput('highEfficiencyFixtureCost');
                                setWater({
                                  ...water,
                                  highEfficiencyFixtureCost: Number(e.target.value) || 0,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Metrics Breakdown */}
              <div className={styles.optionMetricsList}>
                <div className={styles.metricRow}>
                  <span className={styles.metricName}>Monthly Operating Cost</span>
                  <span className={styles.metricVal}>{formatRupees(option.results.monthlyCost)}</span>
                </div>
                <div className={styles.metricRow}>
                  <span className={styles.metricName}>Upfront Initial Outlay</span>
                  <span className={styles.metricVal}>
                    {option.results.upfrontCost ? formatRupees(option.results.upfrontCost) : '₹0.00'}
                  </span>
                </div>
                <div className={styles.metricRow}>
                  <span className={styles.metricName}>Emissions</span>
                  <span className={styles.metricVal}>
                    {'Unavailable: no validated India-specific factor'}
                  </span>
                </div>
                <div className={styles.metricRow}>
                  <span className={styles.metricName}>Payback Period</span>
                  <span className={styles.metricVal}>
                    {isBaseline
                      ? 'N/A (Baseline)'
                      : option.results.paybackPeriodMonths === 0
                      ? 'Immediate'
                      : option.results.paybackPeriodMonths
                      ? `${option.results.paybackPeriodMonths.toFixed(1)} months`
                      : 'No financial payback'}
                  </span>
                </div>
              </div>

              {/* Assumptions & Limitations Drawer */}
              <div className={styles.optionNotesSection}>
                <button
                  type="button"
                  className={styles.noteAccordionHeader}
                  onClick={() => toggleNotes(option.id)}
                  aria-expanded={notesOpen}
                >
                  <span>Assumptions &amp; Limitations</span>
                  {notesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {notesOpen && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Key Assumptions:
                    </div>
                    <ul className={styles.noteList}>
                      {option.results.assumptions.map((item, i) => (
                        <li key={i} className={styles.noteListItem}>
                          {item}
                        </li>
                      ))}
                    </ul>

                    <div
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        marginTop: 'var(--space-2)',
                      }}
                    >
                      Known Limitations:
                    </div>
                    <ul className={styles.noteList}>
                      {option.results.limitations.map((item, i) => (
                        <li key={i} className={styles.noteListItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* --- RESULTS SECTION: BARCHART & DETAILED TABLE --- */}
      {calculatedOptions.length > 0 && (
      <section className={styles.resultsSection} aria-label="Comparative results visual and tabular breakdown">
        <div className={styles.resultsHeader}>
          <h2 className={styles.resultsTitle}>Detailed Results Comparison</h2>
          <div className={styles.chartTabs} role="tablist">
            <button
              type="button"
              className={`${styles.chartTab} ${chartMetric === 'annualCost' ? styles.chartTabActive : ''}`}
              onClick={() => setChartMetric('annualCost')}
            >
              Annual Cost (₹)
            </button>
            <button
              type="button"
              className={`${styles.chartTab} ${chartMetric === 'savings' ? styles.chartTabActive : ''}`}
              onClick={() => setChartMetric('savings')}
            >
              Annual Savings (₹)
            </button>
          </div>
        </div>

        {/* Bar Chart */}
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--color-text-tertiary)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="var(--color-text-tertiary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className={styles.chartTooltip}>
                        <div className={styles.chartTooltipTitle}>{label}</div>
                        {payload.map((entry) => (
                          <div key={String(entry.name)} className={styles.chartTooltipRow}>
                            <span>{entry.name}:</span>
                            <strong>
                              {typeof entry.value === 'number'
                                ? String(entry.name ?? '').includes('₹')
                                  ? formatINR(entry.value)
                                  : `${entry.value.toFixed(1)} kg`
                                : entry.value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                iconType="circle"
              />

              {chartMetric === 'annualCost' && (
                <Bar
                  dataKey="Annual Cost (₹)"
                  fill="var(--color-primary-600)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              )}
              {chartMetric === 'savings' && (
                <Bar
                  dataKey="Annual Savings (₹)"
                  fill="var(--color-accent-lime)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Comparison Table */}
        <div className={styles.tableContainer}>
          <table className={styles.detailTable}>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Metric / Parameter</th>
                {calculatedOptions.map((opt, i) => (
                  <th key={opt.id} style={{ width: `${72 / calculatedOptions.length}%` }}>
                    {opt.name} {i === 0 ? '(Baseline)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.tableMetricLabel}>Upfront Initial Outlay</td>
                {calculatedOptions.map((opt) => (
                  <td key={opt.id}>
                    {opt.results.upfrontCost ? formatRupees(opt.results.upfrontCost) : '₹0.00'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>Monthly Operating Cost</td>
                {calculatedOptions.map((opt) => (
                  <td key={opt.id}>{formatRupees(opt.results.monthlyCost)} / mo</td>
                ))}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>Annual Cost</td>
                {calculatedOptions.map((opt) => (
                  <td key={opt.id} className={styles.tableHighlightCell}>
                    {formatRupees(opt.results.annualCost)} / yr
                  </td>
                ))}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>Estimated Annual Savings vs Baseline</td>
                {calculatedOptions.map((opt, i) => (
                  <td key={opt.id} style={{ color: i === 0 ? 'inherit' : 'var(--color-success)', fontWeight: 600 }}>
                    {i === 0 ? '— (Baseline)' : `+${formatRupees(opt.results.estimatedSavings)} / yr`}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>5-Year Total Cost (Upfront + Operations)</td>
                {calculatedOptions.map((opt) => {
                  const fiveYearTotal =
                    (opt.results.upfrontCost ?? 0) + (opt.results.annualCost ?? 0) * 5;
                  return <td key={opt.id}>{formatRupees(fiveYearTotal)}</td>;
                })}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>Annual Emissions Assessment</td>
                {calculatedOptions.map((opt) => (
                  <td key={opt.id}>
                    Unavailable: no validated India-specific factor
                  </td>
                ))}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>Payback Period</td>
                {calculatedOptions.map((opt, i) => (
                  <td key={opt.id}>
                    {i === 0
                      ? 'N/A (Baseline)'
                      : opt.results.paybackPeriodMonths === 0
                      ? 'Immediate'
                      : opt.results.paybackPeriodMonths
                      ? `${opt.results.paybackPeriodMonths.toFixed(1)} months`
                      : 'None'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={styles.tableMetricLabel}>Implementation Effort</td>
                {calculatedOptions.map((opt) => (
                  <td key={opt.id}>
                    <span
                      className={`${styles.effortBadge} ${
                        opt.results.effortLevel === 'easy'
                          ? styles.effortEasy
                          : opt.results.effortLevel === 'moderate'
                          ? styles.effortModerate
                          : styles.effortChallenging
                      }`}
                    >
                      {opt.results.effortLevel}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      )}

      {personaComparison && (
        <section className={styles.personaSection} aria-labelledby="persona-comparison-heading">
          <div className={styles.personaHeading}>
            <div>
              <span className={styles.personaEyebrow}>See the everyday difference</span>
              <h2 id="persona-comparison-heading">Two routines. Your scenario. Side by side.</h2>
              <p>
                An illustrative comparison using your submitted inputs—not personal data or a prediction about any individual.
              </p>
            </div>
            <span className={styles.personaScenarioTag}>{currentScenarioMeta.shortTitle}</span>
          </div>

          <div className={styles.personaGrid}>
            <article className={`${styles.personaCard} ${styles.personaBaseline}`}>
              <div className={styles.personaCardHeading}>
                <span className={styles.personaIcon}><Home size={18} /></span>
                <div>
                  <span className={styles.personaLabel}>Persona 1</span>
                  <h3>Conventional routine</h3>
                </div>
              </div>
              <p className={styles.personaChoice}>{personaComparison.baseline.name}</p>
              <div className={styles.personaStats}>
                <div>
                  <span>Annual operating cost</span>
                  <strong>{formatRupees(personaComparison.baseline.results.annualCost)}</strong>
                </div>
                <div>
                  <span>One-time cost</span>
                  <strong>{formatRupees(personaComparison.baseline.results.upfrontCost ?? 0)}</strong>
                </div>
                <div>
                  <span>Projected 5-year cost</span>
                  <strong>{formatRupees(personaComparison.baselineFiveYearCost)}</strong>
                </div>
              </div>
              <div className={styles.personaActivity}>
                <span>{personaComparison.activity.label}</span>
                <strong>{personaComparison.activity.baseline}</strong>
              </div>
            </article>

            <article className={`${styles.personaCard} ${styles.personaSustainable}`}>
              <div className={styles.personaCardHeading}>
                <span className={styles.personaIcon}><Leaf size={18} /></span>
                <div>
                  <span className={styles.personaLabel}>Persona 2</span>
                  <h3>Sustainability-minded routine</h3>
                </div>
              </div>
              <p className={styles.personaChoice}>
                Lowest annual operating-cost alternative: {personaComparison.alternative.name}
              </p>
              <div className={styles.personaStats}>
                <div>
                  <span>Annual operating cost</span>
                  <strong>{formatRupees(personaComparison.alternative.results.annualCost)}</strong>
                </div>
                <div>
                  <span>One-time cost</span>
                  <strong>{formatRupees(personaComparison.alternative.results.upfrontCost ?? 0)}</strong>
                </div>
                <div>
                  <span>Projected 5-year cost</span>
                  <strong>{formatRupees(personaComparison.alternativeFiveYearCost)}</strong>
                </div>
              </div>
              <div className={styles.personaActivity}>
                <span>{personaComparison.activity.label}</span>
                <strong>{personaComparison.activity.alternative}</strong>
              </div>
            </article>
          </div>

          <div className={styles.personaTakeaway} role="note">
            <TrendingDown size={18} />
            <p>
              {personaComparison.fiveYearDifference > 0
                ? <>In this model, the sustainability-minded option costs <strong>{formatRupees(personaComparison.fiveYearDifference)} less</strong> over five years.</>
                : personaComparison.fiveYearDifference < 0
                ? <>In this model, the sustainability-minded option costs <strong>{formatRupees(Math.abs(personaComparison.fiveYearDifference))} more</strong> over five years.</>
                : <>In this model, both routines have the same projected five-year cost.</>}
              {' '} {personaComparison.activity.change} {personaComparison.activity.note}
            </p>
          </div>
          <p className={styles.personaDisclaimer}>
            The alternative is selected from the options shown above. This comparison reports modeled cost and scenario-specific activity only; it does not claim verified carbon or overall environmental savings.
          </p>
        </section>
      )}

      {winner && (
        <KnowledgeGuidance
          title={`Knowledge-base guidance for ${currentScenarioMeta.shortTitle}`}
          categories={[currentScenarioMeta.category]}
          contextSummary={
            `${winner.option.name} has the lowest projected annual cost (${formatRupees(winner.option.results.annualCost)}) ` +
            `for the submitted inputs. This is a cost comparison only; environmental emissions are not calculated. ` +
            'Review the scenario assumptions and local conditions before acting.'
          }
          limit={2}
        />
      )}

      {/* --- CALCULATION TRANSPARENCY SECTION --- */}
      <section className={styles.transparencyCard} aria-label="Calculation transparency and verification">
        <button
          type="button"
          className={styles.transparencyToggle}
          onClick={() => setTransparencyOpen(!transparencyOpen)}
          aria-expanded={transparencyOpen}
        >
          <div className={styles.transparencyTitleGroup}>
            <Calculator size={20} className={styles.transparencyIcon} />
            <div>
              <h3 className={styles.transparencyTitle}>Calculation Transparency &amp; Methodology</h3>
              <p className={styles.transparencySubtitle}>
                Formulas, units, empirical assumptions, and emission factor references
              </p>
            </div>
          </div>
          {transparencyOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {transparencyOpen && (
          <div className={styles.transparencyBody}>
            {/* Disclaimer banner */}
            <div className={styles.demoDisclaimerBanner}>
              <Info size={16} />
              <span>
                Cost results use only the values you enter. Environmental emissions are withheld because
                validated India-specific factors are not configured.
              </span>
            </div>

            {/* Formula box */}
            <div>
              <div className={styles.transparencyBlockTitle}>
                <Calculator size={13} />
                Formula Used
              </div>
              <div className={styles.formulaBox}>{currentScenarioMeta.formulaCode}</div>
            </div>

            {/* Grid of details */}
            <div className={styles.transparencyGrid}>
              <div className={styles.transparencyBlock}>
                <div className={styles.transparencyBlockTitle}>Input Units &amp; Conventions</div>
                <ul className={styles.transparencyList}>
                  <li className={styles.transparencyListItem}>
                    <strong>Cost Units:</strong> Indian rupee (₹ / INR)
                  </li>
                  <li className={styles.transparencyListItem}>
                    <strong>Annual Horizon:</strong> Standard 365 calendar days (52.14 weeks)
                  </li>
                  <li className={styles.transparencyListItem}>
                    <strong>Monthly Conventions:</strong> Commute months are estimated as 4.333 weeks.
                  </li>
                  <li className={styles.transparencyListItem}>
                    <strong>Emissions:</strong> Withheld until validated India-specific factors are configured.
                  </li>
                </ul>
              </div>

              <div className={styles.transparencyBlock}>
                <div className={styles.transparencyBlockTitle}>Emission Factor &amp; Primary Source</div>
                <ul className={styles.transparencyList}>
                  <li className={styles.transparencyListItem}>
                    <strong>Factor:</strong> {currentScenarioMeta.emissionFactorText}
                  </li>
                  <li className={styles.transparencyListItem}>
                    <strong>Source:</strong> {currentScenarioMeta.emissionSource}
                  </li>
                  <li className={styles.transparencyListItem}>
                    <strong>Verification:</strong> No environmental factor is used or presented as a measured result.
                  </li>
                </ul>
              </div>
            </div>

            {/* Global assumptions */}
            <div className={styles.transparencyBlock}>
              <div className={styles.transparencyBlockTitle}>Scenario Modeling Assumptions</div>
              <ul className={styles.transparencyList}>
                {currentScenarioMeta.sharedAssumptions.map((assump, i) => (
                  <li key={i} className={styles.transparencyListItem}>
                    {assump}
                  </li>
                ))}
              </ul>
            </div>

            {/* Limitations */}
            <div className={styles.transparencyBlock}>
              <div className={styles.transparencyBlockTitle}>Methodology Limitations</div>
              <ul className={styles.transparencyList}>
                {currentScenarioMeta.sharedLimitations.map((lim, i) => (
                  <li key={i} className={styles.transparencyListItem}>
                    {lim}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* --- SAVED COMPARISONS LOG --- */}
      {savedComparisons.length > 0 && (
        <section className={styles.savedSection} aria-label="Saved comparisons in current session">
          <div className={styles.savedHeader}>
            <div className={styles.savedTitle}>
              <BookmarkCheck size={18} />
              Session Comparisons ({savedComparisons.length})
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Temporary in-page list; cleared when you leave or refresh this page
            </span>
          </div>

          <div className={styles.savedList}>
            {savedComparisons.map((item) => (
              <div key={item.id} className={styles.savedCard}>
                <div className={styles.savedCardTop}>
                  <span className={styles.savedCardTitle}>{item.scenarioTitle}</span>
                  <span className={styles.savedCardTime}>{item.savedAt}</span>
                </div>
                <div className={styles.savedCardDesc}>
                  Selected Winner: <strong>{item.winnerName}</strong>
                </div>
                <div className={styles.savedCardActions}>
                  {item.annualSavings > 0 && (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-success)',
                        fontWeight: 600,
                        marginRight: 'auto',
                      }}
                    >
                      Saves {formatRupees(item.annualSavings)}/yr
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setActiveScenarioId(item.scenarioId)}
                    title="Load this comparison scenario"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => handleDeleteSaved(item.id)}
                    aria-label="Remove saved comparison"
                    title="Remove saved comparison"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
