/**
 * Hevy API Client
 * Fetches lifting workouts using API key authentication
 */

const HEVY_API_BASE = 'https://api.hevyapp.com/v1';

/**
 * Hevy workout from API
 */
export interface HevyWorkout {
    id: string;
    title: string;
    description: string | null;
    start_time: string;        // ISO 8601
    end_time: string;          // ISO 8601
    created_at: string;
    updated_at: string;
    exercises: HevyExercise[];
}

export interface HevyExercise {
    index: number;
    title: string;
    notes: string | null;
    exercise_template_id: string;
    superset_id: number | null;
    sets: HevySet[];
}

export interface HevySet {
    index: number;
    type: 'normal' | 'warmup' | 'dropset' | 'failure';
    weight_kg: number | null;
    reps: number | null;
    distance_meters: number | null;
    duration_seconds: number | null;
    rpe: number | null;
}

export interface HevyExerciseTemplate {
    id: string;
    title: string;
    type: string;
    primary_muscle_group: string;
    secondary_muscle_groups: string[];
    is_custom: boolean;
}

/**
 * Body part mapping from Hevy muscle groups
 */
const MUSCLE_GROUP_TO_BODY_PART: Record<string, string> = {
    // Chest
    'chest': 'chest',

    // Back
    'upper_back': 'back',
    'lats': 'back',
    'lower_back': 'back',
    'traps': 'back',

    // Shoulders
    'shoulders': 'shoulders',
    'front_delts': 'shoulders',
    'side_delts': 'shoulders',
    'rear_delts': 'shoulders',

    // Arms
    'biceps': 'biceps',
    'triceps': 'triceps',
    'forearms': 'forearms',

    // Core
    'abdominals': 'core',
    'abs': 'core',
    'obliques': 'core',

    // Legs
    'quadriceps': 'quadriceps',
    'quads': 'quadriceps',
    'hamstrings': 'hamstrings',
    'glutes': 'glutes',
    'calves': 'calves',

    // Other
    'other': 'other',
};

/**
 * Create a Hevy API client
 */
