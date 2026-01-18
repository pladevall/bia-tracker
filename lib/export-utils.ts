import {
  BIAEntry,
  BodyspecScan,
  RunningActivity,
  LiftingWorkout,
  SleepEntry
} from './types';

export interface HealthDataExport {
  exportDate: string;
  exportVersion: string;
  data: {
    bia: BIAEntry[];
    bodyspec: BodyspecScan[];
    running: RunningActivity[];
    lifting: LiftingWorkout[];
    sleep: SleepEntry[];
  };
  summary: {
    totalBiaEntries: number;
    totalBodyspecScans: number;
    totalRunningActivities: number;
    totalLiftingWorkouts: number;
    totalSleepEntries: number;
    dateRange: {
      earliest: string | null;
      latest: string | null;
    };
  };
}

/**
 * Generate a comprehensive export of all health data
 */
export function generateHealthDataExport(
  bia: BIAEntry[],
  bodyspec: BodyspecScan[],
  running: RunningActivity[],
  lifting: LiftingWorkout[],
  sleep: SleepEntry[]
): HealthDataExport {
  // Calculate date range across all data
  const allDates = [
    ...bia.map(e => e.date),
    ...bodyspec.map(s => s.scanDate),
    ...running.map(r => r.activityDate),
    ...lifting.map(l => l.workoutDate),
    ...sleep.map(s => s.sleepDate),
  ].filter(Boolean).sort();

  return {
    exportDate: new Date().toISOString(),
    exportVersion: '1.0.0',
    data: {
      bia,
      bodyspec,
      running,
      lifting,
      sleep,
    },
    summary: {
      totalBiaEntries: bia.length,
      totalBodyspecScans: bodyspec.length,
      totalRunningActivities: running.length,
      totalLiftingWorkouts: lifting.length,
      totalSleepEntries: sleep.length,
      dateRange: {
        earliest: allDates[0] || null,
        latest: allDates[allDates.length - 1] || null,
      },
    },
  };
}

/**
 * Export data as JSON string
 */
