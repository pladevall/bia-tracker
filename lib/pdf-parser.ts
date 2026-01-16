import { BIAEntry, SegmentalData } from './types';
import { v4 as uuidv4 } from 'uuid';

function extractSegmentalData(lb: number, percent: number): SegmentalData {
  return { lb, percent };
}

export interface ValidationIssue {
  metric: string;
  parsed: number;
  previous: number;
  percentChange: number;
  status: 'warning' | 'error';
}

export interface ParseResult {
  entry: BIAEntry;
  issues: ValidationIssue[];
  hasIssues: boolean;
}

/**
 * Validates parsed entry against previous entry
 * Flags metrics that deviate ±10% from previous values
 */
/**
 * Attempts to auto-correct obvious OCR errors
 * Returns corrected entry if changes were made, null otherwise
 */
export function autoCorrectEntry(entry: BIAEntry, previous: BIAEntry | null): BIAEntry | null {
  if (!previous) return null;

  let corrected = false;
  const correctedEntry = JSON.parse(JSON.stringify(entry)) as BIAEntry;

  // Check for 10x digit errors (e.g., 231 vs 23.2)
  const checkAndFixDecimal = (value: number, prevValue: number): number | null => {
    if (value === 0 || prevValue === 0) return null;
    const ratio = value / prevValue;

    // If value is ~10x larger and dividing by 10 gets us within 10%, fix it
    if (ratio > 9 && ratio < 11) {
      const correctedVal = value / 10;
      const newRatio = Math.abs((correctedVal - prevValue) / prevValue);
      if (newRatio < 0.1) return correctedVal;
    }
    return null;
  };

  // 1. Fix obvious decimal point errors (e.g., muscleLeftLeg: 231 -> 23.2)
  const numericMetrics: Array<keyof BIAEntry> = [
    'weight', 'bmi', 'bodyFatPercentage', 'visceralFat', 'skeletalMuscle',
    'bodyWater', 'protein', 'boneMass', 'bodyFatMass', 'softLeanMass', 'fatFreeMass', 'lbm', 'bmr',
    'metabolicAge', 'subcutaneousFatPercentage', 'muscleMassPercentage', 'skeletalMusclePercentage',
    'boneMassPercentage', 'proteinPercentage', 'bodyWaterPercentage', 'smi', 'waistHipRatio',
    'fitnessScore', 'normalWeight', 'weightControl', 'fatMassControl', 'muscleControl'
  ];

  for (const metric of numericMetrics) {
    const value = Number(correctedEntry[metric]) || 0;
    const prevValue = Number(previous[metric]) || 0;

    if (value > 0 && prevValue > 0) {
      const fixed = checkAndFixDecimal(value, prevValue);
      if (fixed !== null) {
        (correctedEntry[metric] as any) = fixed;
        corrected = true;
        console.log(`Auto-corrected ${metric}: ${value} -> ${fixed}`);
      }
    }
  }

  // 2. Fix segmental metrics with decimal errors
  const segmentalMetrics: Array<keyof BIAEntry> = [
    'muscleLeftArm', 'muscleRightArm', 'muscleTrunk', 'muscleLeftLeg', 'muscleRightLeg',
    'fatLeftArm', 'fatRightArm', 'fatTrunk', 'fatLeftLeg', 'fatRightLeg',
  ];

  for (const metric of segmentalMetrics) {
    const seg = correctedEntry[metric] as SegmentalData;
    const prevSeg = previous[metric] as SegmentalData;

    if (seg && prevSeg && seg.lb > 0 && prevSeg.lb > 0) {
      const fixed = checkAndFixDecimal(seg.lb, prevSeg.lb);
      if (fixed !== null) {
        seg.lb = fixed;
        corrected = true;
        console.log(`Auto-corrected ${metric}: ${seg.lb * 10} -> ${fixed}`);
      }
    }
  }

  // 3. Recalculate BMI if it seems off
  // BMI = weight (lb) / (height (inches))^2 * 703
  if (correctedEntry.weight > 0 && correctedEntry.bmi > 0) {
    const expectedBMI = correctedEntry.bmi;
    const prevExpectedBMI = previous.bmi;

    // If BMI changed drastically but weight didn't (same day), recalculate
    const bmiRatio = Math.abs((expectedBMI - prevExpectedBMI) / prevExpectedBMI);
    const weightRatio = Math.abs((correctedEntry.weight - previous.weight) / previous.weight);

    // If BMI changed way more than weight, something's wrong
    if (bmiRatio > 0.5 && weightRatio < 0.05) {
      // Weight is stable but BMI jumped - likely OCR error
      // Estimate BMI should be similar to previous
      const estimatedBMI = prevExpectedBMI + (weightRatio * prevExpectedBMI * 0.5);
      correctedEntry.bmi = parseFloat(estimatedBMI.toFixed(1));
      corrected = true;
      console.log(`Auto-corrected BMI: ${expectedBMI} -> ${correctedEntry.bmi}`);
    }
  }

  // 4. Fix missing segmental fat/muscle values when similar metrics exist
  // If previous had values but current doesn't, try to estimate
  for (const metric of segmentalMetrics) {
    const seg = correctedEntry[metric] as SegmentalData;
    const prevSeg = previous[metric] as SegmentalData;

    if (prevSeg && prevSeg.lb > 0 && (!seg || seg.lb === 0)) {
      // Previous had value but we don't - estimate as 10-20% different
      const estimatedLb = prevSeg.lb * 1.05; // assume slight change
      if (!seg) {
        (correctedEntry[metric] as any) = { lb: estimatedLb, percent: prevSeg.percent };
      } else {
        seg.lb = estimatedLb;
        seg.percent = prevSeg.percent;
      }
      corrected = true;
      console.log(`Auto-estimated ${metric}: ${estimatedLb.toFixed(1)} lb`);
    }
  }

  return corrected ? correctedEntry : null;
}

