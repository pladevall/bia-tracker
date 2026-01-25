'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// FileUpload import removed as it is now used inside IntegrationTabs
import DataTable from '@/components/DataTable';
import IntegrationTabs from '@/components/IntegrationTabs';
import WorkoutTable from '@/components/WorkoutTable';
import { SleepTable } from '@/components/SleepTable';
import ValidationWarning from '@/components/ValidationWarning';
import { BIAEntry, BodyspecScan, RunningActivity, LiftingWorkout, SleepEntry, CorrelationResult, Insight } from '@/lib/types';
import { parsePDFFile } from '@/lib/client-pdf-parser';
import { ValidationIssue } from '@/lib/pdf-parser';
import ThemeToggle from '@/components/ThemeToggle';
import { getEntriesFromDb, saveEntryToDb, deleteEntryFromDb, migrateFromLocalStorage, getPendingImages, deletePendingImage, saveOcrDebug, getGoals, saveGoal, deleteGoal, Goal } from '@/lib/supabase';
import { correlateMeasurements } from '@/lib/correlation-utils';
import { generateVolumeEfficiencyInsights, generateBalanceInsights, generatePeriodizationInsights } from '@/lib/correlation-insights';
import { analyzeBodyPartBalance } from '@/lib/correlation-utils';
import { useBaselineData } from '@/lib/use-baseline-data';
import ViewToggle, { ViewMode } from '@/components/ViewToggle';

