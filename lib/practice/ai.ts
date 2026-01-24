/**
 * Bold Practice - AI Coach Module
 * Gemini API integration ported from bold-practice/ai.py
 */

import type {
    PracticeEntry,
    BoldTake,
    Belief,
    PracticeGoal,
    Streak,
    ChatMessage,
} from './types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function getApiKey(): string | null {
    return process.env.GOOGLE_GEMINI_API_KEY || null;
}

// ============================================
// Context Building
// ============================================

export function buildContext(
    goals: PracticeGoal[],
    boldTakes: BoldTake[],
    beliefs: Belief[],
    history: PracticeEntry[],
    streak: Streak,
    todayPractice?: PracticeEntry | null
): string {
    const parts: string[] = [];

    // Goals
    if (goals.length > 0) {
        parts.push('GOALS:');
        for (const goal of goals) {
            const pct = goal.target_value > 0
                ? Math.round((goal.current_value / goal.target_value) * 100)
                : 0;
            parts.push(`- ${goal.name}: ${goal.current_value} / ${goal.target_value} ${goal.unit || ''} (${pct}%)`);
        }
        parts.push('');
    }

    // Streak
    parts.push('PRACTICE STREAK:');
    parts.push(`- Current streak: ${streak.current_streak} days`);
    parts.push(`- Longest streak: ${streak.longest_streak} days`);
    parts.push('');

    // Recent Bold Takes
    if (boldTakes.length > 0) {
        parts.push('RECENT BOLD TAKES (last 10):');
        for (const take of boldTakes.slice(0, 10)) {
            const fearPart = take.fear ? ` - Fear: ${take.fear}` : '';
            const outcomePart = take.outcome ? ` - Outcome: ${take.outcome}` : '';
            const learningPart = take.learning ? ` - Learning: ${take.learning}` : '';
            parts.push(`- ${take.date}: "${take.description}"${fearPart} - Status: ${take.status}${outcomePart}${learningPart}`);
        }
        parts.push('');
    }

    // Beliefs
    if (beliefs.length > 0) {
        parts.push('BELIEFS BEING TRACKED:');
        for (const belief of beliefs) {
            const evidencePart = belief.evidence ? ` - Evidence: ${belief.evidence}` : '';
            parts.push(`- "${belief.belief}" - Status: ${belief.status}${evidencePart}`);
        }
        parts.push('');
    }

    // Practice History
    if (history.length > 0) {
        parts.push('PRACTICE HISTORY (last 7 days):');
        for (const practice of history.slice(0, 7)) {
            parts.push(`- ${practice.date}:`);
            if (practice.winning_vision) {
                parts.push(`  Vision: ${practice.winning_vision.substring(0, 100)}...`);
            }
            if (practice.belief_examined) {
                parts.push(`  Belief: ${practice.belief_examined}`);
            }
            if (practice.bold_risk) {
                parts.push(`  Bold Risk: ${practice.bold_risk}`);
            }
        }
        parts.push('');
    }

    // Today's Practice
    if (todayPractice && (todayPractice.winning_vision || todayPractice.bold_risk)) {
        parts.push("TODAY'S PRACTICE (in progress):");
        if (todayPractice.winning_vision) parts.push(`  Vision: ${todayPractice.winning_vision}`);
        if (todayPractice.belief_examined) parts.push(`  Belief: ${todayPractice.belief_examined}`);
        if (todayPractice.belief_test) parts.push(`  Test: ${todayPractice.belief_test}`);
        if (todayPractice.bold_risk) parts.push(`  Bold Risk: ${todayPractice.bold_risk}`);
        if (todayPractice.bold_risk_fear) parts.push(`  Fear: ${todayPractice.bold_risk_fear}`);
        parts.push('');
    }

    return parts.join('\n');
}

function getSystemPrompt(context: string): string {
    return `You are a bold practice coach. Your role is to help the user take bold action, challenge limiting beliefs, and stay focused on their winning vision.

You have access to the user's full practice history and goals. Use this context to:
- Recognize patterns in their behavior
- Challenge beliefs that might be holding them back
- Celebrate bold risks taken and learn from outcomes
- Connect today's practice to their larger goals
- Be direct and honest - don't coddle, but be supportive

Keep responses concise and actionable. Ask probing questions. Push the user toward bolder action.

USER'S CONTEXT:
${context}

Remember: Your job is to help them win by being bold. Every day is a chance to take action.`;
}

// ============================================
// Chat with Coach
// ============================================

