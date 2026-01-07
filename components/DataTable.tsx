'use client';

import { useState } from 'react';
import { BIAEntry, METRIC_DEFINITIONS, CATEGORY_LABELS, MetricDefinition } from '@/lib/types';
import Tooltip from './Tooltip';

interface DataTableProps {
  entries: BIAEntry[];
  onDelete: (id: string) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object' && 'lb' in value && 'percent' in value) {
    const seg = value as { lb: number; percent: number };
    if (seg.lb === 0) return '—';
    return seg.lb.toFixed(1);
  }
  if (typeof value === 'number') {
    if (value === 0) return '—';
    return value.toFixed(1);
  }
  return String(value);
}

function getTrendIndicator(
  current: number,
  previous: number | undefined,
  metric: MetricDefinition
): { color: string; arrow: string } {
  if (previous === undefined || current === 0 || previous === 0) {
    return { color: '', arrow: '' };
  }

  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return { color: '', arrow: '' };

  const improved = metric.higherIsBetter
    ? diff > 0
    : metric.higherIsBetter === false
    ? diff < 0
    : null;

  if (improved === null) return { color: '', arrow: '' };

  return {
    color: improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
    arrow: diff > 0 ? '↑' : '↓'
  };
}

type RangeStatus = 'below' | 'within' | 'above' | null;

function getRangeStatus(value: number, metric: MetricDefinition): RangeStatus {
  if (!metric.normalRange || value === 0) return null;
  const { min, max } = metric.normalRange;
  if (value < min) return 'below';
  if (value > max) return 'above';
  return 'within';
}

