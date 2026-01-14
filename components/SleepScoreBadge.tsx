import { getScoreLevel } from '@/lib/sleep-scoring';
import { cn } from '@/lib/utils'; // Assuming this utility exists, otherwise import appropriate one or use standard strings

export function SleepScoreBadge({ score }: { score: number }) {
    const { label, color } = getScoreLevel(score);

    return (
        <div className="flex items-center gap-2">
            <div
                className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border",
                    color.replace('text-', 'border-').replace('text-', 'bg-').replace('500', '100'),
                    color
                )}
            >
                {score}
            </div>
            <span className={cn("text-xs font-medium", color)}>
                {label}
            </span>
        </div>
    );
}
