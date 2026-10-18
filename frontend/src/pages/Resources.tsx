import { useState, useMemo, useEffect, type ChangeEvent, type FormEvent } from 'react';
import {
  Receipt,
  Plus,
  Search,
  X,
  Download,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  DollarSign,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Droplets,
  Flame,
  Car,
  Utensils,
  Trash,
  ShoppingBag,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

import { useWorkspace } from '@/hooks/useWorkspace';
import { createResource, deleteResource, getResources, updateResource } from '@/services/api';
import type { ResourceRecord, ResourceCategory, MeasurementType } from '@/types';
import styles from './Resources.module.css';

// --- Category Configurations ---
interface CategoryMeta {
  label: string;
  icon: typeof Zap;
  badgeClass: string;
  defaultUnit: string;
}

const CATEGORY_MAP: Record<ResourceCategory, CategoryMeta> = {
  electricity: {
    label: 'Electricity',
    icon: Zap,
    badgeClass: styles.badge_electricity,
    defaultUnit: 'kWh',
  },
  water: {
    label: 'Water',
    icon: Droplets,
    badgeClass: styles.badge_water,
    defaultUnit: 'm³',
  },
  gas: {
    label: 'Gas',
    icon: Flame,
    badgeClass: styles.badge_gas,
    defaultUnit: 'kWh',
  },
  travel: {
    label: 'Travel',
    icon: Car,
    badgeClass: styles.badge_travel,
    defaultUnit: 'km',
  },
  food: {
    label: 'Food',
    icon: Utensils,
    badgeClass: styles.badge_food,
    defaultUnit: 'month',
  },
  waste: {
    label: 'Waste',
    icon: Trash,
    badgeClass: styles.badge_waste,
    defaultUnit: 'kg',
  },
  shopping: {
    label: 'Shopping',
    icon: ShoppingBag,
    badgeClass: styles.badge_shopping,
    defaultUnit: 'items',
  },
  other: {
    label: 'Other',
    icon: HelpCircle,
    badgeClass: styles.badge_other,
    defaultUnit: 'units',
  },
};

const CATEGORIES_LIST: ResourceCategory[] = [
  'electricity',
  'water',
  'gas',
  'travel',
  'food',
  'waste',
  'shopping',
  'other',
];

const MEASUREMENT_TYPES: MeasurementType[] = ['measured', 'estimated', 'imported'];

const COMMON_UNITS = ['kWh', 'm³', 'L', 'kg', 'km', 'therms', 'month', 'items', 'units'];

type SortField = 'category' | 'description' | 'quantity' | 'cost' | 'period' | 'measurementType';
type SortDirection = 'asc' | 'desc';

interface FormState {
  category: ResourceCategory;
  description: string;
  quantity: string;
  unit: string;
  cost: string;
  periodStart: string;
  periodEnd: string;
  measurementType: MeasurementType;
  source: string;
  notes: string;
}

interface FormErrors {
  category?: string;
  description?: string;
  quantity?: string;
  unit?: string;
  cost?: string;
  periodStart?: string;
  periodEnd?: string;
}

function createDefaultFormData(): FormState {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const formatLocalDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return {
    category: 'electricity',
    description: '',
    quantity: '',
    unit: 'kWh',
    cost: '',
    periodStart: formatLocalDate(monthStart),
    periodEnd: formatLocalDate(now),
    measurementType: 'measured',
    source: '',
    notes: '',
  };
}

// Format period helper (e.g. Sep 2024)
function formatPeriodDisplay(startStr: string, endStr?: string): string {
  if (!startStr) return '—';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startParts = startStr.split('-');
  if (startParts.length >= 2) {
    const sMonth = monthNames[parseInt(startParts[1], 10) - 1] || startParts[1];
    const sYear = startParts[0];
    const sDisplay = `${sMonth} ${sYear}`;

    if (endStr) {
      const endParts = endStr.split('-');
      if (endParts.length >= 2) {
        const eMonth = monthNames[parseInt(endParts[1], 10) - 1] || endParts[1];
        const eYear = endParts[0];
        const eDisplay = `${eMonth} ${eYear}`;
        if (sDisplay === eDisplay) return sDisplay;
        return `${sDisplay} – ${eDisplay}`;
      }
    }
    return sDisplay;
  }
  return startStr;
}

// Currency formatting helper
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR' as const,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function Resources() {
  const { currentWorkspace } = useWorkspace();

  // State management
  const [records, setRecords] = useState<ResourceRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getResources(currentWorkspace.id)
      .then((items) => {
        if (!isMounted) return;
        setRecords(items);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Unable to load resources', error);
        setRecords([]);
        setLoadError(error instanceof Error ? error.message : 'Unable to load saved resource records.');
      });

    return () => {
      isMounted = false;
    };
  }, [currentWorkspace.id]);

  const [categoryFilter, setCategoryFilter] = useState<'all' | ResourceCategory>('all');
  const [measurementFilter, setMeasurementFilter] = useState<'all' | MeasurementType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('period');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ResourceRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<ResourceRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<FormState>(createDefaultFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Trigger brief feedback notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Workspace-filtered records
  const workspaceRecords = useMemo(() => {
    return records.filter((r) => r.workspaceId === currentWorkspace.id);
  }, [records, currentWorkspace.id]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return workspaceRecords.filter((record) => {
      // Category filter
      if (categoryFilter !== 'all' && record.category !== categoryFilter) {
        return false;
      }
      // Measurement type filter
      if (measurementFilter !== 'all' && record.measurementType !== measurementFilter) {
        return false;
      }
      // Search query in description, notes, or source
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesDesc = record.description.toLowerCase().includes(query);
        const matchesSource = record.source?.toLowerCase().includes(query);
        const matchesNotes = record.notes?.toLowerCase().includes(query);
        const matchesUnit = record.unit.toLowerCase().includes(query);
        if (!matchesDesc && !matchesSource && !matchesNotes && !matchesUnit) {
          return false;
        }
      }
      return true;
    });
  }, [workspaceRecords, categoryFilter, measurementFilter, searchQuery]);

  // Client-side sorted records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'cost':
          comparison = a.cost - b.cost;
          break;
        case 'period':
          comparison = (a.periodStart || '').localeCompare(b.periodStart || '');
          break;
        case 'measurementType':
          comparison = a.measurementType.localeCompare(b.measurementType);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRecords, sortField, sortDirection]);

  // Summary Metrics calculations
  const totalCost = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
  }, [filteredRecords]);

  const uniqueCategoriesCount = useMemo(() => {
    const cats = new Set(filteredRecords.map((r) => r.category));
    return cats.size;
  }, [filteredRecords]);

  const qualityStats = useMemo(() => {
    const total = filteredRecords.length;
    if (total === 0) return { measuredPct: 0, measured: 0, estimated: 0, imported: 0 };
    const measured = filteredRecords.filter((r) => r.measurementType === 'measured').length;
    const estimated = filteredRecords.filter((r) => r.measurementType === 'estimated').length;
    const imported = filteredRecords.filter((r) => r.measurementType === 'imported').length;
    const measuredPct = Math.round((measured / total) * 100);
    return { measuredPct, measured, estimated, imported, total };
  }, [filteredRecords]);

  // Sorting header click handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Open modal for Adding
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setFormData(createDefaultFormData());
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEditModal = (record: ResourceRecord) => {
    setEditingRecord(record);
    setFormData({
      category: record.category,
      description: record.description,
      quantity: record.quantity.toString(),
      unit: record.unit,
      cost: record.cost.toString(),
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      measurementType: record.measurementType,
      source: record.source || '',
      notes: record.notes || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setFormErrors({});
  };

  // Form field change handler
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // When category changes, auto-suggest default unit if user didn't customize
      if (name === 'category' && !editingRecord) {
        const catMeta = CATEGORY_MAP[value as ResourceCategory];
        if (catMeta) {
          next.unit = catMeta.defaultUnit;
        }
      }
      return next;
    });

    // Clear individual field error on change
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    const qtyNum = parseFloat(formData.quantity);
    if (!formData.quantity || isNaN(qtyNum) || qtyNum <= 0) {
      errors.quantity = 'Quantity must be a positive number (> 0)';
    }

    if (!formData.unit.trim()) {
      errors.unit = 'Unit is required';
    }

    const costNum = parseFloat(formData.cost);
    if (!formData.cost || isNaN(costNum) || costNum < 0) {
      errors.cost = 'Cost must be a non-negative number (≥ 0)';
    }

    if (!formData.periodStart) {
      errors.periodStart = 'Start date is required';
    }

    if (!formData.periodEnd) {
      errors.periodEnd = 'End date is required';
    }

    if (formData.periodStart && formData.periodEnd && formData.periodStart > formData.periodEnd) {
      errors.periodEnd = 'End date must be on or after start date';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmitRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    const qty = parseFloat(formData.quantity);
    const cost = parseFloat(formData.cost);

    setIsSaving(true);
    try {
      const payload = {
        category: formData.category,
        description: formData.description.trim(),
        quantity: qty,
        unit: formData.unit.trim(),
        cost,
        currency: 'INR' as const,
        period_start: formData.periodStart,
        period_end: formData.periodEnd,
        measurement_type: formData.measurementType,
        source: formData.source.trim(),
        notes: formData.notes.trim(),
      };
      if (editingRecord) {
        await updateResource(editingRecord.id, payload);
        showToast('Record updated and saved.');
      } else {
        await createResource({ ...payload, workspace_id: currentWorkspace.id });
        showToast('Resource record saved.');
      }
      setRecords(await getResources(currentWorkspace.id));
      setLoadError('');
      handleCloseModal();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not save the resource record.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete record action
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteResource(recordToDelete.id);
      setRecords(await getResources(currentWorkspace.id));
      setLoadError('');
      showToast(`Deleted "${recordToDelete.description}".`);
      setRecordToDelete(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not delete the resource record.');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setCategoryFilter('all');
    setMeasurementFilter('all');
    setSearchQuery('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Category',
      'Description',
      'Quantity',
      'Unit',
      'Cost',
      'Currency',
      'Period Start',
      'Period End',
      'Measurement Type',
      'Source',
      'Notes',
    ];

    const rows = sortedRecords.map((r) => [
      `"${r.category}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.quantity,
      `"${r.unit}"`,
      r.cost,
      `"${r.currency}"`,
      `"${r.periodStart}"`,
      `"${r.periodEnd}"`,
      `"${r.measurementType}"`,
      `"${(r.source || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const sanitizedWsName = currentWorkspace.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute(
      'download',
      `ecotwin_resources_${sanitizedWsName}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV successfully');
  };

  const hasActiveFilters =
    categoryFilter !== 'all' || measurementFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className={styles.container}>
      {/* 1. Page Header */}
      <header className={styles.headerRow}>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>Resources & Expenses</h1>
          <p className={styles.pageSubtitle}>
            Track and monitor resource consumption, utilities, and expenses across{' '}
            <strong>{currentWorkspace.name}</strong>. Evaluate data certainty, log utility bills, and
            baseline recurring environmental expenditures.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportCSV}
            title="Download records as a CSV spreadsheet"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleOpenAddModal}
            title="Create a new resource record"
          >
            <Plus size={16} />
            <span>Add Record</span>
          </button>
        </div>
      </header>

      {loadError && (
        <div className={styles.dataError} role="alert">
          <AlertTriangle size={16} />
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError('');
              getResources(currentWorkspace.id)
                .then(setRecords)
                .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load records.'));
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Summary Cards */}
      <section className={styles.summaryGrid} aria-label="Summary Statistics">
        {/* Card 1: Total Records */}
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.summaryCardTop}>
              <span className={styles.summaryLabel}>Total Records</span>
              <div className={`${styles.summaryIconBox} ${styles.iconTotal}`}>
                <Receipt size={20} />
              </div>
            </div>
            <div className={styles.summaryValue}>{filteredRecords.length}</div>
          </div>
          <div className={styles.summarySub}>
            {hasActiveFilters
              ? `Filtered from ${workspaceRecords.length} total entries`
              : 'All active entries in workspace'}
          </div>
        </div>

        {/* Card 2: Total Cost */}
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.summaryCardTop}>
              <span className={styles.summaryLabel}>Total Cost</span>
              <div className={`${styles.summaryIconBox} ${styles.iconCost}`}>
                <DollarSign size={20} />
              </div>
            </div>
            <div className={styles.summaryValue}>{formatCurrency(totalCost)}</div>
          </div>
          <div className={styles.summarySub}>
            {filteredRecords.length > 0
              ? `Across ${filteredRecords.length} tracked item${filteredRecords.length > 1 ? 's' : ''}`
              : 'No expenses matching view'}
          </div>
        </div>

        {/* Card 3: Categories Tracked */}
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.summaryCardTop}>
              <span className={styles.summaryLabel}>Categories Tracked</span>
              <div className={`${styles.summaryIconBox} ${styles.iconCategories}`}>
                <Layers size={20} />
              </div>
            </div>
            <div className={styles.summaryValue}>
              {uniqueCategoriesCount} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>/ 8</span>
            </div>
          </div>
          <div className={styles.summarySub}>
            {uniqueCategoriesCount === 0
              ? 'None currently active'
              : `${Math.round((uniqueCategoriesCount / 8) * 100)}% resource domain coverage`}
          </div>
        </div>

        {/* Card 4: Data Quality Split */}
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.summaryCardTop}>
              <span className={styles.summaryLabel}>Data Quality</span>
              <div className={`${styles.summaryIconBox} ${styles.iconQuality}`}>
                <Gauge size={20} />
              </div>
            </div>
            <div className={styles.summaryValue}>
              {qualityStats.measuredPct}% <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>measured</span>
            </div>
          </div>
          <div>
            <div className={styles.qualityBarTrack}>
              <div
                className={styles.qualityBarMeasured}
                style={{
                  width: `${qualityStats.total ? (qualityStats.measured / qualityStats.total) * 100 : 0}%`,
                }}
                title={`Measured: ${qualityStats.measured}`}
              />
              <div
                className={styles.qualityBarEstimated}
                style={{
                  width: `${qualityStats.total ? (qualityStats.estimated / qualityStats.total) * 100 : 0}%`,
                }}
                title={`Estimated: ${qualityStats.estimated}`}
              />
              <div
                className={styles.qualityBarImported}
                style={{
                  width: `${qualityStats.total ? (qualityStats.imported / qualityStats.total) * 100 : 0}%`,
                }}
                title={`Imported: ${qualityStats.imported}`}
              />
            </div>
            <div className={styles.qualityLegend}>
              <span className={styles.qualityLegendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-success)' }} />
                {qualityStats.measured} Measured
              </span>
              <span className={styles.qualityLegendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-warning)' }} />
                {qualityStats.estimated} Est.
              </span>
              {qualityStats.imported > 0 && (
                <span className={styles.qualityLegendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-info)' }} />
                  {qualityStats.imported} Imp.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Filter Bar */}
      <section className={styles.filterCard} aria-label="Filter records">
        <div className={styles.filterRow}>
          {/* Search Input */}
          <div className={styles.searchContainer}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by description, source or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search records"
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.filterSelectGroup}>
            {/* Category Dropdown */}
            <div className={styles.selectWrapper}>
              <select
                className={styles.selectInput}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'all' | ResourceCategory)}
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>
                {CATEGORIES_LIST.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_MAP[cat].label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className={styles.selectCaret} />
            </div>

            {/* Measurement Type Dropdown */}
            <div className={styles.selectWrapper}>
              <select
                className={styles.selectInput}
                value={measurementFilter}
                onChange={(e) => setMeasurementFilter(e.target.value as 'all' | MeasurementType)}
                aria-label="Filter by measurement type"
              >
                <option value="all">All Types</option>
                <option value="measured">Measured (utility/bill)</option>
                <option value="estimated">Estimated (modeled)</option>
                <option value="imported">Imported (external)</option>
              </select>
              <ChevronDown size={14} className={styles.selectCaret} />
            </div>

            {/* Clear/Reset button */}
            {hasActiveFilters && (
              <button
                type="button"
                className={styles.resetFiltersBtn}
                onClick={handleResetFilters}
                title="Reset all filters to default"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. Records Table */}
      <section className={styles.tableCard} aria-label="Resource Records Table">
        <div className={styles.tableHeaderBar}>
          <div className={styles.tableHeaderLeft}>
            <h2 className={styles.tableTitle}>Expense & Resource Entries</h2>
            <span className={styles.tableCount}>
              Showing {sortedRecords.length} of {workspaceRecords.length} records
            </span>
          </div>

          <div className={styles.workspaceBanner}>
            <CheckCircle2 size={12} style={{ color: 'var(--color-primary-600)' }} />
            <span>Workspace: {currentWorkspace.name}</span>
          </div>
        </div>

        {sortedRecords.length > 0 ? (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {/* Category Column */}
                  <th
                    scope="col"
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort('category')}
                    aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={styles.thContent}>
                      Category
                      {sortField === 'category' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className={styles.sortIconActive} /> : <ArrowDown size={14} className={styles.sortIconActive} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>

                  {/* Description Column */}
                  <th
                    scope="col"
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort('description')}
                    aria-sort={sortField === 'description' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={styles.thContent}>
                      Description
                      {sortField === 'description' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className={styles.sortIconActive} /> : <ArrowDown size={14} className={styles.sortIconActive} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>

                  {/* Quantity Column */}
                  <th
                    scope="col"
                    className={`${styles.th} ${styles.thSortable} ${styles.thNumeric}`}
                    onClick={() => handleSort('quantity')}
                    aria-sort={sortField === 'quantity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={styles.thContent}>
                      Quantity
                      {sortField === 'quantity' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className={styles.sortIconActive} /> : <ArrowDown size={14} className={styles.sortIconActive} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>

                  {/* Unit Column */}
                  <th scope="col" className={styles.th}>
                    Unit
                  </th>

                  {/* Cost Column */}
                  <th
                    scope="col"
                    className={`${styles.th} ${styles.thSortable} ${styles.thNumeric}`}
                    onClick={() => handleSort('cost')}
                    aria-sort={sortField === 'cost' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={styles.thContent}>
                      Cost
                      {sortField === 'cost' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className={styles.sortIconActive} /> : <ArrowDown size={14} className={styles.sortIconActive} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>

                  {/* Period Column */}
                  <th
                    scope="col"
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort('period')}
                    aria-sort={sortField === 'period' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={styles.thContent}>
                      Period
                      {sortField === 'period' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className={styles.sortIconActive} /> : <ArrowDown size={14} className={styles.sortIconActive} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>

                  {/* Type Column */}
                  <th
                    scope="col"
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort('measurementType')}
                    aria-sort={sortField === 'measurementType' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={styles.thContent}>
                      Type
                      {sortField === 'measurementType' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className={styles.sortIconActive} /> : <ArrowDown size={14} className={styles.sortIconActive} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>

                  {/* Actions Column */}
                  <th scope="col" className={`${styles.th} ${styles.tdActions}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((record, index) => {
                  const catConfig = CATEGORY_MAP[record.category] || CATEGORY_MAP.other;
                  const IconComponent = catConfig.icon;
                  const isEven = index % 2 === 1;

                  return (
                    <tr key={record.id} className={isEven ? styles.rowEven : undefined}>
                      {/* Category Badge */}
                      <td className={styles.td}>
                        <span className={`${styles.badge} ${catConfig.badgeClass}`}>
                          <IconComponent size={12} />
                          {catConfig.label}
                        </span>
                      </td>

                      {/* Description */}
                      <td className={styles.td}>
                        <div className={styles.descCell}>
                          <div className={styles.descTitle}>{record.description}</div>
                          {record.source && (
                            <div className={styles.descSource} title={record.source}>
                              Source: {record.source}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className={`${styles.td} ${styles.tdNumeric}`}>
                        {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(record.quantity)}
                      </td>

                      {/* Unit */}
                      <td className={styles.td} style={{ color: 'var(--color-text-secondary)' }}>
                        {record.unit}
                      </td>

                      {/* Cost */}
                      <td className={`${styles.td} ${styles.tdNumeric}`}>
                        <span className={styles.costValue}>
                          {record.currency === 'INR' ? formatCurrency(record.cost) : 'Currency correction required'}
                        </span>
                      </td>

                      {/* Period */}
                      <td className={`${styles.td} ${styles.periodCell}`}>
                        {formatPeriodDisplay(record.periodStart, record.periodEnd)}
                      </td>

                      {/* Measurement Type */}
                      <td className={styles.td}>
                        <span
                          className={`${styles.measureBadge} ${
                            record.measurementType === 'measured'
                              ? styles.measure_measured
                              : record.measurementType === 'estimated'
                              ? styles.measure_estimated
                              : styles.measure_imported
                          }`}
                        >
                          {record.measurementType}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className={`${styles.td} ${styles.tdActions}`}>
                        <div className={styles.actionBtnGroup}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                            onClick={() => handleOpenEditModal(record)}
                            aria-label={`Edit ${record.description}`}
                            title="Edit Record"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            onClick={() => setRecordToDelete(record)}
                            aria-label={`Delete ${record.description}`}
                            title="Delete Record"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* 6. Empty State */
          <div className={styles.emptyState}>
            <div className={styles.emptyIconBox}>
              <Receipt size={28} />
            </div>
            <h3 className={styles.emptyTitle}>No resource records found</h3>
            <p className={styles.emptyText}>
              {hasActiveFilters
                ? 'No records match the current filter and search conditions. Try adjusting your parameters or reset filters.'
                : `No resource or expense records have been recorded for ${currentWorkspace.name} yet.`}
            </p>
            <div className={styles.emptyActions}>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className={styles.exportBtn}
                  onClick={handleResetFilters}
                >
                  <RotateCcw size={14} />
                  <span>Reset Filters</span>
                </button>
              ) : null}
              <button
                type="button"
                className={styles.addBtn}
                onClick={handleOpenAddModal}
              >
                <Plus size={16} />
                <span>Add First Record</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 5. Add / Edit Record Modal */}
      {isModalOpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="record-modal-title" className={styles.modalTitle}>
                {editingRecord ? 'Edit Resource Record' : 'Add Resource Record'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={handleCloseModal}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRecord} noValidate>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  {/* Category */}
                  <div className={styles.formGroup}>
                    <label htmlFor="field-category" className={styles.formLabel}>
                      Category <span className={styles.requiredStar}>*</span>
                    </label>
                    <select
                      id="field-category"
                      name="category"
                      className={styles.inputField}
                      value={formData.category}
                      onChange={handleInputChange}
                    >
                      {CATEGORIES_LIST.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_MAP[cat].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Measurement Type */}
                  <div className={styles.formGroup}>
                    <label htmlFor="field-type" className={styles.formLabel}>
                      Measurement Type <span className={styles.requiredStar}>*</span>
                    </label>
                    <select
                      id="field-type"
                      name="measurementType"
                      className={styles.inputField}
                      value={formData.measurementType}
                      onChange={handleInputChange}
                    >
                      {MEASUREMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className={styles.formGroupFull}>
                    <label htmlFor="field-description" className={styles.formLabel}>
                      Description <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      id="field-description"
                      type="text"
                      name="description"
                      placeholder="e.g. Monthly electricity bill or Commute mileage"
                      className={`${styles.inputField} ${
                        formErrors.description ? styles.inputFieldError : ''
                      }`}
                      value={formData.description}
                      onChange={handleInputChange}
                    />
                    {formErrors.description && (
                      <span className={styles.fieldErrorText}>{formErrors.description}</span>
                    )}
                  </div>

                  {/* Quantity & Unit */}
                  <div className={styles.formGroup}>
                    <label htmlFor="field-quantity" className={styles.formLabel}>
                      Quantity <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      id="field-quantity"
                      type="number"
                      step="any"
                      min="0.0001"
                      name="quantity"
                      placeholder="e.g. 320"
                      className={`${styles.inputField} ${
                        formErrors.quantity ? styles.inputFieldError : ''
                      }`}
                      value={formData.quantity}
                      onChange={handleInputChange}
                    />
                    {formErrors.quantity && (
                      <span className={styles.fieldErrorText}>{formErrors.quantity}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="field-unit" className={styles.formLabel}>
                      Unit <span className={styles.requiredStar}>*</span>
                    </label>
                    <div className={styles.inputGroupRow}>
                      <input
                        id="field-unit"
                        type="text"
                        name="unit"
                        placeholder="kWh, m³, kg..."
                        className={`${styles.inputField} ${
                          formErrors.unit ? styles.inputFieldError : ''
                        }`}
                        value={formData.unit}
                        onChange={handleInputChange}
                        list="unit-suggestions"
                      />
                      <select
                        aria-label="Preset unit selector"
                        className={styles.inputField}
                        value={COMMON_UNITS.includes(formData.unit) ? formData.unit : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData((prev) => ({ ...prev, unit: e.target.value }));
                            setFormErrors((prev) => ({ ...prev, unit: undefined }));
                          }
                        }}
                      >
                        <option value="">Presets</option>
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <datalist id="unit-suggestions">
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                    {formErrors.unit && (
                      <span className={styles.fieldErrorText}>{formErrors.unit}</span>
                    )}
                  </div>

                  {/* Cost & Currency */}
                  <div className={styles.formGroup}>
                    <label htmlFor="field-cost" className={styles.formLabel}>
                      Cost <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      id="field-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      name="cost"
                      placeholder="0.00"
                      className={`${styles.inputField} ${
                        formErrors.cost ? styles.inputFieldError : ''
                      }`}
                      value={formData.cost}
                      onChange={handleInputChange}
                    />
                    {formErrors.cost && (
                      <span className={styles.fieldErrorText}>{formErrors.cost}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <span className={styles.formLabel}>Currency</span>
                    <div className={styles.currencyFixed} aria-label="Currency: Indian rupees">INR · ₹ (Indian rupees)</div>
                  </div>

                  {/* Period Start & End */}
                  <div className={styles.formGroup}>
                    <label htmlFor="field-periodStart" className={styles.formLabel}>
                      Period Start <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      id="field-periodStart"
                      type="date"
                      name="periodStart"
                      className={`${styles.inputField} ${
                        formErrors.periodStart ? styles.inputFieldError : ''
                      }`}
                      value={formData.periodStart}
                      onChange={handleInputChange}
                    />
                    {formErrors.periodStart && (
                      <span className={styles.fieldErrorText}>{formErrors.periodStart}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="field-periodEnd" className={styles.formLabel}>
                      Period End <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      id="field-periodEnd"
                      type="date"
                      name="periodEnd"
                      className={`${styles.inputField} ${
                        formErrors.periodEnd ? styles.inputFieldError : ''
                      }`}
                      value={formData.periodEnd}
                      onChange={handleInputChange}
                    />
                    {formErrors.periodEnd && (
                      <span className={styles.fieldErrorText}>{formErrors.periodEnd}</span>
                    )}
                  </div>

                  {/* Source */}
                  <div className={styles.formGroupFull}>
                    <label htmlFor="field-source" className={styles.formLabel}>
                      Data Source
                    </label>
                    <input
                      id="field-source"
                      type="text"
                      name="source"
                      placeholder="e.g. Utility provider bill, Smart meter app, Odometer reading"
                      className={styles.inputField}
                      value={formData.source}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Notes */}
                  <div className={styles.formGroupFull}>
                    <label htmlFor="field-notes" className={styles.formLabel}>
                      Notes & Context
                    </label>
                    <textarea
                      id="field-notes"
                      name="notes"
                      placeholder="Optional notes regarding seasonal variance, estimations, or equipment specifics"
                      className={styles.textareaField}
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.btnSave} disabled={isSaving}>
                  {isSaving ? 'Saving…' : editingRecord ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {recordToDelete && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRecordToDelete(null);
          }}
        >
          <div className={`${styles.modal} ${styles.confirmModal}`}>
            <div className={styles.modalBody}>
              <div className={styles.confirmIconBox}>
                <AlertTriangle size={24} />
              </div>
              <h3 id="confirm-delete-title" className={styles.modalTitle} style={{ fontSize: 'var(--text-xl)' }}>
                Delete Record?
              </h3>
              <p className={styles.confirmDesc}>
                Are you sure you want to delete <strong>"{recordToDelete.description}"</strong>? This
                action will remove the record from your workspace totals and calculations.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setRecordToDelete(null)}
              >
                Keep Record
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={confirmDelete}
              >
                <Trash2 size={15} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <aside className={styles.toast} role="status" aria-live="polite">
          <CheckCircle2 size={16} style={{ color: 'var(--color-primary-300)' }} />
          <span>{toastMessage}</span>
        </aside>
      )}
    </div>
  );
}
