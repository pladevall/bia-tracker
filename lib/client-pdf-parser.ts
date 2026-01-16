'use client';

import { BIAEntry } from './types';
import { parseBIAReport, validateAgainstPrevious, autoCorrectEntry, ValidationIssue } from './pdf-parser';
import Tesseract from 'tesseract.js';

export async function extractTextFromImage(
  file: File,
  onProgress?: (progress: string) => void
): Promise<string> {
  onProgress?.('Scanning image...');

  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(`Scanning: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  console.log('Image OCR extracted text length:', result.data.text.length);
  return result.data.text;
}

export async function parseFile(
  file: File,
  onProgress?: (progress: string) => void,
  previousEntry?: BIAEntry
): Promise<{ entry: BIAEntry; rawText: string; validationIssues?: ValidationIssue[] }> {
  // Only support image files now
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (PNG, JPG). PDF is no longer supported.');
  }

  const text = await extractTextFromImage(file, onProgress);
  onProgress?.('Parsing data...');
  let entry = parseBIAReport(text);

  // Validate and auto-correct against previous entry if provided
  if (previousEntry) {
    const initialIssues = validateAgainstPrevious(entry, previousEntry);

    if (initialIssues.length > 0) {
      console.log(`Found ${initialIssues.length} validation issues, attempting auto-correction...`);

      // Try to auto-correct
      const corrected = autoCorrectEntry(entry, previousEntry);
      if (corrected) {
        entry = corrected;

        // Re-validate after correction
        const remainingIssues = validateAgainstPrevious(entry, previousEntry);
        console.log(`After auto-correction: ${remainingIssues.length} issues remaining`);

        return { entry, rawText: text, validationIssues: remainingIssues.length > 0 ? remainingIssues : undefined };
      }
    }
  }

  // No validation or no issues detected
  return { entry, rawText: text, validationIssues: undefined };
}

// Keep old name for backwards compatibility
export const parsePDFFile = parseFile;
