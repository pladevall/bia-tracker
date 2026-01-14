/**
 * Workout Generator
 *
 * Generates intelligent next workout suggestions based on user's goals and history.
 */

import { LiftingWorkout, LiftingExerciseDetailed, RunningActivity } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Muscle groups for lifting workout generation
 * Maps display names to codebase body part names
 */
export const LIFTING_MUSCLE_GROUPS = {
  'Chest': 'chest',
  'Abdominals': 'core',
  'Biceps': 'biceps',
  'Triceps': 'triceps',
  'Shoulders': 'shoulders',
  'Quads': 'quadriceps',
  'Hamstring': 'hamstrings',
  'Glutes': 'glutes',
} as const;

export type LiftingMuscleGroup = keyof typeof LIFTING_MUSCLE_GROUPS;

/**
 * Running workout types
 */
export const RUNNING_WORKOUT_TYPES = [
  'Easy Run',
  'Long Run',
  'Tempo Run',
  'Intervals',
  'Hill Repeats',
  'Fartlek',
  'Recovery',
] as const;

export type RunningWorkoutType = typeof RUNNING_WORKOUT_TYPES[number];

/**
 * A single set recommendation
 */
export interface GeneratedSet {
  weightLbs: number;
  targetReps: number;
  notes?: string;
}

/**
 * A single exercise recommendation
 */
export interface GeneratedExercise {
  name: string;
  bodyPart: string;
  sets: GeneratedSet[];
  exerciseTemplateId?: string; // For Push to Hevy
}

/**
 * Complete generated lifting workout
 */
export interface GeneratedLiftingWorkout {
  name: string;
  muscleGroups: string[];
  exercises: GeneratedExercise[];
  totalSets: number;
  folderName: string;
}

/**
 * Generated running workout
 */
export interface GeneratedRunningWorkout {
  type: RunningWorkoutType;
  name: string;
  distanceMiles: number;
  targetPaceSeconds: number; // seconds per mile
  estimatedDurationSeconds: number;
  projectedAvgHeartrate: number | null;
  projectedMaxHeartrate: number | null;
  projectedCadence: number | null;
  notes?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/**
 * Get a date key in YYYY-MM-DD format
 */
function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// Lifting Workout Generator
// =============================================================================

/**
 * Calculate sets per muscle group for the current week
 */
export function getWeeklySetsPerMuscleGroup(
  workouts: LiftingWorkout[],
  weekStart: Date = getWeekStart()
): Record<string, number> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const setsPerGroup: Record<string, number> = {};

  // Initialize all tracked muscle groups to 0
  Object.values(LIFTING_MUSCLE_GROUPS).forEach(bodyPart => {
    setsPerGroup[bodyPart] = 0;
  });

  // Sum up sets from this week's workouts
  workouts.forEach(workout => {
    const workoutDate = new Date(workout.workoutDate);
    if (workoutDate >= weekStart && workoutDate <= weekEnd) {
      if (workout.bodyParts) {
        Object.entries(workout.bodyParts).forEach(([part, stats]) => {
          if (setsPerGroup[part] !== undefined) {
            setsPerGroup[part] += stats.sets;
          }
        });
      }
    }
  });

  return setsPerGroup;
}

/**
 * Select which muscle groups to target in the next workout
 * Prioritizes groups that haven't hit 16 sets this week
 */
export function selectMuscleGroups(
  weeklySets: Record<string, number>,
  targetSetsPerWeek: number = 16,
  groupsToSelect: number = 3
): string[] {
  // Get eligible muscle groups (only the 8 specified)
  const eligibleGroups = Object.values(LIFTING_MUSCLE_GROUPS);

  // Sort by sets (lowest first) to prioritize groups needing more work
  const sortedGroups = eligibleGroups
    .map(group => ({
      group,
      sets: weeklySets[group] || 0,
      deficit: targetSetsPerWeek - (weeklySets[group] || 0)
    }))
    .sort((a, b) => {
      // First priority: groups that haven't hit weekly target
      if (a.sets < targetSetsPerWeek && b.sets >= targetSetsPerWeek) return -1;
      if (b.sets < targetSetsPerWeek && a.sets >= targetSetsPerWeek) return 1;
      // Second priority: groups with larger deficit
      return b.deficit - a.deficit;
    });

  return sortedGroups.slice(0, groupsToSelect).map(g => g.group);
}

