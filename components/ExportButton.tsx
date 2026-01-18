'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import {
  generateMultiCSVExport,
  downloadJSONExport,
  downloadCSVExports,
  type HealthDataExport,
} from '@/lib/export-utils';

export default function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    setError(null);
    setShowMenu(false);

    try {
      // Fetch all data from the API
      const response = await fetch('/api/export?format=json');

      if (!response.ok) {
        throw new Error('Failed to fetch export data');
      }

      const exportData: HealthDataExport = await response.json();

      if (format === 'json') {
        // Download as single JSON file
        downloadJSONExport(exportData);
      } else if (format === 'csv') {
        // Generate CSV files for each data type
        const csvData = generateMultiCSVExport(
          exportData.data.bia,
          exportData.data.bodyspec,
          exportData.data.running,
          exportData.data.lifting,
          exportData.data.sleep
        );

        // Download all CSV files
        downloadCSVExports(csvData);
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export Data
          </>
        )}
      </button>

      {showMenu && !isExporting && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Export Format
              </div>

              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FileJson className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-medium">JSON</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Single file with all data
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div>
                  <div className="font-medium">CSV (Multiple files)</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Separate files for each data type
                  </div>
                </div>
              </button>
            </div>

            {error && (
              <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-t border-gray-200 dark:border-gray-700">
                {error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
