'use client';

import { useState, useEffect, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import BodyspecConnect from '@/components/BodyspecConnect';
import BodyspecSyncButton from '@/components/BodyspecSyncButton';
import { BIAEntry, BodyspecScan } from '@/lib/types';
import { parsePDFFile } from '@/lib/client-pdf-parser';
import ThemeToggle from '@/components/ThemeToggle';
import { getEntriesFromDb, saveEntryToDb, deleteEntryFromDb, migrateFromLocalStorage, getPendingImages, deletePendingImage, saveOcrDebug, getGoals, saveGoal, deleteGoal, Goal } from '@/lib/supabase';

export default function Home() {
  const [entries, setEntries] = useState<BIAEntry[]>([]);
  const [bodyspecScans, setBodyspecScans] = useState<BodyspecScan[]>([]);
  const [bodyspecConnections, setBodyspecConnections] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hiddenScans, setHiddenScans] = useState<Set<string>>(() => {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hiddenBodyspecScans');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showBodyspecSection, setShowBodyspecSection] = useState(false);

  const toggleScanVisibility = useCallback((scanId: string) => {
    setHiddenScans(prev => {
      const next = new Set(prev);
      if (next.has(scanId)) {
        next.delete(scanId);
      } else {
        next.add(scanId);
      }
      // Persist to localStorage
      localStorage.setItem('hiddenBodyspecScans', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const visibleScans = bodyspecScans.filter(scan => !hiddenScans.has(scan.id));

  // When scans load, if no localStorage exists, auto-hide all but the most recent scan
  useEffect(() => {
    if (bodyspecScans.length > 0 && !localStorage.getItem('hiddenBodyspecScans')) {
      const sortedByDate = [...bodyspecScans].sort((a, b) =>
        new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime()
      );
      const toHide = sortedByDate.slice(1).map(s => s.id);
      setHiddenScans(new Set(toHide));
      localStorage.setItem('hiddenBodyspecScans', JSON.stringify(toHide));
    }
  }, [bodyspecScans]);

  const loadBodyspecData = useCallback(async () => {
    try {
      // Load connections
      const connectionsRes = await fetch('/api/bodyspec/connections');
      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        setBodyspecConnections(connectionsData.connections || []);
      }

      // Load scans
      const scansRes = await fetch('/api/bodyspec/scans');
      if (scansRes.ok) {
        const scansData = await scansRes.json();
        setBodyspecScans(scansData.scans || []);
      }
    } catch (err) {
      console.error('Failed to load Bodyspec data:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        // First, try to migrate any localStorage data to cloud
        const migrated = await migrateFromLocalStorage();
        if (migrated > 0) {
          console.log(`Migrated ${migrated} entries from localStorage`);
        }

        // Check for pending images from iOS Shortcut
        const pendingImages = await getPendingImages();
        if (pendingImages.length > 0) {
          setIsLoading(true);
          setProgress(`Processing ${pendingImages.length} pending image(s)...`);

          for (let i = 0; i < pendingImages.length; i++) {
            const pending = pendingImages[i];
            try {
              setProgress(`Processing ${i + 1}/${pendingImages.length}...`);

              // Convert base64 to File
              const byteString = atob(pending.data);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let j = 0; j < byteString.length; j++) {
                ia[j] = byteString.charCodeAt(j);
              }
              const blob = new Blob([ab], { type: pending.content_type });
              const file = new File([blob], 'pending-image.png', { type: pending.content_type });

              // Process with OCR
              const { entry, rawText } = await parsePDFFile(file, (msg) => {
                setProgress(`(${i + 1}/${pendingImages.length}) ${msg}`);
              });

              // Save raw OCR text for debugging
              await saveOcrDebug(pending.id, rawText);

              const hasData = entry.weight > 0 || entry.bodyFatPercentage > 0 || entry.fitnessScore > 0;

              if (hasData) {
                await saveEntryToDb(entry);
              }

              // Delete processed image
              await deletePendingImage(pending.id);
            } catch (err) {
              console.error('Error processing pending image:', err);
              // Still delete to avoid re-processing bad images
              await deletePendingImage(pending.id);
            }
          }

          setProgress('');
          setIsLoading(false);
        }

        // Fetch entries and goals from cloud
        const [cloudEntries, cloudGoals] = await Promise.all([
          getEntriesFromDb(),
          getGoals(),
        ]);
        setEntries(cloudEntries);
        setGoals(cloudGoals);

        // Load Bodyspec data
        await loadBodyspecData();
      } catch (err) {
        console.error('Failed to load entries:', err);
        setError('Failed to load data. Please check your connection.');
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [loadBodyspecData]);

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

  const handleSaveGoal = useCallback(async (metricKey: string, targetValue: number) => {
    try {
      await saveGoal(metricKey, targetValue);
      const cloudGoals = await getGoals();
      setGoals(cloudGoals);
    } catch (err) {
      console.error('Save goal error:', err);
      setError('Failed to save goal');
    }
  }, []);

  const handleDeleteGoal = useCallback(async (metricKey: string) => {
    try {
      await deleteGoal(metricKey);
      const cloudGoals = await getGoals();
      setGoals(cloudGoals);
    } catch (err) {
      console.error('Delete goal error:', err);
      setError('Failed to delete goal');
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

        {/* Bodyspec Integration Section */}
        <section className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowBodyspecSection(!showBodyspecSection)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Bodyspec DEXA Integration
              </h2>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showBodyspecSection ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBodyspecSection && (
            <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4">
              {/* Connection status + sync button in one row */}
              <div className="flex items-center justify-between">
                <BodyspecConnect onConnectionChange={loadBodyspecData} />
                {bodyspecConnections.length > 0 && (
                  <BodyspecSyncButton
                    connection={bodyspecConnections[0]}
                    onSyncComplete={loadBodyspecData}
                  />
                )}
              </div>

              {/* Scan list with hide/show toggles */}
              {bodyspecScans.length > 0 && (
                <div className="space-y-1">
                  {bodyspecScans.map((scan) => {
                    const isHidden = hiddenScans.has(scan.id);
                    return (
                      <div
                        key={scan.id}
                        className={`flex items-center justify-between py-2 px-1 text-sm border-b border-gray-100 dark:border-gray-800 last:border-0 ${isHidden ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleScanVisibility(scan.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title={isHidden ? 'Show in table' : 'Hide from table'}
                          >
                            {isHidden ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                          <span className={`font-medium ${isHidden ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {new Date(scan.scanDate).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={isHidden ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}>
                          {scan.data.bodyFatPercentage.toFixed(1)}% • {scan.data.weight.toFixed(0)} lb
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              BIA Measurements
            </h2>
          </div>
          <DataTable
            entries={entries}
            goals={goals}
            bodyspecScans={visibleScans}
            onDelete={handleDelete}
            onSaveGoal={handleSaveGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        </section>
      </div>
    </div>
  );
}