/**
 * Get all exercises the user has done for a muscle group
 */
export function getExercisesForMuscleGroup(
  workouts: LiftingWorkout[],
  muscleGroup: string
): Map<string, {
  name: string;
  heaviestWeight: number;
  heaviestWeightReps: number;
  maxVolume: number; // weight * reps for a single set
  recentSets: { weightLbs: number; reps: number; date: string }[];
}> {
  const exercises = new Map<string, {
    name: string;
    heaviestWeight: number;
    heaviestWeightReps: number;
    maxVolume: number;
    recentSets: { weightLbs: number; reps: number; date: string }[];
  }>();

  workouts.forEach(workout => {
    const dateKey = toDateKey(workout.workoutDate);

    workout.exercisesDetailed?.forEach(exercise => {
      if (exercise.bodyPart !== muscleGroup) return;

      const existing = exercises.get(exercise.name) || {
        name: exercise.name,
        heaviestWeight: 0,
        heaviestWeightReps: 0,
        maxVolume: 0,
        recentSets: [],
      };

      exercise.sets.forEach(set => {
        if (set.type === 'warmup' || set.weightLbs === null || set.reps === null) return;

        const weight = set.weightLbs;
        const reps = set.reps;
        const volume = weight * reps;

        // Track heaviest weight
        if (weight > existing.heaviestWeight) {
          existing.heaviestWeight = weight;
          existing.heaviestWeightReps = reps;
        }

        // Track max volume (single set)
        if (volume > existing.maxVolume) {
          existing.maxVolume = volume;
        }

        // Track recent sets
        existing.recentSets.push({ weightLbs: weight, reps, date: dateKey });
      });

      exercises.set(exercise.name, existing);
    });
  });

  // Sort recent sets by date (newest first) and limit to 10
  exercises.forEach(exercise => {
    exercise.recentSets = exercise.recentSets
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  });

  return exercises;
}

/**
 * Generate target weight/reps for a set
 * Goal: 8 reps at heaviest weight + 5lb OR combo that sets new volume record (max 14 reps)
 */
export function generateSetTarget(
  heaviestWeight: number,
  heaviestWeightReps: number,
  maxVolume: number
): GeneratedSet {
  // Option 1: 8 reps at heaviest weight + 5lb
  const targetWeight = Math.round(heaviestWeight + 5);
  const targetReps = 8;
  const option1Volume = targetWeight * targetReps;

  // Option 2: Find a combo that beats max volume (up to 14 reps)
  // Start from current heaviest weight and find reps needed
  let option2Weight = heaviestWeight;
  let option2Reps = Math.ceil(maxVolume / heaviestWeight) + 1;

  // Cap at 14 reps
  if (option2Reps > 14) {
    option2Reps = 14;
    option2Weight = Math.ceil(maxVolume / 14) + 2.5; // Add small increment to beat record
  }

  // Round weight to nearest 2.5
  option2Weight = Math.round(option2Weight / 2.5) * 2.5;

  const option2Volume = option2Weight * option2Reps;

  // Choose the option that gives a new record with reasonable intensity
  // Prefer option 1 (heavier weight at 8 reps) if it beats the record
  if (option1Volume > maxVolume) {
    return { weightLbs: targetWeight, targetReps, notes: `PR attempt: ${targetWeight} x ${targetReps}` };
  }

  // Otherwise use option 2 if it beats the record
  if (option2Volume > maxVolume) {
    return { weightLbs: option2Weight, targetReps: option2Reps, notes: `Volume PR: ${option2Weight} x ${option2Reps}` };
  }

  // Fallback: just do heaviest + 5 at 8 reps
  return { weightLbs: targetWeight, targetReps };
}

/**
 * Generate exercises for a muscle group (8 sets total)
 */
