'use client';

import { useState, useEffect, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import { BIAEntry } from '@/lib/types';
import { parsePDFFile } from '@/lib/client-pdf-parser';
import ThemeToggle from '@/components/ThemeToggle';
import { getEntriesFromDb, saveEntryToDb, deleteEntryFromDb, migrateFromLocalStorage } from '@/lib/supabase';

export default function Home() {
  const [entries, setEntries] = useState<BIAEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // First, try to migrate any localStorage data to cloud
        const migrated = await migrateFromLocalStorage();
        if (migrated > 0) {
          console.log(`Migrated ${migrated} entries from localStorage`);
        }

        // Then fetch from cloud
        const cloudEntries = await getEntriesFromDb();
        setEntries(cloudEntries);
      } catch (err) {
        console.error('Failed to load entries:', err);
        setError('Failed to load data. Please check your connection.');
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    const total = files.length;
    let processed = 0;
    let failed = 0;

    try {
      for (const file of files) {
        processed++;
        setProgress(`Processing ${processed}/${total}...`);

        try {
          const { entry } = await parsePDFFile(file, (msg) => {
            setProgress(`(${processed}/${total}) ${msg}`);
          });

          const hasData = entry.weight > 0 || entry.bodyFatPercentage > 0 || entry.fitnessScore > 0;

          if (!hasData) {
            failed++;
            continue;
          }

          setProgress(`(${processed}/${total}) Saving to cloud...`);
          await saveEntryToDb(entry);
        } catch (err) {
          console.error('Error processing file:', err);
          failed++;
        }
      }

      // Refresh entries from cloud
      const cloudEntries = await getEntriesFromDb();
      setEntries(cloudEntries);
      setProgress('');

      if (failed > 0) {
        setError(`Processed ${total - failed}/${total} images. ${failed} failed to parse.`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to process images: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Delete this entry?')) {
      try {
        await deleteEntryFromDb(id);
        const cloudEntries = await getEntriesFromDb();
        setEntries(cloudEntries);
      } catch (err) {
        console.error('Delete error:', err);
        setError('Failed to delete entry');
      }
    }
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

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
