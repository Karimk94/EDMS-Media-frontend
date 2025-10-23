import React from 'react';

interface DateRangePickerProps {
    dateFrom: string;
    setDateFrom: (date: string) => void;
    dateTo: string;
    setDateTo: (date: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ dateFrom, setDateFrom, dateTo, setDateTo }) => {
    const handleClear = () => {
        setDateFrom('');
        setDateTo('');
    };

    return (
        <div className="space-y-2">
            {/* 'From' date input */}
            <div className="flex items-center gap-2">
                <label htmlFor="dateFrom" className="text-sm text-gray-400 w-12">From:</label>
                <input
                    id="dateFrom"
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
            </div>
            {/* 'To' date input */}
            <div className="flex items-center gap-2">
                <label htmlFor="dateTo" className="text-sm text-gray-400 w-12">To:</label>
                <input
                    id="dateTo"
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
            </div>
            {/* Clear button, only shown if a date is selected */}
            {(dateFrom || dateTo) && (
                <button
                    onClick={handleClear}
                    className="w-full mt-2 text-center text-sm text-red-400 hover:text-red-300"
                    aria-label="Clear date range"
                >
                    Clear Dates
                </button>
            )}
        </div>
    );
};
