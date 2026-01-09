'use client';

import { BIAEntry, BodyspecScan, BODYSPEC_BIA_MAPPINGS } from '@/lib/types';
import Tooltip from './Tooltip';

interface ComparisonViewProps {
  biaEntry: BIAEntry;
  bodyspecScan: BodyspecScan;
}

export default function ComparisonView({ biaEntry, bodyspecScan }: ComparisonViewProps) {
  const calculateDifference = (biaValue: number, dexaValue: number, expectedVariance?: number) => {
    const diff = biaValue - dexaValue;
    const diffPercent = Math.abs((diff / dexaValue) * 100);
    const isWithinExpected = expectedVariance ? diffPercent <= expectedVariance : true;

    return { diff, diffPercent, isWithinExpected };
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          BIA vs DEXA Comparison
        </h2>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">BIA Date: </span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {new Date(biaEntry.date).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">DEXA Date: </span>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {new Date(bodyspecScan.scanDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-md text-sm text-blue-900 dark:text-blue-100">
          <p className="font-medium mb-2">Understanding the Comparison:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>DEXA scans are considered the gold standard for body composition</li>
            <li>BIA measurements can vary ±3-5% from DEXA due to hydration and other factors</li>
            <li>Green indicators show measurements within expected variance</li>
            <li>Use DEXA as your reference for accurate body composition</li>
          </ul>
        </div>

        {/* Metric comparisons */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Metric
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  BIA
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  DEXA
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Difference
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {BODYSPEC_BIA_MAPPINGS.map((mapping, idx) => {
                const biaValue = biaEntry[mapping.biaKey] as number;
                const dexaValue = bodyspecScan.data[mapping.bodyspecKey as keyof typeof bodyspecScan.data] as number;

                if (typeof biaValue !== 'number' || typeof dexaValue !== 'number') {
                  return null;
                }

                const { diff, diffPercent, isWithinExpected } = calculateDifference(
                  biaValue,
                  dexaValue,
                  mapping.expectedVariance
                );

                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      <Tooltip content={`Expected variance: ±${mapping.expectedVariance}%`}>
                        <span>{mapping.label}</span>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-blue-600 dark:text-blue-400 font-mono">
                      {biaValue.toFixed(1)} {mapping.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-amber-600 dark:text-amber-400 font-mono font-medium">
                      {dexaValue.toFixed(1)} {mapping.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`font-mono ${
                            isWithinExpected
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)} {mapping.unit}
                        </span>
                        <span
                          className={`text-xs ${
                            isWithinExpected
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          ({diffPercent.toFixed(1)}%)
                        </span>
                        {isWithinExpected && (
                          <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Regional breakdown comparison */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Regional Body Composition
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'leftArm', label: 'Left Arm', biaFat: biaEntry.fatLeftArm, biaMuscle: biaEntry.muscleLeftArm },
              { key: 'rightArm', label: 'Right Arm', biaFat: biaEntry.fatRightArm, biaMuscle: biaEntry.muscleRightArm },
              { key: 'trunk', label: 'Trunk', biaFat: biaEntry.fatTrunk, biaMuscle: biaEntry.muscleTrunk },
              { key: 'leftLeg', label: 'Left Leg', biaFat: biaEntry.fatLeftLeg, biaMuscle: biaEntry.muscleLeftLeg },
              { key: 'rightLeg', label: 'Right Leg', biaFat: biaEntry.fatRightLeg, biaMuscle: biaEntry.muscleRightLeg },
            ].map((region) => {
              const dexaRegion = bodyspecScan.data.regional[region.key as keyof typeof bodyspecScan.data.regional];

              return (
                <div key={region.key} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {region.label}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Fat: </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {region.biaFat.lb.toFixed(1)} lb
                      </span>
                      <span className="text-gray-500 mx-1">vs</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {dexaRegion.fat.toFixed(1)} lb
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Lean: </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {region.biaMuscle.lb.toFixed(1)} lb
                      </span>
                      <span className="text-gray-500 mx-1">vs</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {dexaRegion.lean.toFixed(1)} lb
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 text-sm justify-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">BIA (Bioelectrical Impedance)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">DEXA (Gold Standard)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