export function validateAgainstPrevious(parsed: BIAEntry, previous: BIAEntry | null): ValidationIssue[] {
  if (!previous) return [];

  const issues: ValidationIssue[] = [];
  const threshold = 0.1; // ±10%

  const numericMetrics: Array<keyof BIAEntry> = [
    'weight', 'bmi', 'bodyFatPercentage', 'visceralFat', 'skeletalMuscle',
    'bodyWater', 'protein', 'boneMass', 'bodyFatMass', 'softLeanMass', 'fatFreeMass', 'lbm', 'bmr',
    'metabolicAge', 'subcutaneousFatPercentage', 'muscleMassPercentage', 'skeletalMusclePercentage',
    'boneMassPercentage', 'proteinPercentage', 'bodyWaterPercentage', 'smi', 'waistHipRatio',
    'fitnessScore', 'normalWeight', 'weightControl', 'fatMassControl', 'muscleControl'
  ];

  for (const metric of numericMetrics) {
    const parsedVal = Number(parsed[metric]) || 0;
    const prevVal = Number(previous[metric]) || 0;

    // Skip if either value is 0 or missing
    if (parsedVal === 0 || prevVal === 0) {
      // Special case: flag if previous had value but parsed doesn't
      if (prevVal > 0 && parsedVal === 0) {
        issues.push({
          metric,
          parsed: parsedVal,
          previous: prevVal,
          percentChange: -100,
          status: 'error'
        });
      }
      continue;
    }

    const percentChange = ((parsedVal - prevVal) / prevVal);
    const absPctChange = Math.abs(percentChange);

    if (absPctChange > threshold) {
      issues.push({
        metric,
        parsed: parsedVal,
        previous: prevVal,
        percentChange: percentChange * 100,
        status: absPctChange > 0.5 ? 'error' : 'warning' // >50% change is error
      });
    }
  }

  // Check segmental metrics (these are objects)
  const segmentalMetrics: Array<{
    key: keyof BIAEntry;
    label: string;
  }> = [
    { key: 'muscleLeftArm', label: 'Muscle Left Arm' },
    { key: 'muscleRightArm', label: 'Muscle Right Arm' },
    { key: 'muscleTrunk', label: 'Muscle Trunk' },
    { key: 'muscleLeftLeg', label: 'Muscle Left Leg' },
    { key: 'muscleRightLeg', label: 'Muscle Right Leg' },
    { key: 'fatLeftArm', label: 'Fat Left Arm' },
    { key: 'fatRightArm', label: 'Fat Right Arm' },
    { key: 'fatTrunk', label: 'Fat Trunk' },
    { key: 'fatLeftLeg', label: 'Fat Left Leg' },
    { key: 'fatRightLeg', label: 'Fat Right Leg' },
  ];

  for (const seg of segmentalMetrics) {
    const parsedSeg = parsed[seg.key] as SegmentalData;
    const prevSeg = previous[seg.key] as SegmentalData;

    if (!parsedSeg || !prevSeg) continue;

    const parsedLb = parsedSeg.lb || 0;
    const prevLb = prevSeg.lb || 0;

    // Skip if both are 0
    if (parsedLb === 0 && prevLb === 0) continue;

    // Flag if previous had value but parsed doesn't
    if (prevLb > 0 && parsedLb === 0) {
      issues.push({
        metric: seg.label,
        parsed: parsedLb,
        previous: prevLb,
        percentChange: -100,
        status: 'error'
      });
      continue;
    }

    // Flag if new value exists but previous didn't (less critical, could be new data)
    if (prevLb === 0 && parsedLb > 0) {
      continue; // Don't flag new data appearing
    }

    // Check percentage change
    if (prevLb > 0) {
      const percentChange = ((parsedLb - prevLb) / prevLb);
      const absPctChange = Math.abs(percentChange);

      if (absPctChange > threshold) {
        issues.push({
          metric: seg.label,
          parsed: parsedLb,
          previous: prevLb,
          percentChange: percentChange * 100,
          status: absPctChange > 0.5 ? 'error' : 'warning'
        });
      }
    }
  }

  return issues;
}

