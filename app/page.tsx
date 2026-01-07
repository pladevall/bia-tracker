'use client';

import { useState, useEffect, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import { BIAEntry } from '@/lib/types';
import { getEntries, saveEntry, deleteEntry } from '@/lib/storage';
import { parsePDFFile } from '@/lib/client-pdf-parser';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  const [entries, setEntries] = useState<BIAEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getEntries());
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setProgress('Scanning image...');

    try {
      const { entry } = await parsePDFFile(file, setProgress);

      const hasData = entry.weight > 0 || entry.bodyFatPercentage > 0 || entry.fitnessScore > 0;

      if (!hasData) {
        setError('Could not extract data from image. Please try a clearer screenshot.');
        return;
      }

      saveEntry(entry);
      setEntries(getEntries());
      setProgress('');
    } catch (err) {
      console.error('Parsing error:', err);
      setError('Failed to parse image: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Delete this entry?')) {
      deleteEntry(id);
      setEntries(getEntries());
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">BIA Tracker</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track your body composition
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <FileUpload
            onUpload={handleUpload}
            isLoading={isLoading}
            progress={progress}
          />
          {error && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Measurements
            </h2>
            {entries.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
          <DataTable entries={entries} onDelete={handleDelete} />
        </section>
      </div>
    </div>
  );
}
