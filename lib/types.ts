export interface SegmentalData {
  lb: number;
  percent: number;
}

export interface BIAEntry {
  id: string;
  date: string;

  // Header
  name: string;
  age: number;
  gender: string;
  height: string;
  fitnessScore: number;

  // Core Metrics
  weight: number;
  bmi: number;
  bodyFatPercentage: number;
  visceralFat: number;
  skeletalMuscle: number;

  // Body Composition
  bodyWater: number;
  protein: number;
  boneMass: number;
  bodyFatMass: number;
  softLeanMass: number;
  fatFreeMass: number;

  // Additional Data
  lbm: number;
  bmr: number;
  metabolicAge: number;
  subcutaneousFatPercentage: number;
  muscleMassPercentage: number;
  skeletalMusclePercentage: number;
  boneMassPercentage: number;
  proteinPercentage: number;
  bodyWaterPercentage: number;
  smi: number;
  waistHipRatio: number;

  // Segmental Muscle (Soft Lean Mass)
  muscleLeftArm: SegmentalData;
  muscleRightArm: SegmentalData;
  muscleTrunk: SegmentalData;
  muscleLeftLeg: SegmentalData;
  muscleRightLeg: SegmentalData;

  // Segmental Fat
  fatLeftArm: SegmentalData;
  fatRightArm: SegmentalData;
  fatTrunk: SegmentalData;
  fatLeftLeg: SegmentalData;
  fatRightLeg: SegmentalData;

  // Categories
  bodyShape: string;
  bmiCategory: string;
  pbfCategory: string;

  // Weight Control Recommendations
  normalWeight: number;
  weightControl: number;
  fatMassControl: number;
  muscleControl: number;
}

export interface NormalRange {
  min: number;
  max: number;
}

export interface MetricDefinition {
  key: keyof BIAEntry;
  label: string;
  unit: string;
  normalRange?: NormalRange;
  higherIsBetter?: boolean;
  category: 'header' | 'core' | 'composition' | 'additional' | 'segmental-muscle' | 'segmental-fat' | 'recommendations';
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Header
  { key: 'fitnessScore', label: 'Fitness Score', unit: '/100', higherIsBetter: true, category: 'header' },

  // Core Metrics
  { key: 'weight', label: 'Weight', unit: 'lb', normalRange: { min: 136.6, max: 184.6 }, higherIsBetter: false, category: 'core' },
  { key: 'bodyFatPercentage', label: 'Body Fat %', unit: '%', normalRange: { min: 6, max: 25 }, higherIsBetter: false, category: 'core' },
  { key: 'bodyFatMass', label: 'Body Fat Mass', unit: 'lb', normalRange: { min: 19.4, max: 39 }, higherIsBetter: false, category: 'core' },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²', normalRange: { min: 18.5, max: 25 }, higherIsBetter: false, category: 'core' },
  { key: 'skeletalMuscle', label: 'Skeletal Muscle', unit: 'lb', normalRange: { min: 69.6, max: 85 }, higherIsBetter: true, category: 'core' },

  // Body Composition
  { key: 'bodyWater', label: 'Body Water', unit: 'L', normalRange: { min: 39, max: 50.7 }, higherIsBetter: true, category: 'composition' },
  { key: 'protein', label: 'Protein', unit: 'lb', normalRange: { min: 24.6, max: 30 }, higherIsBetter: true, category: 'composition' },
  { key: 'boneMass', label: 'Bone Mass', unit: 'lb', normalRange: { min: 6.6, max: 11 }, higherIsBetter: true, category: 'composition' },
  { key: 'softLeanMass', label: 'Soft Lean Mass', unit: 'lb', higherIsBetter: true, category: 'composition' },
  { key: 'fatFreeMass', label: 'Fat Free Mass', unit: 'lb', higherIsBetter: true, category: 'composition' },

