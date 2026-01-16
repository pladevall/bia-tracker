import { ReactNode } from 'react';

export type SectionColor = 'gray' | 'purple' | 'orange' | 'blue';

interface TimeSeriesTableProps<T> {
    /** The content to display in the top-left sticky header cell */
    headerLabel: ReactNode;
    /** Content for fixed header columns (between label and scrollable columns) */
    headerFixedContent?: ReactNode;
    /** The data objects to render columns for */
    columns: T[];
    /** Function to render a column header */
    renderColumnHeader: (item: T) => ReactNode;
    /** The table body content */
    children: ReactNode;
    /** className props */
    className?: string;
    /** Min width for the sticky column (default: 180px) */
    stickyColumnWidth?: string;
}

export function TimeSeriesTable<T>({
    headerLabel,
    headerFixedContent,
    columns,
    renderColumnHeader,
    children,
    className = '',
    stickyColumnWidth = 'min-w-[180px]',
}: TimeSeriesTableProps<T>) {
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className={`sticky left-0 z-30 bg-white dark:bg-gray-900 px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${stickyColumnWidth}`}>
                            {headerLabel}
                        </th>
                        {headerFixedContent}
                        {columns.map(renderColumnHeader)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {children}
                </tbody>
            </table>
        </div>
    );
}

interface TimeSeriesRowProps<T = any> {
    label: ReactNode;
    fixedContent?: ReactNode;
    children?: ReactNode; // The data cells (optional if columns used)
    className?: string; // Additional classes for the row
    labelClassName?: string; // Additional classes for the label cell
    onClick?: () => void;
    stickyColumnWidth?: string;
    columns?: T[];
    renderCell?: (item: T, index: number) => ReactNode;
}

export function TimeSeriesRow<T = any>({
    label,
    fixedContent,
    children,
    className = '',
    labelClassName = '',
    onClick,
    stickyColumnWidth = 'min-w-[180px]',
    columns,
    renderCell,
}: TimeSeriesRowProps<T>) {
    return (
        <tr
            className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${className}`}
            onClick={onClick}
        >
            <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 px-4 py-1.5 text-xs text-gray-600 dark:text-gray-300 ${stickyColumnWidth} ${labelClassName}`}>
                {label}
            </td>
            {fixedContent}
            {children}
            {columns && renderCell && columns.map((item, i) => renderCell(item, i))}
        </tr>
    );
}

interface SectionHeaderRowProps<T> {
    label: ReactNode;
    color?: SectionColor;
    isExpanded?: boolean;
    onToggle?: () => void;
    /** Helper to render empty cells for columns if needed, though usually handled by CSS/colspan or explicit empty cells */
    columnCount?: number;
    fixedCellsCount?: number; // Number of fixed cells between label and data columns
    fixedContent?: ReactNode; // Content for the fixed cells
}

const COLOR_STYLES: Record<SectionColor, {
    labelBg: string; // bg for sticky label
    labelText: string; // text color for label
    rowBg: string; // bg for rest of row
    border: string; // border color
}> = {
    gray: {
        labelBg: 'bg-gray-50 dark:bg-gray-900',
        labelText: 'text-gray-600 dark:text-gray-300',
        rowBg: 'bg-gray-50 dark:bg-gray-900',
        border: 'border-gray-100 dark:border-gray-800',
    },
    purple: {
        labelBg: 'bg-purple-50 dark:bg-purple-900/40',
        labelText: 'text-purple-700 dark:text-purple-300',
        rowBg: 'bg-purple-50/50 dark:bg-purple-900/20', // Row body can stay slightly transparent if desired, but label should be opaque
        border: 'border-gray-100 dark:border-gray-800',
    },
    orange: {
        labelBg: 'bg-orange-50 dark:bg-orange-900/40',
        labelText: 'text-orange-700 dark:text-orange-300',
        rowBg: 'bg-orange-50/50 dark:bg-orange-900/20',
        border: 'border-gray-100 dark:border-gray-800',
    },
    blue: { // For standard content if needed, or filter rows
        labelBg: 'bg-blue-50/50 dark:bg-blue-900/20',
        labelText: 'text-blue-700 dark:text-blue-300',
        rowBg: 'bg-blue-50/30 dark:bg-blue-900/10',
        border: 'border-gray-100 dark:border-gray-800/50',
    }
};

export function SectionHeaderRow({
    label,
    color = 'gray',
    isExpanded,
    onToggle,
    columnCount = 0,
    fixedCellsCount = 0,
    fixedContent,
}: SectionHeaderRowProps<any>) {
    const styles = COLOR_STYLES[color];
    const totalCells = columnCount;

    return (
        <tr
            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}
            onClick={onToggle}
        >
            <td className={`sticky left-0 z-10 ${styles.labelBg} px-4 py-2 text-xs font-medium ${styles.labelText} min-w-[180px]`}>
                <span className="inline-flex items-center gap-1.5">
                    {onToggle && (
                        <svg
                            className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                    {label}
                </span>
            </td>

            {/* Context for fixed columns */}
            {fixedContent ? (
                fixedContent
            ) : (
                // If no fixed content, render empty cells for fixed count
                Array.from({ length: fixedCellsCount }).map((_, i) => (
                    <td key={`fixed-${i}`} className={`${styles.rowBg} border-l ${styles.border}`} />
                ))
            )}

            {/* Scrollable column placeholders */}
            {Array.from({ length: totalCells }).map((_, i) => (
                <td key={i} className={`${styles.rowBg} border-l ${styles.border}`} />
            ))}
        </tr>
    );
}