export class HevyClient {
    private apiKey: string;
    private exerciseTemplatesCache: Map<string, HevyExerciseTemplate> = new Map();

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Make an authenticated request to Hevy API
     */
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${HEVY_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Hevy API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    /**
     * Validate the API key by fetching workout count
     */
    async validateApiKey(): Promise<boolean> {
        try {
            await this.request<{ workout_count: number }>('/workouts/count');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the total number of workouts
     */
    async getWorkoutCount(): Promise<number> {
        const data = await this.request<{ workout_count: number }>('/workouts/count');
        return data.workout_count;
    }

    /**
     * Get workouts with pagination
     * @param page - Page number (1-indexed)
     * @param pageSize - Number of workouts per page
     */
    async getWorkouts(page = 1, pageSize = 10): Promise<{ page: number; page_count: number; workouts: HevyWorkout[] }> {
        return this.request(`/workouts?page=${page}&pageSize=${pageSize}`);
    }

    /**
     * Get all workouts since a date
     */
    async getAllWorkouts(since?: Date): Promise<HevyWorkout[]> {
        const allWorkouts: HevyWorkout[] = [];
        let page = 1;
        const pageSize = 10;  // Hevy API limit is 10

        const sinceTime = since ? since.getTime() : 0;

        while (true) {
            const data = await this.getWorkouts(page, pageSize);

            // Filter by date if specified
            const filteredWorkouts = since
                ? data.workouts.filter(w => new Date(w.start_time).getTime() >= sinceTime)
                : data.workouts;

            allWorkouts.push(...filteredWorkouts);

            // If we got fewer than requested or reached old workouts, we're done
            if (data.workouts.length < pageSize || page >= data.page_count) {
                break;
            }

            // If filtering by date and we found old workouts, stop
            if (since && data.workouts.some(w => new Date(w.start_time).getTime() < sinceTime)) {
                break;
            }

            page++;

            // Safety limit
            if (page > 100) {
                console.warn('Hevy pagination safety limit reached');
                break;
            }
        }

        return allWorkouts;
    }

    /**
     * Get exercise templates for body part mapping
     */
    async getExerciseTemplates(): Promise<HevyExerciseTemplate[]> {
        let allTemplates: HevyExerciseTemplate[] = [];
        let page = 1;
        const pageSize = 100;

        while (true) {
            const data = await this.request<{ page: number; page_count: number; exercise_templates: HevyExerciseTemplate[] }>(
                `/exercise_templates?page=${page}&pageSize=${pageSize}`
            );

            allTemplates.push(...data.exercise_templates);

            if (page >= data.page_count) {
                break;
            }

            page++;
        }

        // Cache the templates
        for (const template of allTemplates) {
            this.exerciseTemplatesCache.set(template.id, template);
        }

        return allTemplates;
    }

    /**
     * Get body part for an exercise template ID
     */
    async getBodyPartForExercise(exerciseTemplateId: string): Promise<string> {
        // Check cache first
        let template = this.exerciseTemplatesCache.get(exerciseTemplateId);

        if (!template) {
            // Fetch all templates if not cached
            await this.getExerciseTemplates();
            template = this.exerciseTemplatesCache.get(exerciseTemplateId);
        }

        if (!template) {
            return 'other';
        }

        const muscleGroup = template.primary_muscle_group.toLowerCase();
        return MUSCLE_GROUP_TO_BODY_PART[muscleGroup] || 'other';
    }

    /**
     * Find exercise template ID by name (case-insensitive partial match)
     */
    async getTemplateIdByName(exerciseName: string): Promise<string | null> {
        // Ensure templates are loaded
        if (this.exerciseTemplatesCache.size === 0) {
            await this.getExerciseTemplates();
        }

        const lowerName = exerciseName.toLowerCase();

        // Try exact match first
        for (const [id, template] of this.exerciseTemplatesCache) {
            if (template.title.toLowerCase() === lowerName) {
                return id;
            }
        }

        // Try partial match
        for (const [id, template] of this.exerciseTemplatesCache) {
            if (template.title.toLowerCase().includes(lowerName) || lowerName.includes(template.title.toLowerCase())) {
                return id;
            }
        }

        return null;
    }

    /**
     * Create a new routine in Hevy
     */
    async createRoutine(routine: {
        title: string;
        notes?: string;
        folder_id?: string;
        exercises: Array<{
            exercise_template_id: string;
            superset_id?: number | null;
            rest_seconds?: number;
            notes?: string;
            sets: Array<{
                type?: 'normal' | 'warmup' | 'dropset' | 'failure';
                weight_kg?: number | null;
                reps?: number | null;
                distance_meters?: number | null;
                duration_seconds?: number | null;
                rpe?: number | null;
            }>;
        }>;
    }): Promise<{ id: string; title: string }> {
        const response = await this.request<{ routine: { id: string; title: string } }>('/routines', {
            method: 'POST',
            body: JSON.stringify({ routine }),
        });
        return response.routine;
    }

    /**
     * Get all routine folders
     */
    async getRoutineFolders(): Promise<Array<{ id: string; title: string }>> {
        const data = await this.request<{ routine_folders: Array<{ id: string; title: string }> }>('/routine_folders');
        return data.routine_folders;
    }

    /**
     * Create a routine folder
     */
    async createRoutineFolder(title: string): Promise<{ id: string; title: string }> {
        const response = await this.request<{ routine_folder: { id: string; title: string } }>('/routine_folders', {
            method: 'POST',
            body: JSON.stringify({ routine_folder: { title } }),
        });
        return response.routine_folder;
    }
}

// Conversion constants
const KG_TO_LBS = 2.20462;

/**
 * Convert Hevy workout to our format
 */
export async function convertHevyWorkout(
    workout: HevyWorkout,
    client: HevyClient
): Promise<{
    hevyId: string;
    workoutDate: string;
    name: string;
    totalSets: number;
    durationSeconds: number;
    totalReps: number;
    totalVolumeLbs: number;
    bodyParts: Record<string, { sets: number; reps: number; volumeLbs: number }>;
    exercises: Array<{
        name: string;
        bodyPart: string;
        sets: number;
        reps: number;
        weightLbs: number | null;
    }>;
    exercisesDetailed: Array<{
        name: string;
        bodyPart: string;
        sets: Array<{
            index: number;
            type: 'normal' | 'warmup' | 'dropset' | 'failure';
            weightLbs: number | null;
            reps: number | null;
            rpe: number | null;
        }>;
    }>;
}> {
    const startTime = new Date(workout.start_time).getTime();
    const endTime = new Date(workout.end_time).getTime();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    let totalSets = 0;
    let totalReps = 0;
    let totalVolumeLbs = 0;
    const bodyParts: Record<string, { sets: number; reps: number; volumeLbs: number }> = {};
    const exercises: Array<{
        name: string;
        bodyPart: string;
        sets: number;
        reps: number;
        weightLbs: number | null;
    }> = [];
    const exercisesDetailed: Array<{
        name: string;
        bodyPart: string;
        sets: Array<{
            index: number;
            type: 'normal' | 'warmup' | 'dropset' | 'failure';
            weightLbs: number | null;
            reps: number | null;
            rpe: number | null;
        }>;
    }> = [];

    for (const exercise of workout.exercises) {
        const bodyPart = await client.getBodyPartForExercise(exercise.exercise_template_id);

        let exerciseSets = 0;
        let exerciseReps = 0;
        let exerciseVolumeLbs = 0;
        let maxWeightLbs: number | null = null;
        const currentExerciseSets: Array<{
            index: number;
            type: 'normal' | 'warmup' | 'dropset' | 'failure';
            weightLbs: number | null;
            reps: number | null;
            rpe: number | null;
        }> = [];

        for (const set of exercise.sets) {
            // Store all normal/dropset/failure sets in detailed view
            // Explicitly excluding warmup sets from detailed stats per plan requirements
            if (set.type === 'normal' || set.type === 'dropset' || set.type === 'failure') {
                const weightLbs = set.weight_kg !== null ? set.weight_kg * KG_TO_LBS : null;

                currentExerciseSets.push({
                    index: set.index,
                    type: set.type,
                    weightLbs: weightLbs ? Math.round(weightLbs * 10) / 10 : null,
                    reps: set.reps,
                    rpe: set.rpe,
                });

                exerciseSets++;

                const reps = set.reps || 0;
                exerciseReps += reps;

                if (weightLbs !== null) {
                    exerciseVolumeLbs += weightLbs * reps;

                    if (maxWeightLbs === null || weightLbs > maxWeightLbs) {
                        maxWeightLbs = weightLbs;
                    }
                }
            }
        }

        totalSets += exerciseSets;
        totalReps += exerciseReps;
        totalVolumeLbs += exerciseVolumeLbs;

        // Aggregate by body part
        if (!bodyParts[bodyPart]) {
            bodyParts[bodyPart] = { sets: 0, reps: 0, volumeLbs: 0 };
        }
        bodyParts[bodyPart].sets += exerciseSets;
        bodyParts[bodyPart].reps += exerciseReps;
        bodyParts[bodyPart].volumeLbs += exerciseVolumeLbs;

        exercises.push({
            name: exercise.title,
            bodyPart,
            sets: exerciseSets,
            reps: exerciseReps,
            weightLbs: maxWeightLbs ? Math.round(maxWeightLbs * 10) / 10 : null,
        });

        exercisesDetailed.push({
            name: exercise.title,
            bodyPart,
            sets: currentExerciseSets
        });
    }

    return {
        hevyId: workout.id,
        workoutDate: workout.start_time,
        name: workout.title,
        totalSets,
        durationSeconds,
        totalReps,
        totalVolumeLbs: Math.round(totalVolumeLbs),
        bodyParts,
        exercises,
        exercisesDetailed,
    };
}
