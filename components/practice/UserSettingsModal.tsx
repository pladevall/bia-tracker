'use client';

import { useState, useCallback } from 'react';
import type { UserSettings } from '@/lib/practice/types';
import { formatCurrency } from '@/lib/practice/formatting';

interface UserSettingsModalProps {
    settings: UserSettings;
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: Partial<UserSettings>) => Promise<void>;
}

export default function UserSettingsModal({ settings, isOpen, onClose, onSave }: UserSettingsModalProps) {
    const [annualSalary, setAnnualSalary] = useState(String(settings.annual_salary));
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        const parsed = parseInt(annualSalary.replace(/[^0-9]/g, ''));
        if (isNaN(parsed) || parsed <= 0) return;

        setIsSaving(true);
        try {
            await onSave({ annual_salary: parsed });
            onClose();
        } finally {
            setIsSaving(false);
        }
    }, [annualSalary, onSave, onClose]);

    const handleReset = useCallback(() => {
        setAnnualSalary(String(settings.annual_salary));
    }, [settings.annual_salary]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full mx-4">
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your opportunity cost</p>
                    </div>

                    {/* Annual Salary Field */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Annual Salary (Opportunity Cost)
                            </label>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={annualSalary}
                                        onChange={(e) => setAnnualSalary(e.target.value)}
                                        placeholder="e.g., 150000"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                                    />
                                </div>
                                <div className="flex items-center px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm font-medium whitespace-nowrap">
                                    {annualSalary ? formatCurrency(parseInt(annualSalary.replace(/[^0-9]/g, '')) || undefined) : '-'}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                This is used to calculate downside (opportunity cost) for each bet: downside = timeline × annual_salary
                            </p>
                        </div>

                        {/* Impact Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                                <strong>Note:</strong> Changing this value will recalculate downside for all your bets
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving || !annualSalary}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