export function generateExercisesForGroup(
  muscleGroup: string,
  exerciseHistory: Map<string, {
    name: string;
    heaviestWeight: number;
    heaviestWeightReps: number;
    maxVolume: number;
    recentSets: { weightLbs: number; reps: number; date: string }[];
  }>,
  targetSets: number = 8
): GeneratedExercise[] {
  const exercises: GeneratedExercise[] = [];

  // Get exercises sorted by usage (most recent first)
  const exerciseList = Array.from(exerciseHistory.values())
    .filter(e => e.heaviestWeight > 0)
    .sort((a, b) => {
      const aDate = a.recentSets[0]?.date || '';
      const bDate = b.recentSets[0]?.date || '';
      return bDate.localeCompare(aDate);
    });

  if (exerciseList.length === 0) {
    return [];
  }

  // Distribute sets across 2-3 exercises
  const exerciseCount = Math.min(exerciseList.length, 3);
  const setsPerExercise = Math.floor(targetSets / exerciseCount);
  let remainingSets = targetSets - (setsPerExercise * exerciseCount);

  for (let i = 0; i < exerciseCount; i++) {
    const exercise = exerciseList[i];
    const numSets = setsPerExercise + (remainingSets > 0 ? 1 : 0);
    remainingSets = Math.max(0, remainingSets - 1);

    const sets: GeneratedSet[] = [];
    for (let s = 0; s < numSets; s++) {
      sets.push(generateSetTarget(
        exercise.heaviestWeight,
        exercise.heaviestWeightReps,
        exercise.maxVolume
      ));
    }

    exercises.push({
      name: exercise.name,
      bodyPart: muscleGroup,
      sets,
    });
  }

  return exercises;
}

/**
 * Get the display name for a body part code
 */
function getDisplayName(bodyPartCode: string): string {
  const entry = Object.entries(LIFTING_MUSCLE_GROUPS).find(([_, code]) => code === bodyPartCode);
  return entry ? entry[0] : bodyPartCode.charAt(0).toUpperCase() + bodyPartCode.slice(1);
}

/**
 * Generate a complete lifting workout
 */
export function generateLiftingWorkout(workouts: LiftingWorkout[]): GeneratedLiftingWorkout | null {
  // Get current week's sets
  const weeklySets = getWeeklySetsPerMuscleGroup(workouts);

  // Select muscle groups
  const selectedGroups = selectMuscleGroups(weeklySets);

  if (selectedGroups.length === 0) {
    return null;
  }

  const allExercises: GeneratedExercise[] = [];

  // Generate exercises for each muscle group
  for (const group of selectedGroups) {
    const exerciseHistory = getExercisesForMuscleGroup(workouts, group);
    const exercises = generateExercisesForGroup(group, exerciseHistory);
    allExercises.push(...exercises);
  }

  if (allExercises.length === 0) {
    return null;
  }

  // Create routine name
  const displayNames = selectedGroups.map(getDisplayName);
  const name = displayNames.join(' + ');

  return {
    name,
    muscleGroups: selectedGroups,
    exercises: allExercises,
    totalSets: allExercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    folderName: 'Custom Routines',
  };
}

// =============================================================================
// Running Workout Generator
// =============================================================================

/**
 * Classify a run by workout type based on name patterns
 */
export function classifyRunWorkoutType(name: string | null): RunningWorkoutType {
  if (!name) return 'Easy Run';

  const nameLower = name.toLowerCase();

  if (nameLower.includes('recovery') || nameLower.includes('recover')) return 'Recovery';
  if (nameLower.includes('long') || nameLower.includes('lsd')) return 'Long Run';
  if (nameLower.includes('tempo')) return 'Tempo Run';
  if (nameLower.includes('interval') || nameLower.includes('track')) return 'Intervals';
  if (nameLower.includes('hill') || nameLower.includes('hills')) return 'Hill Repeats';
  if (nameLower.includes('fartlek')) return 'Fartlek';
  if (nameLower.includes('easy') || nameLower.includes('jog')) return 'Easy Run';

  return 'Easy Run';
}

/**
 * Get runs from current week
 */
export function getWeeklyRuns(
  activities: RunningActivity[],
  weekStart: Date = getWeekStart()
): RunningActivity[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  return activities.filter(a => {
    const date = new Date(a.activityDate);
    return date >= weekStart && date <= weekEnd;
  });
}

/**
 * Get total weekly mileage
 */
export function getWeeklyMileage(activities: RunningActivity[], weekStart?: Date): number {
  const weeklyRuns = getWeeklyRuns(activities, weekStart);
  return weeklyRuns.reduce((sum, a) => sum + a.distanceMiles, 0);
}

/**
 * Get previous week's mileage (for 20% rule)
 */
export function getPreviousWeekMileage(activities: RunningActivity[]): number {
  const lastWeekStart = getWeekStart();
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  return getWeeklyMileage(activities, lastWeekStart);
}

/**
 * Get workout types done this week
 */