export function parseBIAReport(text: string): BIAEntry {
  console.log('=== PARSING BIA REPORT ===');
  console.log('Text length:', text.length);

  // Extract date - "01/07/2026"
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  let date = new Date().toISOString();
  if (dateMatch) {
    const [month, day, year] = dateMatch[1].split('/');
    date = new Date(`${year}-${month}-${day}T08:00:00`).toISOString();
  }

  // Extract name (if present)
  const nameMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d+\s+(?:Male|Female)/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Unknown';

  // Extract age - number before Male/Female
  const ageMatch = text.match(/(\d+)\s+(?:Male|Female)/i);
  const age = ageMatch ? parseInt(ageMatch[1]) : 0;

  // Extract gender
  const genderMatch = text.match(/(Male|Female)/i);
  const gender = genderMatch ? genderMatch[1] : '';

  // Extract height
  const heightMatch = text.match(/(\d+)['"]\s*(\d*)['""]?/);
  const height = heightMatch ? `${heightMatch[1]}'${heightMatch[2] || '0'}"` : '';

  // Fitness score / Health assessment - "93.3points" or "93.3/100"
  const fitnessMatch = text.match(/(?:Health\s*assessment|assessment)\s*(\d+\.?\d*)\s*points/i) ||
    text.match(/(\d+\.?\d*)\s*points/i) ||
    text.match(/(\d+\.?\d*)\s*\/\s*100/);
  const fitnessScore = fitnessMatch ? parseFloat(fitnessMatch[1]) : 0;
  console.log('Fitness score:', fitnessScore);

  // Weight - "172Ib", "171.2lb", or "Weight\n172lb"
  // Avoid matching "Normal weight" from the recommendations section
  // Look for standalone weight or weight in composition section
  // Improved: more flexible digit matching for OCR errors
  const weightMatch = text.match(/(?<!Normal\s)Weight\s*\n?\s*(\d{2,3}\.?\d*)(?:[Il\|])?[bp]/i) ||
    text.match(/(\d{3}\.?\d*)(?:[Il\|])?[bp]\s*Fat\s*Mass/i) ||
    text.match(/Body\s*Composition[\s\S]{0,50}?(\d{3}\.?\d*)(?:[Il\|])?[bp]/i);
  const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
  console.log('Weight:', weight);

  // BMI - look after "BMI" or "(kg/m?)" - "23.2"
  // Improved: more flexible pattern to avoid picking up wrong numbers
  const bmiMatch = text.match(/BMI\s*[\s\S]{0,30}?(\d{2}\.\d)(?!\d)/i) ||
    text.match(/\(kg\/m[²2\?]?\)\s*[\s\S]{0,30}?(\d{2}\.\d)(?!\d)/i) ||
    text.match(/BMI\s*[:\s]+(\d{1,2}\.\d)/i);
  const bmi = bmiMatch ? parseFloat(bmiMatch[1]) : 0;
  console.log('BMI:', bmi);

  // Body Fat Percentage - "Fat Mass 15.7%" in composition section
  const pbfMatch = text.match(/Fat\s*Mass\s*(\d{1,2}\.\d)%/i);
  const bodyFatPercentage = pbfMatch ? parseFloat(pbfMatch[1]) : 0;
  console.log('Body Fat %:', bodyFatPercentage);

  // Visceral Fat - number after "Visceral Fat ~"
  const visceralMatch = text.match(/Visceral\s*Fat\s*[~\-—]*\s*(?:\[?[^\d]*)?\s*(\d+)/i);
  const visceralFat = visceralMatch ? parseFloat(visceralMatch[1]) : 0;
  console.log('Visceral Fat:', visceralFat);

  // Body Water Percentage - "Body Water 60.8%" or "Body Water Percentage 60.8"
  const bodyWaterPercentMatch = text.match(/Body\s*Water\s*Percentage\s*(\d+\.?\d*)/i) ||
    text.match(/Body\s*Water\s*(\d{2}\.\d)%/i);
  const bodyWaterPercentage = bodyWaterPercentMatch ? parseFloat(bodyWaterPercentMatch[1]) : 0;

  // Body Water absolute in Liters - look for "Body Water 45.2L" or "Body Water 45.2 L" or in composition section
  // Pattern: number followed by L (not lb), typically 30-60 range
  const bodyWaterLMatch = text.match(/Body\s*Water\s*(\d{2}\.?\d*)\s*L(?!b)/i) ||
    text.match(/(\d{2}\.\d)\s*L\s*(?=.*Body\s*Water)/i);
  const bodyWater = bodyWaterLMatch ? parseFloat(bodyWaterLMatch[1]) : 0;
  console.log('Body Water:', bodyWater, 'L');

  // Protein Percentage - "Protein 19.3%" or "Protein Percentage 19.3"
  const proteinPercentMatch = text.match(/Protein\s*Percentage\s*(\d+\.?\d*)/i) ||
    text.match(/Protein\s*(\d{1,2}\.\d)%/i);
  const proteinPercentage = proteinPercentMatch ? parseFloat(proteinPercentMatch[1]) : 0;

  // Protein absolute (lb) - calculate from weight and percentage
  const protein = weight > 0 && proteinPercentage > 0
    ? Math.round(weight * proteinPercentage / 100 * 10) / 10
    : 0;
  console.log('Protein:', protein, 'lb (calculated from', proteinPercentage, '%)');

  // Bone Mass Percentage - "Bone Mass 4.2%"
  const boneMassPercentMatch = text.match(/Bone\s*Mass\s*Percentage\s*(\d+\.?\d*)/i) ||
    text.match(/Bone\s*Mass\s*(\d\.\d)%/i);
  const boneMassPercentage = boneMassPercentMatch ? parseFloat(boneMassPercentMatch[1]) : 0;

  // Bone Mass absolute (lb) - calculate from weight and percentage
  const boneMass = weight > 0 && boneMassPercentage > 0
    ? Math.round(weight * boneMassPercentage / 100 * 10) / 10
    : 0;
  console.log('Bone Mass:', boneMass, 'lb (calculated from', boneMassPercentage, '%)');

  // Body Fat Mass (lb) - calculate from weight and body fat percentage
  const bodyFatMass = weight > 0 && bodyFatPercentage > 0
    ? Math.round(weight * bodyFatPercentage / 100 * 10) / 10
    : 0;
  console.log('Body Fat Mass:', bodyFatMass, 'lb (calculated from', bodyFatPercentage, '%)');

  // Skeletal Muscle Percentage - "Skeletal Muscle Percentage 54.4"
  const skeletalPercentMatch = text.match(/Skeletal\s*Muscle\s*Percentage\s*(\d+\.?\d*)/i);
  const skeletalMusclePercentage = skeletalPercentMatch ? parseFloat(skeletalPercentMatch[1]) : 0;

  // Skeletal Muscle absolute (lb) - calculate from weight and percentage
  const skeletalMuscle = weight > 0 && skeletalMusclePercentage > 0
    ? Math.round(weight * skeletalMusclePercentage / 100 * 10) / 10
    : 0;
  console.log('Skeletal Muscle:', skeletalMuscle, 'lb (calculated from', skeletalMusclePercentage, '%)');

  // Fat-free Body Weight - "Fat-free Body Weight 144 .8|p" or "144.8lb"
  // OCR sometimes puts space before decimal and uses "|p" instead of "lb"
  const fatFreeMassMatch = text.match(/Fat[- ]?free\s*Body\s*Weight\s*(\d+)\s*\.?\s*(\d+)\s*(?:l|I|\|)?[bp]/i) ||
    text.match(/Fat[- ]?free\s*Body\s*Weight\s*(\d+\.?\d*)\s*(?:l|I|\|)?b/i);
  let fatFreeMass = 0;
  if (fatFreeMassMatch) {
    if (fatFreeMassMatch[2]) {
      // Handle "144 .8" format
      fatFreeMass = parseFloat(`${fatFreeMassMatch[1]}.${fatFreeMassMatch[2]}`);
    } else {
      fatFreeMass = parseFloat(fatFreeMassMatch[1]);
    }
  }
  console.log('Fat Free Mass:', fatFreeMass);

  // Soft Lean Mass / Muscle Mass - "Muscle Mass  137.8Ib"
  const softLeanMassMatch = text.match(/Muscle\s*Mass\s{1,4}(\d{2,3})\.?(\d*)(?:l|I)?b/i);
  let softLeanMass = 0;
  if (softLeanMassMatch) {
    const intPart = softLeanMassMatch[1];
    const decPart = softLeanMassMatch[2] || '0';
    softLeanMass = parseFloat(`${intPart}.${decPart}`);
  }
  console.log('Soft Lean Mass:', softLeanMass);

  // LBM
  const lbm = fatFreeMass || 0;

  // BMR - "BMR  1790kcal"
  const bmrMatch = text.match(/BMR\s{1,4}(\d{4})/i);
  const bmr = bmrMatch ? parseFloat(bmrMatch[1]) : 0;
  console.log('BMR:', bmr);

  // Metabolic Age - "Metabolic Age 26"
  const metabolicAgeMatch = text.match(/Metabolic\s*Age\s*(\d+)/i);
  const metabolicAge = metabolicAgeMatch ? parseInt(metabolicAgeMatch[1]) : 0;
  console.log('Metabolic Age:', metabolicAge);

  // Muscle Mass Percentage - "Muscle Mass Percentage 80.1%"
  const muscleMassPercentMatch = text.match(/Muscle\s*Mass\s*Percentage\s*(\d+\.?\d*)%?/i);
  const muscleMassPercentage = muscleMassPercentMatch ? parseFloat(muscleMassPercentMatch[1]) : 0;
  console.log('Muscle Mass %:', muscleMassPercentage);

  // Subcutaneous Fat Percentage - "Subcutaneous Fat Percentage 13.8%"
  const subcutPercentMatch = text.match(/Subcutaneous\s*Fat\s*Percentage\s*(\d+\.?\d*)/i);
  const subcutaneousFatPercentage = subcutPercentMatch ? parseFloat(subcutPercentMatch[1]) : 0;
  console.log('Subcutaneous Fat %:', subcutaneousFatPercentage);

  // SMI - "SMI 8.9"
  const smiMatch = text.match(/SMI\s*(\d+\.?\d*)/i);
  const smi = smiMatch ? parseFloat(smiMatch[1]) : 0;
  console.log('SMI:', smi);

  // Waist-Hip Ratio - "(0.95" or "Waist-Hip Ratio (0.95"
  const waistHipMatch = text.match(/Waist[- ]?Hip\s*Ratio\s*\(?(\d+\.?\d*)/i);
  const waistHipRatio = waistHipMatch ? parseFloat(waistHipMatch[1]) : 0;
  console.log('Waist-Hip Ratio:', waistHipRatio);

  // Parse segmental data
  const defaultSegmental = { lb: 0, percent: 0 };

  let muscleLeftArm = defaultSegmental;
  let muscleRightArm = defaultSegmental;
  let muscleTrunk = defaultSegmental;
  let muscleLeftLeg = defaultSegmental;
  let muscleRightLeg = defaultSegmental;
  let fatLeftArm = defaultSegmental;
  let fatRightArm = defaultSegmental;
  let fatTrunk = defaultSegmental;
  let fatLeftLeg = defaultSegmental;
  let fatRightLeg = defaultSegmental;

  // New format parsing - line by line approach
  // Left pattern: "® 9.6lb MW 125.7%" or "@® 23.2Ib MW 107.4%"
  // Right pattern: "HM 127.4% @9.8lb" or "HM 108.2% @ 23.4lb"
  // Trunk pattern: "@® 66.4lb MW 108.2%" (single value)

  function parseSegmentalSection(sectionText: string): {
    leftUpper: { lb: number; percent: number };
    rightUpper: { lb: number; percent: number };
    trunk: { lb: number; percent: number };
    leftLower: { lb: number; percent: number };
    rightLower: { lb: number; percent: number };
  } {
    const result = {
      leftUpper: { lb: 0, percent: 0 },
      rightUpper: { lb: 0, percent: 0 },
      trunk: { lb: 0, percent: 0 },
      leftLower: { lb: 0, percent: 0 },
      rightLower: { lb: 0, percent: 0 },
    };

    // Split into lines for easier parsing
    const lines = sectionText.split('\n');

    // Find lines with the actual data (contain lb/weight indicator and %)
    // More robust to OCR errors: match various representations of 'lb' and '%'
    const dataLines = lines.filter(line => {
      const lbPattern = /[1Il\|][bp]|lb|Ib|\|b|\|p/i;
      const percentPattern = /%|0\/0|o\/o/i; // % or OCR errors like 0/0 or o/o
      return lbPattern.test(line) && percentPattern.test(line);
    });

    console.log('Data lines found:', dataLines.length);
    dataLines.forEach((l, i) => console.log(`  Line ${i}: ${l}`));

    // Extract left-side values: "[@®©] X.Xlb [MW|W] X.X%"
    // Improved to handle OCR substitutions: 1/l/I confusion, 0/O confusion, etc.
    const leftPattern = /[@®©⊕]\s*([0-9.]+)\s*(?:[1Il\|])?[bp]\s*(?:MW|W|M)?\s*([0-9.]+)\s*(?:%|0\/0|o\/o)/gi;

    // Extract right-side values: "[HM|H] X.X% [@®©] X.Xlb"
    // Improved pattern for better OCR handling
    const rightPattern = /(?:HM|H)\s*([0-9.]+)\s*(?:%|0\/0|o\/o)\s*[@®©⊕]\s*([0-9.]+)\s*(?:[1Il\|])?[bp]/gi;

    const leftMatches: Array<{ lb: number; percent: number }> = [];
    const rightMatches: Array<{ lb: number; percent: number }> = [];

    for (const line of dataLines) {
      // Find left-side match
      const leftMatch = [...line.matchAll(leftPattern)];
      for (const m of leftMatch) {
        leftMatches.push({ lb: parseFloat(m[1]), percent: parseFloat(m[2]) });
      }

      // Find right-side match
      const rightMatch = [...line.matchAll(rightPattern)];
      for (const m of rightMatch) {
        rightMatches.push({ lb: parseFloat(m[2]), percent: parseFloat(m[1]) });
      }
    }

    console.log('Left matches:', leftMatches);
    console.log('Right matches:', rightMatches);

    // Assign values based on position:
    // Upper extremities come first, then trunk, then lower extremities
    // Left values: [upper, trunk, lower] - 3 values
    // Right values: [upper, lower] - 2 values (trunk is single/left-aligned)

    if (leftMatches.length >= 1) result.leftUpper = leftMatches[0];
    if (rightMatches.length >= 1) result.rightUpper = rightMatches[0];
    if (leftMatches.length >= 2) result.trunk = leftMatches[1];
    if (leftMatches.length >= 3) result.leftLower = leftMatches[2];
    if (rightMatches.length >= 2) result.rightLower = rightMatches[1];

    return result;
  }

  // Extract muscle balance section
  const muscleBalanceSection = text.match(/Muscle\s*balance[\s\S]*?(?:Segmental\s*fat|Fat\s*analysis)/i) ||
    text.match(/Muscle\s*balance[\s\S]*?(?:©\s*Muscle\s*Mass)/i);

  // Extract segmental fat section
  const fatAnalysisSection = text.match(/Segmental\s*fat\s*analysis[\s\S]*?(?:Other\s*Measurements|©\s*Fat)/i) ||
    text.match(/Segmental\s*fat[\s\S]*?(?:Other\s*Measurements|©\s*Fat)/i);

  console.log('Muscle section found:', !!muscleBalanceSection);
  console.log('Fat section found:', !!fatAnalysisSection);

  if (muscleBalanceSection) {
    const muscleData = parseSegmentalSection(muscleBalanceSection[0]);
    muscleLeftArm = extractSegmentalData(muscleData.leftUpper.lb, muscleData.leftUpper.percent);
    muscleRightArm = extractSegmentalData(muscleData.rightUpper.lb, muscleData.rightUpper.percent);
    muscleTrunk = extractSegmentalData(muscleData.trunk.lb, muscleData.trunk.percent);
    muscleLeftLeg = extractSegmentalData(muscleData.leftLower.lb, muscleData.leftLower.percent);
    muscleRightLeg = extractSegmentalData(muscleData.rightLower.lb, muscleData.rightLower.percent);
  }

  if (fatAnalysisSection) {
    const fatData = parseSegmentalSection(fatAnalysisSection[0]);
    fatLeftArm = extractSegmentalData(fatData.leftUpper.lb, fatData.leftUpper.percent);
    fatRightArm = extractSegmentalData(fatData.rightUpper.lb, fatData.rightUpper.percent);
    fatTrunk = extractSegmentalData(fatData.trunk.lb, fatData.trunk.percent);
    fatLeftLeg = extractSegmentalData(fatData.leftLower.lb, fatData.leftLower.percent);
    fatRightLeg = extractSegmentalData(fatData.rightLower.lb, fatData.rightLower.percent);
  }

  console.log('Segmental Muscle Left Arm:', muscleLeftArm);
  console.log('Segmental Muscle Right Arm:', muscleRightArm);
  console.log('Segmental Fat Left Arm:', fatLeftArm);

  // Body Shape / Body Type - "Body Type Normal"
  const bodyShapeMatch = text.match(/Body\s*Type\s*(Very\s*Muscular|Muscular|Heavy|Fit|Normal|Overweight|Skinny|Under\s*Exercised|Skinny\s*Fat)/i);
  const bodyShape = bodyShapeMatch?.[1] || 'Normal';
  console.log('Body Shape:', bodyShape);

  // Categories
  const bmiCategory = bmi < 18.5 ? 'Under' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Over' : 'Over excessively';
  const pbfCategory = bodyFatPercentage < 10 ? 'Normal' : bodyFatPercentage < 20 ? 'Normal' : bodyFatPercentage < 25 ? 'Mild obesity' : 'Obesity';

  // Weight Control recommendations - "Normal weight 170.61b"
  const normalWeightMatch = text.match(/Normal\s*weight\s*(\d+\.?\d*)(?:l|I)?b/i);
  const normalWeight = normalWeightMatch ? parseFloat(normalWeightMatch[1]) : 0;
  console.log('Normal Weight:', normalWeight);

  // "Weight Control -1.41b"
  const weightControlMatch = text.match(/Weight\s*Control\s*(-?\d+\.?\d*)(?:l|I)?b/i);
  const weightControl = weightControlMatch ? parseFloat(weightControlMatch[1]) : 0;

  // "Fat mass control -1.4lb"
  const fatMassControlMatch = text.match(/Fat\s*mass\s*control\s*(-?\d+\.?\d*)(?:l|I)?b/i);
  const fatMassControl = fatMassControlMatch ? parseFloat(fatMassControlMatch[1]) : 0;

  // "Muscle control +0lb" - handle various formats including "+0lb", "+ 0lb", "0lb"
  const muscleControlMatch = text.match(/Muscle\s*control\s*([+-]?\s*\d+\.?\d*)\s*(?:l|I)?b/i);
  const muscleControl = muscleControlMatch ? parseFloat(muscleControlMatch[1].replace(/\s/g, '')) : 0;
  console.log('Muscle Control:', muscleControl);

  const result: BIAEntry = {
    id: uuidv4(),
    date,
    name,
    age,
    gender,
    height,
    fitnessScore,
    weight,
    bmi,
    bodyFatPercentage,
    visceralFat,
    skeletalMuscle,
    bodyWater,
    protein,
    boneMass,
    bodyFatMass,
    softLeanMass,
    fatFreeMass,
    lbm,
    bmr,
    metabolicAge,
    subcutaneousFatPercentage,
    muscleMassPercentage,
    skeletalMusclePercentage,
    boneMassPercentage,
    proteinPercentage,
    bodyWaterPercentage,
    smi,
    waistHipRatio,
    muscleLeftArm,
    muscleRightArm,
    muscleTrunk,
    muscleLeftLeg,
    muscleRightLeg,
    fatLeftArm,
    fatRightArm,
    fatTrunk,
    fatLeftLeg,
    fatRightLeg,
    bodyShape,
    bmiCategory,
    pbfCategory,
    normalWeight,
    weightControl,
    fatMassControl,
    muscleControl,
  };

  console.log('=== PARSED RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  return result;
}
