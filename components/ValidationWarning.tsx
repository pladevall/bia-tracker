'use client';

import { ValidationIssue } from '@/lib/pdf-parser';
import { BIAEntry } from '@/lib/types';

interface ValidationWarningProps {
  issues: ValidationIssue[];
  entry: BIAEntry;
  onConfirm: () => void;
  onReview: () => void;
  onSkip: () => void;
}

export default function ValidationWarning({
  issues,
  entry,
  onConfirm,
  onReview,
  onSkip,
}: ValidationWarningProps) {
  const errorCount = issues.filter(i => i.status === 'error').length;
  const warningCount = issues.filter(i => i.status === 'warning').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 4v2m0-14a2 2 0 100-4 2 2 0 000 4z"
              />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Data Quality Check
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Some metrics differ significantly from your previous scan
              </p>
            </div>
          </div>

          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Date:</strong> {entry.date.split('T')[0]} &nbsp;
              <strong>Weight:</strong> {entry.weight} lb &nbsp;
              <strong>Body Fat:</strong> {entry.bodyFatPercentage}%
            </p>
          </div>

          <div className="space-y-2 mb-6">
            {issues.map((issue, idx) => {
              const isError = issue.status === 'error';
              const change = Math.abs(issue.percentChange);
              const pctDisplay = issue.percentChange > 0 ? '+' : '';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    isError
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div
                        className={`font-medium text-sm ${
                          isError
                            ? 'text-red-900 dark:text-red-300'
                            : 'text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {issue.metric}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Parsed: <span className="font-mono">{issue.parsed.toFixed(1)}</span> &nbsp;|&nbsp;
                        Previous: <span className="font-mono">{issue.previous.toFixed(1)}</span>
                      </div>
                    </div>
                    <div
                      className={`text-right font-mono text-sm font-semibold ${
                        isError
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {pctDisplay}
                      {issue.percentChange.toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>What this means:</strong> These metrics changed by more than 10% from your previous
              scan, which is unusual for typical body composition changes.
            </p>
            <p>
              This could indicate OCR scanning errors. Review the flagged values or check your image quality.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Skip Image
            </button>
            <button
              onClick={onReview}
              className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
            >
              Review OCR Text
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Save Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
