'use client';

interface ReflectionModalProps {
    reflection: string;
    onClose: () => void;
}

export default function ReflectionModal({ reflection, onClose }: ReflectionModalProps) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🧠</span>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Practice Reflection
                    </h2>
                </div>

                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                    {reflection}
                </p>

                <button
                    onClick={onClose}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