export function getWeeklyWorkoutTypes(activities: RunningActivity[]): RunningWorkoutType[] {
  const weeklyRuns = getWeeklyRuns(activities);
  return weeklyRuns.map(a => classifyRunWorkoutType(a.name));
}

/**
 * Get average pace from recent runs
 */
export function getRecentAveragePace(activities: RunningActivity[], count: number = 5): number {
  const sorted = [...activities]
    .filter(a => a.averagePaceSeconds != null)
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime())
    .slice(0, count);

  if (sorted.length === 0) return 8 * 60; // Default 8:00/mile

  const totalPace = sorted.reduce((sum, a) => sum + (a.averagePaceSeconds || 0), 0);
  return totalPace / sorted.length;
}

/**
 * Get average heart rate from recent runs
 */
export function getRecentAverageHeartrate(activities: RunningActivity[], count: number = 5): number | null {
  const sorted = [...activities]
    .filter(a => a.averageHeartrate != null)
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime())
    .slice(0, count);

  if (sorted.length === 0) return null;

  const total = sorted.reduce((sum, a) => sum + (a.averageHeartrate || 0), 0);
  return Math.round(total / sorted.length);
}

/**
 * Get max heart rate from recent runs
 */
export function getRecentMaxHeartrate(activities: RunningActivity[], count: number = 5): number | null {
  const sorted = [...activities]
    .filter(a => a.maxHeartrate != null)
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime())
    .slice(0, count);

  if (sorted.length === 0) return null;

  const total = sorted.reduce((sum, a) => sum + (a.maxHeartrate || 0), 0);
  return Math.round(total / sorted.length);
}

/**
 * Get cadence from recent runs
 */
export function getRecentCadence(activities: RunningActivity[], count: number = 5): number | null {
  const sorted = [...activities]
    .filter(a => a.averageCadence != null)
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime())
    .slice(0, count);

  if (sorted.length === 0) return null;

  const total = sorted.reduce((sum, a) => sum + (a.averageCadence || 0), 0);
  return Math.round(total / sorted.length);
}

/**
 * Get suggested distance for a workout type
 */
function getSuggestedDistance(
  type: RunningWorkoutType,
  previousWeekMileage: number,
  currentWeekMileage: number,
  targetWeeklyMileage: number = 15
): number {
  // Calculate max distance we can add (20% rule)
  const maxWeeklyMileage = previousWeekMileage * 1.2;
  const remainingMileage = Math.max(0, maxWeeklyMileage - currentWeekMileage);

  // Also consider reaching target (15+ miles)
  const targetRemaining = Math.max(0, targetWeeklyMileage - currentWeekMileage);

  // Base distances by workout type
  const baseDistances: Record<RunningWorkoutType, number> = {
    'Easy Run': 4,
    'Long Run': 10,
    'Tempo Run': 5,
    'Intervals': 5,
    'Hill Repeats': 4,
    'Fartlek': 5,
    'Recovery': 3,
  };

  let suggestedDistance = baseDistances[type];

  // Cap to remaining mileage if needed
  if (remainingMileage < suggestedDistance) {
    suggestedDistance = Math.max(2, remainingMileage);
  }

  // Minimum distance
  return Math.max(2, Math.round(suggestedDistance * 10) / 10);
}

/**
 * Get target pace for a workout type
 * Sub-3:30 marathon = 7:59/mile race pace
 */
function getTargetPace(type: RunningWorkoutType, recentAvgPace: number): number {
  const marathonGoalPace = 7 * 60 + 59; // 7:59/mile

  const paceMultipliers: Record<RunningWorkoutType, number> = {
    'Easy Run': 1.15,      // ~9:10/mile
    'Long Run': 1.10,      // ~8:47/mile
    'Tempo Run': 1.03,     // ~8:14/mile (slightly faster than goal)
    'Intervals': 0.92,     // ~7:21/mile (faster than goal)
    'Hill Repeats': 1.05,  // ~8:23/mile
    'Fartlek': 1.00,       // Goal pace
    'Recovery': 1.25,      // ~10:00/mile
  };

  return Math.round(marathonGoalPace * paceMultipliers[type]);
}

/**
 * Choose next workout type based on what's been done this week
 */
