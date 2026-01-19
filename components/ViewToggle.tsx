'use client';

import { motion } from 'framer-motion';

export type ViewMode = 'all' | 'workouts' | 'sleep' | 'measurements';

interface ViewToggleProps {
    viewMode: ViewMode;
    onViewChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
    const options: { id: ViewMode; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'workouts', label: 'Workouts' },
        { id: 'sleep', label: 'Sleep' },
        { id: 'measurements', label: 'Measures' },
    ];

    return (
        <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
            {options.map((option) => {
                const isActive = viewMode === option.id;
                return (
                    <button
                        key={option.id}
                        onClick={() => onViewChange(option.id)}
                        className={`
              relative px-3 py-1 text-xs font-medium rounded-md transition-colors z-10
              ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}
            `}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="viewToggleActive"
                                className="absolute inset-0 bg-white dark:bg-gray-700 rounded-md shadow-sm border border-black/5 dark:border-white/5 -z-10"
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        )}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