export default function Home() {
  // SWR cached data for instant navigation
  const { data: cachedData, isLoading: isCacheLoading, refresh: refreshCache } = useBaselineData();

  // Local state that can be mutated (initialized from cache)
  const [entries, setEntries] = useState<BIAEntry[]>([]);
  const [bodyspecScans, setBodyspecScans] = useState<BodyspecScan[]>([]);
  const [bodyspecConnections, setBodyspecConnections] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  // Workout tracking state
  const [stravaConnections, setStravaConnections] = useState<any[]>([]);
  const [hevyConnections, setHevyConnections] = useState<any[]>([]);
  const [runningActivities, setRunningActivities] = useState<RunningActivity[]>([]);
  const [liftingWorkouts, setLiftingWorkouts] = useState<LiftingWorkout[]>([]);
  // Sleep tracking state
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  // Correlation tracking state
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);

  // Sync local state from SWR cache when it updates
  useEffect(() => {
    if (cachedData.entries.length > 0 || cachedData.bodyspecScans.length > 0) {
      setEntries(cachedData.entries);
      setBodyspecScans(cachedData.bodyspecScans);
      setBodyspecConnections(cachedData.bodyspecConnections);
      setGoals(cachedData.goals);
      setStravaConnections(cachedData.stravaConnections);
      setHevyConnections(cachedData.hevyConnections);
      setRunningActivities(cachedData.runningActivities);
      setLiftingWorkouts(cachedData.liftingWorkouts);
      setSleepEntries(cachedData.sleepEntries);
    }
  }, [cachedData]);

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

  // Validation state
  const [validationState, setValidationState] = useState<{
    issues: ValidationIssue[];
    entry: BIAEntry;
    rawText: string;
    fileIndex: number;
    totalFiles: number;
  } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

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

  const showOnlyLatest = useCallback(() => {
    if (bodyspecScans.length === 0) return;

    // Check if we're currently showing only 1 scan - if so, show all
    const visibleCount = bodyspecScans.filter(s => !hiddenScans.has(s.id)).length;
    if (visibleCount === 1) {
      setHiddenScans(new Set());
      localStorage.setItem('hiddenBodyspecScans', JSON.stringify([]));
      return;
    }

    // Otherwise hide all but latest
    const sortedByDate = [...bodyspecScans].sort((a, b) =>
      new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime()
    );
    const toHide = sortedByDate.slice(1).map(s => s.id);
    setHiddenScans(new Set(toHide));
    localStorage.setItem('hiddenBodyspecScans', JSON.stringify(toHide));
  }, [bodyspecScans, hiddenScans]);

  const visibleScans = bodyspecScans.filter(scan => !hiddenScans.has(scan.id));


  const router = useRouter();

  // View Mode State
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // Load view mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('baselineViewMode');
    if (saved && ['all', 'workouts', 'sleep', 'measurements'].includes(saved)) {
      setViewMode(saved as ViewMode);
    }
  }, []);

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('baselineViewMode', mode);
  }, []);

  const shouldShowSection = useCallback((section: ViewMode) => {
    if (viewMode === 'all') return true;
    return viewMode === section;
  }, [viewMode]);

  // Keyboard shortcuts: Cmd+Shift+C for Calendar, Cmd+Shift+P for Actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'C' || e.key === 'c') {
          e.preventDefault();
          router.push('/calendar');
        } else if (e.key === 'P' || e.key === 'p') {
          e.preventDefault();
          router.push('/actions');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // When scans load, if no localStorage exists OR if it's empty, auto-hide all but the most recent scan
  useEffect(() => {
    if (bodyspecScans.length > 0) {
      const saved = localStorage.getItem('hiddenBodyspecScans');

      // Only auto-hide if there's no saved preference at all
      // (not just empty array - that means user explicitly showed all)
      if (saved === null) {
        const sortedByDate = [...bodyspecScans].sort((a, b) =>
          new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime()
        );
        const toHide = sortedByDate.slice(1).map(s => s.id);
        setHiddenScans(new Set(toHide));
        localStorage.setItem('hiddenBodyspecScans', JSON.stringify(toHide));
      }
    }
  }, [bodyspecScans]);

  const loadBodyspecData = useCallback(async (options?: { autoSync?: boolean }) => {
    try {
      // Load connections
      const connectionsRes = await fetch('/api/bodyspec/connections');
      let connections: any[] = [];
      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        connections = connectionsData.connections || [];
        setBodyspecConnections(connections);
      }

      // If autoSync is requested and we have a connection, trigger sync first
      if (options?.autoSync && connections.length > 0) {
        try {
          await fetch('/api/bodyspec/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: connections[0].id }),
          });
        } catch (syncErr) {
          console.error('Auto-sync failed:', syncErr);
        }
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

  const loadWorkoutData = useCallback(async () => {
    try {
      // Load Strava connections and activities
      const [stravaConnRes, stravaActivitiesRes] = await Promise.all([
        fetch('/api/strava/connections'),
        fetch('/api/strava/activities'),
      ]);

      if (stravaConnRes.ok) {
        const data = await stravaConnRes.json();
        setStravaConnections(data.connections || []);
      }
      if (stravaActivitiesRes.ok) {
        const data = await stravaActivitiesRes.json();
        setRunningActivities(data.activities || []);
      }

      // Load Hevy connections and workouts
      const [hevyConnRes, hevyWorkoutsRes] = await Promise.all([
        fetch('/api/hevy/connections'),
        fetch('/api/hevy/workouts'),
      ]);

      if (hevyConnRes.ok) {
        const data = await hevyConnRes.json();
        setHevyConnections(data.connections || []);
      }
      if (hevyWorkoutsRes.ok) {
        const data = await hevyWorkoutsRes.json();
        setLiftingWorkouts(data.workouts || []);
      }
    } catch (err) {
      console.error('Failed to load workout data:', err);
    }
  }, []);

  const loadSleepData = useCallback(async () => {
    try {
      const res = await fetch('/api/sleep/entries?limit=30');
      if (res.ok) {
        const data = await res.json();
        setSleepEntries(data);
      }
    } catch (err) {
      console.error('Failed to load sleep data:', err);
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

        // Pull latest entry for OCR validation before processing pending images
        const existingEntries = await getEntriesFromDb();
        let latestEntryForOcr = existingEntries[0];

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
              }, latestEntryForOcr);

              // Save raw OCR text for debugging
              await saveOcrDebug(pending.id, rawText);

              const hasData = entry.weight > 0 || entry.bodyFatPercentage > 0 || entry.fitnessScore > 0;

              if (hasData) {
                await saveEntryToDb(entry);
                latestEntryForOcr = entry;
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

        // Load workout data
        await loadWorkoutData();

        // Load sleep data
        await loadSleepData();
      } catch (err) {
        console.error('Failed to load entries:', err);
        setError('Failed to load data. Please check your connection.');
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [loadBodyspecData, loadWorkoutData, loadSleepData]);

  // Compute correlations when entries, bodyspec scans, or workouts change
  useEffect(() => {
    if ((entries.length > 0 || bodyspecScans.length > 0) && liftingWorkouts.length > 0) {
      const allMeasurements = [...entries, ...bodyspecScans];
      const results = correlateMeasurements(allMeasurements, liftingWorkouts, 4);
      setCorrelations(results);
    } else {
      setCorrelations([]);
    }
  }, [entries, bodyspecScans, liftingWorkouts]);

  // Generate insights when correlations change
  useEffect(() => {
    if (correlations.length === 0) {
      setInsights([]);
      return;
    }

    const latest = correlations[0]; // Most recent period
    const generatedInsights: Insight[] = [
      ...generateVolumeEfficiencyInsights(latest),
      ...generateBalanceInsights(analyzeBodyPartBalance(latest)),
      ...generatePeriodizationInsights(correlations),
    ];

    setInsights(generatedInsights);
  }, [correlations]);

  const processNextFile = useCallback(
    async (filesToProcess: File[], startIndex: number, skipped: Set<number>, failed: number) => {
      if (startIndex >= filesToProcess.length) {
        // Done processing all files
        const cloudEntries = await getEntriesFromDb();
        setEntries(cloudEntries);
        setProgress('');
        setIsLoading(false);
        setValidationState(null);
        setPendingFiles([]);

        const processed = filesToProcess.length - failed;
        if (failed > 0) {
          setError(`Processed ${processed}/${filesToProcess.length} images. ${failed} skipped or failed to parse.`);
        }
        return;
      }

      const file = filesToProcess[startIndex];
      const processed = startIndex + 1;
      const total = filesToProcess.length;

      setProgress(`Processing ${processed}/${total}...`);
      setCurrentFileIndex(startIndex);

      try {
        const previousEntry = entries.length > 0 ? entries[0] : undefined;
        const { entry, validationIssues, rawText } = await parsePDFFile(file, (msg) => {
          setProgress(`(${processed}/${total}) ${msg}`);
        }, previousEntry);

        const hasData = entry.weight > 0 || entry.bodyFatPercentage > 0 || entry.fitnessScore > 0;

        if (!hasData) {
          await processNextFile(filesToProcess, startIndex + 1, skipped, failed + 1);
          return;
        }

        // If validation issues found, show warning
        if (validationIssues && validationIssues.length > 0) {
          setValidationState({
            issues: validationIssues,
            entry,
            rawText,
            fileIndex: startIndex,
            totalFiles: total,
          });
          return; // Wait for user response
        }

        // No issues, save directly
        setProgress(`(${processed}/${total}) Saving to cloud...`);
        await saveEntryToDb(entry);
        await processNextFile(filesToProcess, startIndex + 1, skipped, failed);
      } catch (err) {
        console.error('Error processing file:', err);
        await processNextFile(filesToProcess, startIndex + 1, skipped, failed + 1);
      }
    },
    [entries]
  );

  const handleValidationConfirm = useCallback(async () => {
    if (!validationState) return;

    try {
      setProgress(
        `(${validationState.fileIndex + 1}/${validationState.totalFiles}) Saving to cloud...`
      );
      await saveEntryToDb(validationState.entry);

      // Process next file
      await processNextFile(
        pendingFiles,
        validationState.fileIndex + 1,
        new Set(),
        0
      );
    } catch (err) {
      console.error('Error saving entry:', err);
      setError('Failed to save entry');
    }
  }, [validationState, pendingFiles, processNextFile]);

  const handleValidationSkip = useCallback(async () => {
    if (!validationState) return;

    // Skip this file and process next
    await processNextFile(
      pendingFiles,
      validationState.fileIndex + 1,
      new Set(),
      1
    );
  }, [validationState, pendingFiles, processNextFile]);

  const handleValidationReview = useCallback(() => {
    if (!validationState) return;
    alert('Raw OCR Text:\n\n' + validationState.rawText);
  }, [validationState]);

  const handleUpload = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    setPendingFiles(files);
    setCurrentFileIndex(0);

    await processNextFile(files, 0, new Set(), 0);
  }, [processNextFile]);

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

  const handleBodyspecDisconnect = useCallback(async (connectionId: string) => {
    try {
      const response = await fetch('/api/bodyspec/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      // Refresh data
      await loadBodyspecData();
    } catch (err) {
      console.error('Disconnect error:', err);
      setError('Failed to disconnect');
    }
  }, [loadBodyspecData]);

  // Only show loading spinner if we don't have cached data
  const hasCachedData = cachedData.entries.length > 0 || cachedData.bodyspecScans.length > 0 || cachedData.sleepEntries.length > 0;

  if (isInitializing && !hasCachedData) {
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
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Baseline</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Unified fitness metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="h-5 w-px bg-gray-200 dark:bg-gray-700/60" aria-hidden="true" />
            <Link
              href="/actions"
              title="Actions (Cmd+Shift+P)"
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </Link>
            <Link
              href="/calendar"
              title="Calendar (Cmd+Shift+C)"
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </Link>
          </div>
        </header>




        {/* Workouts Section */}
        {shouldShowSection('workouts') && (runningActivities.length > 0 || liftingWorkouts.length > 0) && (
          <section className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center min-h-[50px]">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Workouts
              </h2>
              {(viewMode === 'all' || viewMode === 'workouts') && (
                <ViewToggle viewMode={viewMode} onViewChange={handleViewChange} />
              )}
            </div>
            <WorkoutTable
              runningActivities={runningActivities}
              liftingWorkouts={liftingWorkouts}
              goals={goals}
              onSaveGoal={handleSaveGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          </section>
        )}

        {/* Sleep Section */}
        {shouldShowSection('sleep') && sleepEntries.length > 0 && (
          <section className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center min-h-[50px]">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Sleep
              </h2>
              {viewMode === 'sleep' && (
                <ViewToggle viewMode={viewMode} onViewChange={handleViewChange} />
              )}
            </div>
            <div>
              <SleepTable
                entries={sleepEntries}
                goals={goals}
                onSaveGoal={handleSaveGoal}
                onDeleteGoal={handleDeleteGoal}
              />
            </div>
          </section>
        )}

        {/* Measurements Section */}
        {shouldShowSection('measurements') && (
          <section className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center min-h-[50px]">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Measurements
              </h2>
              {viewMode === 'measurements' && (
                <ViewToggle viewMode={viewMode} onViewChange={handleViewChange} />
              )}
            </div>
            <DataTable
              entries={entries}
              goals={goals}
              bodyspecScans={visibleScans}
              correlations={correlations}
              insights={insights}
              onDelete={handleDelete}
              onSaveGoal={handleSaveGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          </section>
        )}

        {/* Unified Integrations Section - Only show in 'all' mode or specific modes if desired? 
            Let's keep it visible in 'all' mode, maybe hide in focused modes to reduce clutter. 
            User didn't specify, but "Compact Mode" implies focus. 
        */}
        {viewMode === 'all' && (
          <IntegrationTabs
            onUpload={handleUpload}
            isUploading={isLoading}
            uploadProgress={progress}
            uploadError={error}
            bodyspecConnections={bodyspecConnections}
            bodyspecScans={bodyspecScans}
            hiddenScans={hiddenScans}
            onBodyspecConnectionChange={loadBodyspecData}
            onBodyspecDisconnect={handleBodyspecDisconnect}
            onBodyspecSync={() => loadBodyspecData()}
            onToggleScanVisibility={toggleScanVisibility}
            onShowOnlyLatest={showOnlyLatest}
            stravaConnections={stravaConnections}
            onStravaConnectionChange={loadWorkoutData}
            hevyConnections={hevyConnections}
            onHevyConnectionChange={loadWorkoutData}
            runningActivities={runningActivities}
            liftingWorkouts={liftingWorkouts}
            onWorkoutSync={loadWorkoutData}
          />
        )}

        {/* Validation Warning Modal */}
        {validationState && (
          <ValidationWarning
            issues={validationState.issues}
            entry={validationState.entry}
            onConfirm={handleValidationConfirm}
            onReview={handleValidationReview}
            onSkip={handleValidationSkip}
          />
        )}
      </div>
    </div>
  );
}