export function chooseNextWorkoutType(
  completedTypes: RunningWorkoutType[],
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ...
): RunningWorkoutType {
  // Weekly structure for marathon training:
  // Monday: Recovery/Rest
  // Tuesday: Intervals or Tempo
  // Wednesday: Easy
  // Thursday: Tempo or Fartlek
  // Friday: Rest
  // Saturday: Long Run
  // Sunday: Easy

  const hasLongRun = completedTypes.includes('Long Run');
  const hasTempo = completedTypes.includes('Tempo Run');
  const hasIntervals = completedTypes.includes('Intervals');
  const hasFartlek = completedTypes.includes('Fartlek');

  // Saturday suggestion: Long Run if not done
  if (dayOfWeek === 6 && !hasLongRun) {
    return 'Long Run';
  }

  // Tuesday: Quality day
  if (dayOfWeek === 2) {
    if (!hasIntervals) return 'Intervals';
    if (!hasTempo) return 'Tempo Run';
  }

  // Thursday: Quality day
  if (dayOfWeek === 4) {
    if (!hasTempo) return 'Tempo Run';
    if (!hasFartlek) return 'Fartlek';
  }

  // Monday: Recovery
  if (dayOfWeek === 1) {
    return 'Recovery';
  }

  // Default: Easy Run
  return 'Easy Run';
}

/**
 * Format date for workout name
 */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Generate a running workout
 */
export function generateRunningWorkout(activities: RunningActivity[]): GeneratedRunningWorkout | null {
  if (activities.length === 0) {
    // Default first run
    return {
      type: 'Easy Run',
      name: `Easy Run - ${formatShortDate(new Date())}`,
      distanceMiles: 3,
      targetPaceSeconds: 9 * 60, // 9:00/mile
      estimatedDurationSeconds: 3 * 9 * 60,
      notes: 'Start easy! Focus on comfortable effort.',
      projectedAvgHeartrate: null,
      projectedMaxHeartrate: null,
      projectedCadence: null,
    };
  }

  const today = new Date();
  const dayOfWeek = today.getDay();

  // Get weekly stats
  const currentWeekMileage = getWeeklyMileage(activities);
  const previousWeekMileage = getPreviousWeekMileage(activities);
  const completedTypes = getWeeklyWorkoutTypes(activities);
  const recentPace = getRecentAveragePace(activities);
  const projectedAvgHeartrate = getRecentAverageHeartrate(activities);
  const projectedMaxHeartrate = getRecentMaxHeartrate(activities);
  const projectedCadence = getRecentCadence(activities);

  // Choose workout type
  const workoutType = chooseNextWorkoutType(completedTypes, dayOfWeek);

  // Get suggested distance
  const distance = getSuggestedDistance(
    workoutType,
    previousWeekMileage,
    currentWeekMileage
  );

  // Get target pace
  const pace = getTargetPace(workoutType, recentPace);

  // Estimate duration
  const estimatedDuration = Math.round(distance * pace);

  // Create name
  const name = `${workoutType} - ${formatShortDate(today)}`;

  return {
    type: workoutType,
    name,
    distanceMiles: distance,
    targetPaceSeconds: pace,
    estimatedDurationSeconds: estimatedDuration,
    projectedAvgHeartrate,
    projectedMaxHeartrate,
    projectedCadence,
    notes: getWorkoutNotes(workoutType, distance, pace, currentWeekMileage),
  };
}

/**
 * Generate helpful notes for the workout
 */
function getWorkoutNotes(
  type: RunningWorkoutType,
  distance: number,
  pace: number,
  currentWeekMileage: number
): string {
  const paceMinutes = Math.floor(pace / 60);
  const paceSeconds = pace % 60;
  const paceStr = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;

  const notes: Record<RunningWorkoutType, string> = {
    'Easy Run': `Conversational pace. Target ${paceStr}/mi.`,
    'Long Run': `Building endurance. Keep it steady at ${paceStr}/mi.`,
    'Tempo Run': `Comfortably hard. Target ${paceStr}/mi for ${distance} miles.`,
    'Intervals': `Track workout: 6-8 x 800m at ${paceStr}/mi pace.`,
    'Hill Repeats': `Find a 0.25mi hill. 6-8 repeats at hard effort.`,
    'Fartlek': `Play with pace. Mix fast surges with easy recovery.`,
    'Recovery': `Very easy effort. Focus on recovery, not pace.`,
  };

  let note = notes[type];

  if (currentWeekMileage < 10) {
    note += ` (${currentWeekMileage.toFixed(1)} mi this week)`;
  }

  return note;
}