function getRangeIndicator(status: RangeStatus, metric: MetricDefinition): { dotColor: string; label: string } {
  const range = metric.normalRange;
  const rangeStr = range ? ` (${range.min}–${range.max}${metric.unit})` : '';

  switch (status) {
    case 'below':
      return { dotColor: 'bg-amber-500', label: `Below normal${rangeStr}` };
    case 'above':
      return { dotColor: 'bg-red-500', label: `Above normal${rangeStr}` };
    case 'within':
      return { dotColor: 'bg-emerald-500', label: `Within normal${rangeStr}` };
    default:
      return { dotColor: '', label: '' };
  }
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function DataTable({ entries, onDelete }: DataTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['core', 'composition'])
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  if (entries.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        No entries yet. Upload a screenshot to get started.
      </div>
    );
  }

  const categories = ['header', 'core', 'composition', 'additional', 'recommendations'] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="sticky left-0 bg-white dark:bg-gray-900 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">
              Metric
            </th>
            {entries.map((entry) => (
              <th
                key={entry.id}
                className="px-3 py-2 text-center min-w-[100px]"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(entry.date)}
                  </span>
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-[10px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {categories.map((category) => {
            const metricsInCategory = METRIC_DEFINITIONS.filter(
              (m) => m.category === category
            );
            const isExpanded = expandedCategories.has(category);

            return (
              <CategorySection
                key={category}
                category={category}
                categoryLabel={CATEGORY_LABELS[category]}
                metrics={metricsInCategory}
                entries={entries}
                isExpanded={isExpanded}
                onToggle={() => toggleCategory(category)}
              />
            );
          })}

          <SegmentalSection
            title="Segmental Muscle"
            isExpanded={expandedCategories.has('segmental-muscle')}
            onToggle={() => toggleCategory('segmental-muscle')}
            entries={entries}
            fields={[
              { key: 'muscleLeftArm', label: 'Left Arm' },
              { key: 'muscleRightArm', label: 'Right Arm' },
              { key: 'muscleTrunk', label: 'Trunk' },
              { key: 'muscleLeftLeg', label: 'Left Leg' },
              { key: 'muscleRightLeg', label: 'Right Leg' },
            ]}
          />

          <SegmentalSection
            title="Segmental Fat"
            isExpanded={expandedCategories.has('segmental-fat')}
            onToggle={() => toggleCategory('segmental-fat')}
            entries={entries}
            fields={[
              { key: 'fatLeftArm', label: 'Left Arm' },
              { key: 'fatRightArm', label: 'Right Arm' },
              { key: 'fatTrunk', label: 'Trunk' },
              { key: 'fatLeftLeg', label: 'Left Leg' },
              { key: 'fatRightLeg', label: 'Right Leg' },
            ]}
          />
        </tbody>
      </table>
    </div>
  );
}

interface CategorySectionProps {
  category: string;
  categoryLabel: string;
  metrics: MetricDefinition[];
  entries: BIAEntry[];
  isExpanded: boolean;
  onToggle: () => void;
}

function CategorySection({
  categoryLabel,
  metrics,
  entries,
  isExpanded,
  onToggle,
}: CategorySectionProps) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <td
          colSpan={entries.length + 1}
          className="sticky left-0 bg-gray-50 dark:bg-gray-900/50 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {categoryLabel}
          </span>
        </td>
      </tr>
      {isExpanded &&
        metrics.map((metric) => (
          <tr
            key={metric.key}
            className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
          >
            <td className="sticky left-0 bg-white dark:bg-gray-900 px-4 py-1.5 text-gray-600 dark:text-gray-300">
              <span className="text-xs inline-flex items-center gap-1">
                {metric.label}
                {metric.normalRange && (
                  <Tooltip content={`Normal: ${metric.normalRange.min}–${metric.normalRange.max}${metric.unit}`}>
                    <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </Tooltip>
                )}
              </span>
            </td>
            {entries.map((entry, entryIdx) => {
              const value = entry[metric.key];
              const previousEntry = entries[entryIdx + 1];
              const previousValue = previousEntry
                ? (previousEntry[metric.key] as number)
                : undefined;

              const numValue = typeof value === 'number' ? value : 0;
              const { color, arrow } = getTrendIndicator(numValue, previousValue, metric);
              const rangeStatus = getRangeStatus(numValue, metric);
              const { dotColor, label: rangeLabel } = getRangeIndicator(rangeStatus, metric);
              const displayValue = formatValue(value);

              return (
                <td
                  key={entry.id}
                  className="px-3 py-1.5 text-center"
                >
                  <span className={`text-xs inline-flex items-center justify-center gap-1.5 ${color || 'text-gray-900 dark:text-gray-100'}`}>
                    {rangeStatus ? (
                      <Tooltip content={rangeLabel}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} cursor-help flex-shrink-0`} />
                      </Tooltip>
                    ) : (
                      <span className="w-1.5" />
                    )}
                    <span className="tabular-nums w-14 text-right">{displayValue}</span>
                    {arrow ? (
                      <span className="text-[10px] w-3">{arrow}</span>
                    ) : (
                      <span className="w-3" />
                    )}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
    </>
  );
}

interface SegmentalSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  entries: BIAEntry[];
  fields: Array<{ key: keyof BIAEntry; label: string }>;
}

function SegmentalSection({
  title,
  isExpanded,
  onToggle,
  entries,
  fields,
}: SegmentalSectionProps) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <td
          colSpan={entries.length + 1}
          className="sticky left-0 bg-gray-50 dark:bg-gray-900/50 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {title}
          </span>
        </td>
      </tr>
      {isExpanded &&
        fields.map((field) => (
          <tr
            key={field.key}
            className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
          >
            <td className="sticky left-0 bg-white dark:bg-gray-900 px-4 py-1.5 text-gray-600 dark:text-gray-300">
              <span className="text-xs">{field.label}</span>
            </td>
            {entries.map((entry) => {
              const value = entry[field.key];
              return (
                <td
                  key={entry.id}
                  className="px-3 py-1.5 text-center"
                >
                  <span className="text-xs inline-flex items-center justify-center gap-1.5 text-gray-900 dark:text-gray-100">
                    <span className="w-1.5" />
                    <span className="tabular-nums w-14 text-right">{formatValue(value)}</span>
                    <span className="w-3" />
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
    </>
  );
}
