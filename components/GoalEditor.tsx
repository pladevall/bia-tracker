import { useState, useRef, useEffect } from 'react';

// Helper to format seconds to time string
const formatTimeInput = (seconds: number, type: 'duration' | 'pace'): string => {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);

  if (type === 'duration' && m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Helper to parse time string to seconds
const parseTimeInput = (value: string): number | null => {
  if (!value) return null;
  // allow mm:ss or hh:mm:ss or m:ss
  const parts = value.split(':').map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0]; // Treat as seconds if just number? Or minutes? 
    // Usually manual entry of "30" for runtime might mean 30 mins, but for consistency let's assume if no colons, user might need to type 30:00.
    // Actually, for better UX clarity, if it's duration/pace, let's enforce colons or just assume minutes?
    // Let's stick strictly to colons for now to avoid ambiguity, or just accept raw seconds if they type pure numbers (unlikely behavior but safe).
    // Actually standard is usually: pure number -> error or specific unit. 
    // Let's implement robust parsing:
    // If user types "5", is it 5 min or 5 sec?
    // Let's assume input needs at least one colon for time format, otherwise it's just raw number which might be weird.
    // But let's just accept it as partial entry and maybe it handles valid float parsing.
    return parts[0];
  }
  return null;
};

interface GoalEditorProps {
  metricKey: string;
  metricLabel: string;
  currentValue: number | null;
  inputType?: 'number' | 'duration' | 'pace';
  onSave: (metricKey: string, value: number) => void;
  onDelete: (metricKey: string) => void;
  onClose: () => void;
}

export default function GoalEditor({
  metricLabel,
  currentValue,
  inputType = 'number',
  onSave,
  onDelete,
  onClose,
  metricKey,
}: GoalEditorProps) {
  const [value, setValue] = useState(() => {
    if (currentValue === null) return '';
    if (inputType === 'number') return currentValue.toString();
    return formatTimeInput(currentValue, inputType);
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    let numValue: number | null = null;

    if (inputType === 'number') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) numValue = parsed;
    } else {
      numValue = parseTimeInput(value);
    }

    if (numValue !== null && numValue > 0) {
      onSave(metricKey, numValue);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete(metricKey);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const placeholder = inputType === 'pace' ? 'm:ss' : inputType === 'duration' ? 'h:mm:ss' : 'Target value';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 min-w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Set Goal: {metricLabel}
        </h3>
        <input
          ref={inputRef}
          type={inputType === 'number' ? "number" : "text"}
          step={inputType === 'number' ? "0.1" : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {inputType !== 'number' && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Format: {placeholder}
          </p>
        )}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSave}
            disabled={!value}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
          {currentValue && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
