/**
 * Bold Practice Types
 * TypeScript interfaces for practice entities
 */

// ============================================
// Practice Entry (Daily Practice)
// ============================================
export interface PracticeEntry {
    id: string;
    date: string; // ISO date string
    winning_vision: string | null;
    belief_examined: string | null;
    bold_risk: string | null;
    bold_risk_fear: string | null;
    belief_id?: string | null; // Link to specific belief being tested
    blocker?: string | null; // Renamed from bold_risk_fear
    belief_test?: string | null; // DEPRECATED: Removed from UI, kept for backward compatibility
    completed_at: string | null; // ISO timestamp
    created_at: string;
    updated_at: string;
}

// ============================================
// Bets (Strategic Wagers)
// ============================================

// Structured upside options for calculations
export const UPSIDE_OPTIONS = [
    { label: 'Linear (1-2x)', value: 1.5, multiplier: 1.5 },
    { label: 'Moderate (3-5x)', value: 4, multiplier: 4 },
    { label: 'Strong (10x)', value: 10, multiplier: 10 },
    { label: 'Outsized (50x)', value: 50, multiplier: 50 },
    { label: 'Moonshot (100x+)', value: 100, multiplier: 100 },
] as const;

export type UpsideOption = typeof UPSIDE_OPTIONS[number]['label'];

export interface Bet {
    id: string;
    name: string;      // e.g., "Index (Startup)"
    description: string;

    // Sizing Factors (Kelly-inspired)
    upside: UpsideOption | string; // Structured or legacy freetext
    upside_multiplier?: number | null;    // Numeric multiplier for calculations (null = use auto-calculated)
    confidence: number;            // 0-100% subjective likelihood of success
    probability?: number;          // DEPRECATED: Use confidence instead
    downside?: number | string;    // Monetary downside risk (in dollars) or text description
    downside_override?: number | null;  // Manual override for downside calculation
    timeline?: string | null;      // Text description (deprecated - calculated from actions)

    // Computed
    bet_score?: number;            // Kelly-inspired ranking score
    calculated_timeline_years?: number; // Computed from sum of action durations
    computed_confidence?: number | null; // Auto-calculated confidence from weighted beliefs/actions

    status: 'active' | 'paused' | 'closed';
    created_at: string;
    updated_at: string;
}

// ============================================
// Bold Takes
// ============================================
export type BoldTakeStatus = 'committed' | 'done' | 'skipped';

export interface BoldTake {
    id: string;
    date: string;
    bet_id: string | null;
    belief_id?: string | null;     // Links action to specific belief for nesting
    description: string;
    fear: string | null;
    status: BoldTakeStatus;
    outcome: string | null;
    learning: string | null;
    duration_days?: number;        // Time commitment in days
    confidence?: number;           // 0-100% confidence in action success
    created_at: string;
}

// ============================================
// Beliefs
// ============================================
export type BeliefStatus = 'untested' | 'testing' | 'proven' | 'disproven';

export interface Belief {
    id: string;
    bet_id: string | null;
    belief: string;
    status: BeliefStatus;
    evidence: string | null;
    duration_days?: number;        // Time in days to validate belief
    confidence?: number;           // 0-100% confidence belief will prove true
    created_at: string;
    updated_at: string;
}

// ============================================
// User Settings
// ============================================
export interface UserSettings {
    id: number;
    annual_salary: number;         // Annual opportunity cost in dollars
    created_at: string;
    updated_at: string;
}

// ============================================
// Practice Goals
// ============================================
export type GoalCategory = 'Financial' | 'Product' | 'Growth' | 'Personal';

export interface PracticeGoal {
    id: string;
    name: string;
    category: GoalCategory;
    target_value: number;
    current_value: number;
    unit: string | null;
    quarter: string | null;
    deadline: string | null;
    created_at: string;
}

// ============================================
// Streak
// ============================================
export interface Streak {
    id: number;
    current_streak: number;
    longest_streak: number;
    last_practice_date: string | null;
}

// ============================================
// AI Chat
// ============================================
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// ============================================
// API Request/Response Types
// ============================================
export interface SavePracticeRequest {
    winning_vision?: string;
    belief_examined?: string;
    bold_risk?: string;
    bold_risk_fear?: string;
    belief_test?: string; // DEPRECATED: No longer used
}

export interface CompletePracticeResponse {
    entry: PracticeEntry;
    streak: Streak;
    bold_take_id?: string;
    belief_id?: string;
}

export interface UpdateBoldTakeRequest {
    status: BoldTakeStatus;
    outcome?: string;
    learning?: string;
}

export interface UpdateBeliefRequest {
    status?: BeliefStatus;
    evidence?: string;
}

export interface ChatRequest {
    message: string;
    history?: ChatMessage[];
}

export interface FieldPromptRequest {
    field: 'winning_vision' | 'belief_examined' | 'bold_risk' | 'bold_risk_fear';
    current_value?: string;
}
