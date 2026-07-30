import React from 'react';

interface QuotaPieChartProps {
    remaining: number;
    total: number;
    compact?: boolean;
}

const QuotaPieChart: React.FC<QuotaPieChartProps> = ({ remaining, total, compact = false }) => {
    // Ensure valid numbers
    const safeTotal = total > 0 ? total : 1073741824; // Default to 1GB if invalid

    // Safety check: If remaining is null/undefined/NaN, assume it equals total (0% used)
    // Javascript Math.max(0, null) is 0, which is wrong for us (would mean 100% used)
    const safeRemaining = (remaining === undefined || remaining === null || isNaN(remaining))
        ? safeTotal
        : Math.max(0, remaining);

    // Calculate used amount
    const used = safeTotal - safeRemaining;

    // Calculate percentage used
    const percentage = Math.min(100, (used / safeTotal) * 100);

    // Chart parameters
    const size = compact ? 32 : 50;
    const strokeWidth = compact ? 4 : 6;

    // Color determination (Usage Based)
    let strokeColor = "text-green-700 dark:text-green-500"; // Low usage (< 50%)
    let arcColor = "#15803d";
    if (percentage > 90) {
        strokeColor = "text-red-700 dark:text-red-500"; // Critical usage (> 90%)
        arcColor = "#b91c1c";
    } else if (percentage > 75) {
        strokeColor = "text-orange-700 dark:text-orange-500"; // High usage (75-90%)
        arcColor = "#c2410c";
    } else if (percentage > 50) {
        strokeColor = "text-yellow-700 dark:text-yellow-500"; // Medium usage (50-75%)
        arcColor = "#a16207";
    }

    // Format helper within component
    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const chart = (
        <div className="relative">
            <div
                className="relative rounded-full bg-gray-200 dark:bg-gray-700 transition-all duration-500"
                style={{
                    width: size,
                    height: size,
                    backgroundImage: `conic-gradient(from -90deg, ${arcColor} ${percentage}%, transparent ${percentage}% 100%)`,
                }}
            >
                <div
                    className="absolute rounded-full bg-gray-50 dark:bg-gray-900"
                    style={{
                        top: strokeWidth,
                        left: strokeWidth,
                        right: strokeWidth,
                        bottom: strokeWidth,
                    }}
                />
            </div>
            {/* Text in center */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold ${strokeColor}`}>
                    {Math.round(percentage)}%
                </span>
            </div>
        </div>
    );

    if (compact) {
        return chart;
    }

    return (
        <div className="flex items-center gap-3">
            {chart}
            <div className="flex flex-col text-xs">
                <span className="font-medium text-gray-900 dark:text-white">
                    {formatSize(used)} used
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                    of {formatSize(safeTotal)}
                </span>
            </div>
        </div>
    );
};

export default QuotaPieChart;