export async function chatWithCoach(
    message: string,
    history: ChatMessage[],
    context: string
): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return 'AI coaching is not available. Please set GOOGLE_GEMINI_API_KEY.';
    }

    const systemPrompt = getSystemPrompt(context);

    // Build conversation contents
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // System prompt as first message pair
    contents.push({
        role: 'user',
        parts: [{ text: `[System Context]\n${systemPrompt}` }],
    });
    contents.push({
        role: 'model',
        parts: [{ text: "I understand. I'm ready to coach you through your bold practice. What's on your mind?" }],
    });

    // Add conversation history
    for (const msg of history) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        });
    }

    // Add current message
    contents.push({
        role: 'user',
        parts: [{ text: message }],
    });

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                },
            }),
        });

        if (!response.ok) {
            return `AI service error: ${response.status}. Please check your API key.`;
        }

        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }
        return 'No response from AI. Please try again.';
    } catch (error) {
        console.error('AI chat error:', error);
        return 'AI error: Please try again.';
    }
}

// ============================================
// Generate Reflection
// ============================================

export async function generateReflection(
    todayPractice: PracticeEntry,
    context: string
): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return 'AI coaching is not available. Please set GOOGLE_GEMINI_API_KEY.';
    }

    const prompt = `Based on today's completed practice and the user's history, generate a brief, insightful reflection (2-3 sentences max).

Focus on ONE of these:
1. A pattern you notice (positive or concerning)
2. A connection to a previous belief or risk
3. A specific challenge or encouragement for tomorrow

Be direct. No generic praise. Make it personal to their actual data.

USER'S CONTEXT:
${context}

TODAY'S COMPLETED PRACTICE:
- Vision: ${todayPractice.winning_vision || 'Not set'}
- Belief examined: ${todayPractice.belief_examined || 'Not set'}
- Belief test: ${todayPractice.belief_test || 'Not set'}
- Bold risk: ${todayPractice.bold_risk || 'Not set'}
- Fear: ${todayPractice.bold_risk_fear || 'Not set'}

Generate the reflection:`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 150,
                },
            }),
        });

        if (!response.ok) {
            return 'Could not generate reflection. AI service unavailable.';
        }

        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }
        return 'Could not generate reflection.';
    } catch {
        return 'Could not generate reflection.';
    }
}

// ============================================
// Generate Field Prompt
// ============================================

const FIELD_INSTRUCTIONS: Record<string, string> = {
    winning_vision: `Generate a short, provocative question about their winning vision.
Consider: How has it evolved? Is it sharp enough? Does it connect to their goals?`,

    belief_examined: `Generate a question about the belief they're examining.
Consider: Have they examined similar beliefs before? What did they learn?`,

    belief_test: `Help them think about how to test this belief.
Consider: Is the test concrete enough? What would actually prove or disprove it?`,

    bold_risk: `Challenge them on their bold risk.
Consider: Is it bold enough? Have they avoided similar risks before?`,

    bold_risk_fear: `Help them name and examine the fear.
Consider: Is this a recurring fear? What would happen if the fear came true?`,
};

export async function generateFieldPrompt(
    field: string,
    currentValue: string,
    context: string,
    currentFields: Record<string, string>
): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('GOOGLE_GEMINI_API_KEY is missing');
        throw new Error('AI configuration missing');
    }

    const instruction = FIELD_INSTRUCTIONS[field] || 'Generate a helpful prompt.';

    const prompt = `Generate ONE short, specific question or prompt (max 20 words) to help the user with their ${field.replace(/_/g, ' ')}.

${instruction}

USER'S CONTEXT:
${context}

TODAY'S PRACTICE SO FAR:
- Vision: ${currentFields.winning_vision || '(not yet filled)'}
- Belief: ${currentFields.belief_examined || '(not yet filled)'}
- Test: ${currentFields.belief_test || '(not yet filled)'}
- Bold Risk: ${currentFields.bold_risk || '(not yet filled)'}
- Fear: ${currentFields.bold_risk_fear || '(not yet filled)'}

CURRENT VALUE FOR THIS FIELD: ${currentValue || '(empty)'}

Generate the prompt (ONE sentence, be specific to their data):`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 60,
                },
            }),
        });

        if (!response.ok) {
            console.error('Gemini API error:', response.status, response.statusText);
            throw new Error(`AI service error: ${response.status}`);
        }

        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        throw new Error('No content generated');
    } catch (err) {
        console.error('generateFieldPrompt error:', err);
        throw err;
    }
}