  // Additional Data
  { key: 'visceralFat', label: 'Visceral Fat', unit: '', normalRange: { min: 1, max: 10 }, higherIsBetter: false, category: 'additional' },
  { key: 'lbm', label: 'LBM (Fat-free Body Weight)', unit: 'lb', normalRange: { min: 124.2, max: 151.8 }, higherIsBetter: true, category: 'additional' },
  { key: 'bmr', label: 'BMR (Basal Metabolic Rate)', unit: 'kcal', normalRange: { min: 1657, max: 1945.6 }, higherIsBetter: true, category: 'additional' },
  { key: 'subcutaneousFatPercentage', label: 'Subcutaneous Fat %', unit: '%', normalRange: { min: 8.6, max: 16.7 }, higherIsBetter: false, category: 'additional' },
  { key: 'muscleMassPercentage', label: 'Muscle Mass %', unit: '%', normalRange: { min: 67.3, max: 82.3 }, higherIsBetter: true, category: 'additional' },
  { key: 'skeletalMusclePercentage', label: 'Skeletal Muscle %', unit: '%', normalRange: { min: 40.5, max: 49.5 }, higherIsBetter: true, category: 'additional' },
  { key: 'boneMassPercentage', label: 'Bone Mass %', unit: '%', normalRange: { min: 3.8, max: 6.4 }, higherIsBetter: true, category: 'additional' },
  { key: 'proteinPercentage', label: 'Protein %', unit: '%', normalRange: { min: 14.3, max: 17.4 }, higherIsBetter: true, category: 'additional' },
  { key: 'bodyWaterPercentage', label: 'Body Water %', unit: '%', normalRange: { min: 50, max: 65 }, higherIsBetter: true, category: 'additional' },
  { key: 'smi', label: 'SMI', unit: '', normalRange: { min: 7, max: 8.6 }, higherIsBetter: true, category: 'additional' },
  { key: 'waistHipRatio', label: 'Waist-Hip Ratio', unit: '', normalRange: { min: 0, max: 0.9 }, higherIsBetter: false, category: 'additional' },
  { key: 'metabolicAge', label: 'Metabolic Age', unit: 'years', higherIsBetter: false, category: 'additional' },

  // Weight Control (these are targets/recommendations, not tracked metrics)
  { key: 'normalWeight', label: 'Target Weight', unit: 'lb', category: 'recommendations' },
  { key: 'weightControl', label: 'Weight Control', unit: 'lb', category: 'recommendations' },
  { key: 'fatMassControl', label: 'Fat Mass Control', unit: 'lb', category: 'recommendations' },
  { key: 'muscleControl', label: 'Muscle Control', unit: 'lb', category: 'recommendations' },
];

export const CATEGORY_LABELS: Record<MetricDefinition['category'], string> = {
  'header': 'Overview',
  'core': 'Core Metrics',
  'composition': 'Body Composition',
  'additional': 'Additional Data',
  'segmental-muscle': 'Segmental Muscle',
  'segmental-fat': 'Segmental Fat',
  'recommendations': 'Weight Control',
};

// ========================================
// Bodyspec Types
// ========================================

export interface BodyspecConnection {
  id: string;
  userId?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  tokenName: string;
  lastSync: string | null;
  syncStatus: 'connected' | 'error' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface BodyspecScan {
  id: string;
  connectionId: string;
  scanDate: string;
  appointmentId: string | null;
  data: BodyspecScanData;
  createdAt: string;
  updatedAt: string;
}

export interface RegionalData {
  fat: number;      // lb
  lean: number;     // lb
  bmd?: number;     // Bone mineral density
}

export interface BodyspecScanData {
  // Core metrics that map to BIA
  bodyFatPercentage: number;
  totalBodyFat: number;        // lb
  leanBodyMass: number;        // lb
  boneMineralDensity: number;
  visceralAdiposeTissue: number; // VAT (cm²)
  weight: number;              // lb

  // Regional breakdowns
  regional: {
    leftArm: RegionalData;
    rightArm: RegionalData;
    trunk: RegionalData;
    leftLeg: RegionalData;
    rightLeg: RegionalData;
  };