export function exportAsJSON(data: HealthDataExport, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

/**
 * Helper to format seconds as MM:SS
 */
function formatTime(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper to format pace (seconds per mile) as MM:SS
 */
function formatPace(secondsPerMile: number | null | undefined): string {
  if (!secondsPerMile) return '';
  return formatTime(secondsPerMile);
}

/**
 * Export BIA data as CSV
 */
export function exportBIAAsCSV(entries: BIAEntry[]): string {
  if (entries.length === 0) return '';

  const headers = [
    'Date', 'Weight (lb)', 'BMI', 'Body Fat %', 'Body Fat Mass (lb)',
    'Skeletal Muscle (lb)', 'Visceral Fat', 'Fitness Score',
    'LBM (lb)', 'BMR (kcal)', 'Metabolic Age',
    'Body Water (L)', 'Protein (lb)', 'Bone Mass (lb)',
    'Muscle Left Arm (lb)', 'Muscle Right Arm (lb)', 'Muscle Trunk (lb)',
    'Muscle Left Leg (lb)', 'Muscle Right Leg (lb)',
    'Fat Left Arm (lb)', 'Fat Right Arm (lb)', 'Fat Trunk (lb)',
    'Fat Left Leg (lb)', 'Fat Right Leg (lb)',
  ];

  const rows = entries.map(e => [
    e.date,
    e.weight,
    e.bmi,
    e.bodyFatPercentage,
    e.bodyFatMass,
    e.skeletalMuscle,
    e.visceralFat,
    e.fitnessScore,
    e.lbm,
    e.bmr,
    e.metabolicAge,
    e.bodyWater,
    e.protein,
    e.boneMass,
    e.muscleLeftArm?.lb || '',
    e.muscleRightArm?.lb || '',
    e.muscleTrunk?.lb || '',
    e.muscleLeftLeg?.lb || '',
    e.muscleRightLeg?.lb || '',
    e.fatLeftArm?.lb || '',
    e.fatRightArm?.lb || '',
    e.fatTrunk?.lb || '',
    e.fatLeftLeg?.lb || '',
    e.fatRightLeg?.lb || '',
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

/**
 * Export Bodyspec scans as CSV
 */
export function exportBodyspecAsCSV(scans: BodyspecScan[]): string {
  if (scans.length === 0) return '';

  const headers = [
    'Date', 'Weight (lb)', 'Body Fat %', 'Total Body Fat (lb)',
    'Lean Body Mass (lb)', 'Bone Mineral Density', 'VAT (cm²)',
    'Left Arm Fat (lb)', 'Left Arm Lean (lb)',
    'Right Arm Fat (lb)', 'Right Arm Lean (lb)',
    'Trunk Fat (lb)', 'Trunk Lean (lb)',
    'Left Leg Fat (lb)', 'Left Leg Lean (lb)',
    'Right Leg Fat (lb)', 'Right Leg Lean (lb)',
  ];

  const rows = scans.map(s => [
    s.scanDate,
    s.data.weight,
    s.data.bodyFatPercentage,
    s.data.totalBodyFat,
    s.data.leanBodyMass,
    s.data.boneMineralDensity,
    s.data.visceralAdiposeTissue,
    s.data.regional.leftArm.fat,
    s.data.regional.leftArm.lean,
    s.data.regional.rightArm.fat,
    s.data.regional.rightArm.lean,
    s.data.regional.trunk.fat,
    s.data.regional.trunk.lean,
    s.data.regional.leftLeg.fat,
    s.data.regional.leftLeg.lean,
    s.data.regional.rightLeg.fat,
    s.data.regional.rightLeg.lean,
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

/**
 * Export running activities as CSV
 */
export function exportRunningAsCSV(activities: RunningActivity[]): string {
  if (activities.length === 0) return '';

  const headers = [
    'Date', 'Name', 'Distance (mi)', 'Duration', 'Pace (min/mi)',
    'Elevation Gain (ft)', 'Avg Heart Rate', 'Max Heart Rate',
    'Avg Cadence', 'Splits',
  ];

  const rows = activities.map(a => [
    a.activityDate,
    a.name || '',
    a.distanceMiles.toFixed(2),
    formatTime(a.durationSeconds),
    formatPace(a.averagePaceSeconds),
    a.elevationGainFeet || '',
    a.averageHeartrate || '',
    a.maxHeartrate || '',
    a.averageCadence || '',
    a.splits?.map(s => formatTime(s.timeSeconds)).join('; ') || '',
  ]);

  return [headers, ...rows].map(row => row.map(cell => {
    // Escape cells with commas or quotes
    const cellStr = String(cell);
    if (cellStr.includes(',') || cellStr.includes('"')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  }).join(',')).join('\n');
}

/**
 * Export lifting workouts as CSV
 */
export function exportLiftingAsCSV(workouts: LiftingWorkout[]): string {
  if (workouts.length === 0) return '';

  const headers = [
    'Date', 'Name', 'Duration', 'Total Sets', 'Total Reps',
    'Total Volume (lbs)', 'Exercises', 'Body Parts Worked',
  ];

  const rows = workouts.map(w => [
    w.workoutDate,
    w.name || '',
    formatTime(w.durationSeconds),
    w.totalSets,
    w.totalReps,
    w.totalVolumeLbs || '',
    w.exercises?.map(e => e.name).join('; ') || '',
    w.bodyParts ? Object.keys(w.bodyParts).join('; ') : '',
  ]);

  return [headers, ...rows].map(row => row.map(cell => {
    const cellStr = String(cell);
    if (cellStr.includes(',') || cellStr.includes('"')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  }).join(',')).join('\n');
}

/**
 * Export sleep data as CSV
 */
export function exportSleepAsCSV(entries: SleepEntry[]): string {
  if (entries.length === 0) return '';

  const headers = [
    'Date', 'Sleep Score', 'Duration Score', 'Bedtime Score', 'Interruption Score',
    'Total Sleep (hrs)', 'Time in Bed (hrs)', 'Deep Sleep (min)', 'REM Sleep (min)',
    'Core Sleep (min)', 'Awake Time (min)', 'Wake-ups', 'Sleep Start', 'Sleep End',
  ];

  const rows = entries.map(e => [
    e.sleepDate,
    e.sleepScore,
    e.durationScore,
    e.bedtimeScore,
    e.interruptionScore,
    (e.data.stages.totalSleepMinutes / 60).toFixed(1),
    (e.data.stages.inBedMinutes / 60).toFixed(1),
    e.data.stages.deepMinutes,
    e.data.stages.remMinutes,
    e.data.stages.coreMinutes,
    e.data.stages.awakeMinutes,
    e.data.interruptions.wakeUpsCount || e.data.interruptions.count || '',
    e.data.sleepStart,
    e.data.sleepEnd,
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

/**
 * Generate a multi-sheet CSV export (as a zip would require additional library)
 * Returns an object with separate CSV strings for each data type
 */
export interface MultiCSVExport {
  bia: string;
  bodyspec: string;
  running: string;
  lifting: string;
  sleep: string;
}

export function generateMultiCSVExport(
  bia: BIAEntry[],
  bodyspec: BodyspecScan[],
  running: RunningActivity[],
  lifting: LiftingWorkout[],
  sleep: SleepEntry[]
): MultiCSVExport {
  return {
    bia: exportBIAAsCSV(bia),
    bodyspec: exportBodyspecAsCSV(bodyspec),
    running: exportRunningAsCSV(running),
    lifting: exportLiftingAsCSV(lifting),
    sleep: exportSleepAsCSV(sleep),
  };
}

/**
 * Download helper for browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download JSON export
 */
export function downloadJSONExport(data: HealthDataExport): void {
  const json = exportAsJSON(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(json, `baseline-health-data-${timestamp}.json`, 'application/json');
}

/**
 * Download individual CSV files
 */
export function downloadCSVExports(csvData: MultiCSVExport): void {
  const timestamp = new Date().toISOString().split('T')[0];

  if (csvData.bia) {
    downloadFile(csvData.bia, `baseline-bia-${timestamp}.csv`, 'text/csv');
  }
  if (csvData.bodyspec) {
    downloadFile(csvData.bodyspec, `baseline-bodyspec-${timestamp}.csv`, 'text/csv');
  }
  if (csvData.running) {
    downloadFile(csvData.running, `baseline-running-${timestamp}.csv`, 'text/csv');
  }
  if (csvData.lifting) {
    downloadFile(csvData.lifting, `baseline-lifting-${timestamp}.csv`, 'text/csv');
  }
  if (csvData.sleep) {
    downloadFile(csvData.sleep, `baseline-sleep-${timestamp}.csv`, 'text/csv');
  }
}
