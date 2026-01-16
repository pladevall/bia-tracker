import { CalendarCategory } from "@/types/calendar";

export const CALENDAR_CATEGORIES: Record<string, CalendarCategory & { dotColor: string }> = {
    deep_work: {
        key: 'deep_work',
        label: 'Deep Work',
        color: 'bg-amber-500/20',
        dotColor: 'bg-amber-500',
        textColor: 'text-amber-700 dark:text-amber-400',
        borderColor: 'border-amber-500' // Solid border for selection
    },
    ship: {
        key: 'ship',
        label: 'Ship',
        color: 'bg-emerald-500/20',
        dotColor: 'bg-emerald-500',
        textColor: 'text-emerald-700 dark:text-emerald-400',
        borderColor: 'border-emerald-500'
    },
    fitness: {
        key: 'fitness',
        label: 'Fitness',
        color: 'bg-rose-500/20',
        dotColor: 'bg-rose-500',
        textColor: 'text-rose-700 dark:text-rose-400',
        borderColor: 'border-rose-500'
    },
    learn: {
        key: 'learn',
        label: 'Learn',
        color: 'bg-sky-500/20',
        dotColor: 'bg-sky-500',
        textColor: 'text-sky-700 dark:text-sky-400',
        borderColor: 'border-sky-500'
    },
    life: {
        key: 'life',
        label: 'Life',
        color: 'bg-violet-500/20',
        dotColor: 'bg-violet-500',
        textColor: 'text-violet-700 dark:text-violet-400',
        borderColor: 'border-violet-500'
    },
    other: {
        key: 'other',
        label: 'Other',
        color: 'bg-slate-500/20',
        dotColor: 'bg-slate-500',
        textColor: 'text-slate-700 dark:text-slate-400',
        borderColor: 'border-slate-500'
    },
};
