import { SleepStages } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SleepStageBar({ stages }: { stages: SleepStages }) {
    if (!stages.totalSleepMinutes) return null;

    const getPercent = (mins: number) => (mins / stages.totalSleepMinutes) * 100;

    return (
        <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            {/* Deep Sleep - Dark Blue/Purple */}
            <div
                style={{ width: `${getPercent(stages.deepMinutes)}%` }}
                className="bg-indigo-600 h-full"
                title={`Deep: ${Math.round(stages.deepMinutes)}m`}
            />

            {/* Core/Light Sleep - Blue */}
            <div
                style={{ width: `${getPercent(stages.coreMinutes)}%` }}
                className="bg-blue-400 h-full"
                title={`Core: ${Math.round(stages.coreMinutes)}m`}
            />

            {/* REM Sleep - Light Blue/Cyan */}
            <div
                style={{ width: `${getPercent(stages.remMinutes)}%` }}
                className="bg-cyan-300 h-full"
                title={`REM: ${Math.round(stages.remMinutes)}m`}
            />

            {/* Awake - Orange/Red (Usually excluded from total sleep mins denominator if we want 100% bar of sleep, 
          but if we want to show awake time relative to time in bed, we should use inBed as denominator) 
      */}
            {/* Using standard sleep stage bar often shows awake time as gaps. 
          Here we simplify to a stacked bar of sleep components. 
       */}
        </div>
    );
}