  // Additional DEXA metrics
  androidGynoidRatio?: number;
  boneMineralContent?: number;  // grams
  tScore?: number;              // Bone density T-score
  zScore?: number;              // Bone density Z-score
}

// Data source types for comparison views
export type DataSource = 'bia' | 'bodyspec';

export interface ComparisonEntry {
  date: string;
  source: DataSource;
  biaData?: BIAEntry;
  bodyspecData?: BodyspecScan;
}

// Metric mapping between BIA and Bodyspec
export interface MetricMapping {
  biaKey: keyof BIAEntry;
  bodyspecKey: keyof BodyspecScanData | string; // string for nested paths like 'regional.trunk.fat'
  label: string;
  unit: string;
  expectedVariance?: number; // Expected % difference between BIA and DEXA
}

export const BODYSPEC_BIA_MAPPINGS: MetricMapping[] = [
  {
    biaKey: 'bodyFatPercentage',
    bodyspecKey: 'bodyFatPercentage',
    label: 'Body Fat %',
    unit: '%',
    expectedVariance: 3, // BIA can vary ±3% from DEXA
  },
  {
    biaKey: 'weight',
    bodyspecKey: 'weight',
    label: 'Weight',
    unit: 'lb',
    expectedVariance: 0.5,
  },
  {
    biaKey: 'lbm',
    bodyspecKey: 'leanBodyMass',
    label: 'Lean Body Mass',
    unit: 'lb',
    expectedVariance: 5,
  },
  {
    biaKey: 'visceralFat',
    bodyspecKey: 'visceralAdiposeTissue',
    label: 'Visceral Fat',
    unit: '',
    expectedVariance: 10,
  },
];

// Metrics that can have goals
export const GOAL_ELIGIBLE_METRICS: (keyof BIAEntry)[] = [
  'weight',
  'bodyFatPercentage',
  'bodyFatMass',
  'skeletalMuscle',
  'muscleLeftArm',
  'muscleRightArm',
  'muscleTrunk',
  'muscleLeftLeg',
  'muscleRightLeg',
];

// ========================================
// Strava Types (Running)
// ========================================

export interface StravaConnection {
  id: string;
  userId?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  athleteId: string;
  athleteName: string | null;
  lastSync: string | null;
  syncStatus: 'connected' | 'error' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface RunningSplit {
  mile: number;           // Mile number (1, 2, 3, ...)
  timeSeconds: number;    // Time for this mile in seconds
  cumulativeSeconds: number; // Total time at this mile
}

export interface RunningActivity {
  id: string;
  connectionId: string;
  stravaId: string;
  activityDate: string;
  name: string | null;
  distanceMiles: number;
  durationSeconds: number;
  elevationGainFeet: number | null;
  elevHighFeet: number | null;
  elevLowFeet: number | null;
  averagePaceSeconds: number | null;  // Seconds per mile
  averageHeartrate: number | null;    // bpm
  maxHeartrate: number | null;        // bpm
  averageCadence: number | null;      // steps per minute
  splits: RunningSplit[] | null;
  createdAt: string;
  updatedAt: string;
}

// Standard distance milestones for displaying split times
export const RUNNING_MILESTONES = [
  { key: '1mi', label: '1 Mile', miles: 1 },
  { key: '2mi', label: '2 Miles', miles: 2 },
  { key: '5k', label: '5K', miles: 3.10686 },
  { key: '5mi', label: '5 Miles', miles: 5 },
  { key: '10k', label: '10K', miles: 6.21371 },
  { key: '10mi', label: '10 Miles', miles: 10 },
  { key: 'half', label: 'Half Marathon', miles: 13.1094 },
  { key: 'marathon', label: 'Marathon', miles: 26.2188 },
] as const;

// ========================================
// Hevy Types (Lifting)
// ========================================

export interface HevyConnection {
  id: string;
  userId?: string;
  apiKey: string;
  connectionName: string;
  lastSync: string | null;
  syncStatus: 'connected' | 'error' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface BodyPartStats {
  sets: number;
  reps: number;
  volumeLbs?: number;  // Total weight lifted for this body part
}

export interface LiftingExercise {
  name: string;
  bodyPart: string;
  sets: number;
  reps: number;
  weightLbs: number | null;
}

export interface LiftingWorkout {
  id: string;
  connectionId: string;
  hevyId: string;
  workoutDate: string;
  name: string | null;
  totalSets: number;
  durationSeconds: number;
  totalReps: number;
  totalVolumeLbs: number | null;

  bodyParts: Record<string, BodyPartStats> | null;
  exercises: LiftingExercise[] | null;
  exercisesDetailed: LiftingExerciseDetailed[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiftingSetDetail {
  index: number;
  type: 'normal' | 'warmup' | 'dropset' | 'failure';
  weightLbs: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface LiftingExerciseDetailed {
  name: string;
  bodyPart: string;
  sets: LiftingSetDetail[];
}

// Body parts tracked in lifting workouts
export const BODY_PARTS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
] as const;

export type BodyPart = typeof BODY_PARTS[number];

// ========================================
// Workout Table Types
// ========================================

export type WorkoutType = 'run' | 'lifting' | 'all';
export type VolumePeriod = 'WTD' | 'MTD' | 'QTD' | 'YTD' | 'PY';

export interface WorkoutEntry {
  date: string;
  type: 'run' | 'lifting';
  runningActivity?: RunningActivity;
  liftingWorkout?: LiftingWorkout;
}

// ========================================
// Sleep Tracking Types
// ========================================

export interface SleepStages {
  awakeMinutes: number;
  remMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  inBedMinutes: number;
  totalSleepMinutes: number;
}

export interface SleepScoreBreakdown {
  duration: { score: number; max: number };
  bedtime: { score: number; max: number };
  interruptions: { score: number; max: number };
}

export interface SleepEntry {
  id: string;
  sleepDate: string;
  sleepScore: number;
  durationScore: number;
  bedtimeScore: number;
  interruptionScore: number;
  data: {
    stages: SleepStages;
    interruptions: { count: number; totalMinutes: number };
    scoreBreakdown?: SleepScoreBreakdown;
    sleepStart: string;
    sleepEnd: string;
    samples?: any[]; // Raw samples if needed
  };
  createdAt?: string;
}

export interface SleepUserPreferences {
  targetBedtime: string;
  targetWakeTime: string;
  targetDurationMinutes: number;
  bedtimeWindowMinutes: number;
}
