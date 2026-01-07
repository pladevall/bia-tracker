'use client';

import { useState, useCallback } from 'react';

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  isLoading: boolean;
  progress?: string;
}

export default function FileUpload({ onUpload, isLoading, progress }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      await onUpload(imageFiles);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border border-dashed rounded-lg p-6 text-center transition-all cursor-pointer
        ${isDragging
          ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800/50'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${isLoading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {progress || 'Processing...'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Drop screenshots or <span className="text-gray-900 dark:text-gray-100 font-medium">browse</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">PNG, JPG · Multiple files supported</p>
        </div>
      )}
    </div>
  );
}
