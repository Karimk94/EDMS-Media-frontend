import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PerformanceSummary, PerformanceRow, UserPerformanceDocument } from '../../../hooks/useAdmin';

export interface GeneratePdfReportOptions {
    summary: PerformanceSummary;
    rows: PerformanceRow[];
    filterCriteria: {
        dateFrom?: string;
        dateTo?: string;
        username?: string;
        userFullName?: string;
        groupBy: string;
        scope: string;
    };
    generatedBy?: string;
    userDetails?: {
        monthlyTrend?: { month: string; total_uploads: number; completed_count: number; pending_count: number; completion_rate: number }[];
        recentDocs?: UserPerformanceDocument[];
    };
}

export function generatePerformancePdfReport(options: GeneratePdfReportOptions): void {
    const { summary, rows, filterCriteria, generatedBy, userDetails } = options;

    // Use landscape if there are many columns or table is wide
    const isLandscape = filterCriteria.groupBy === 'user' || filterCriteria.groupBy === 'user_monthly';
    const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const primaryColor: [number, number, number] = [30, 58, 138]; // Blue-900 / Navy
    const accentColor: [number, number, number] = [37, 99, 235];  // Blue-600
    const successColor: [number, number, number] = [16, 185, 129]; // Emerald
    const warningColor: [number, number, number] = [245, 158, 11]; // Amber
    const darkText: [number, number, number] = [30, 41, 59];     // Slate-800
    const lightText: [number, number, number] = [100, 116, 139]; // Slate-500

    let currentY = 14;

    // -------------------------------------------------------------------------
    // 1. Header Banner
    // -------------------------------------------------------------------------
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, currentY, contentWidth, 26, 3, 3, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('EDMS MEDIA - USER PERFORMANCE & UPLOAD AUDIT REPORT', margin + 8, currentY + 11);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225); // Slate-300
    const scopeLabel = filterCriteria.scope === 'media' ? 'EDMS Media (Photos & Media Scope)' : 'All System Documents Scope';
    doc.text(`Tracking document uploads & completion performance • ${scopeLabel}`, margin + 8, currentY + 19);

    // Right header metadata
    const nowStr = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    doc.text(`Generated: ${nowStr}`, pageWidth - margin - 8, currentY + 11, { align: 'right' });
    if (generatedBy) {
        doc.text(`Admin: ${generatedBy}`, pageWidth - margin - 8, currentY + 19, { align: 'right' });
    }

    currentY += 32;

    // -------------------------------------------------------------------------
    // 2. Filter & Scope Summary Card
    // -------------------------------------------------------------------------
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkText);

    // Column 1: Date Range
    const dateRangeLabel = (filterCriteria.dateFrom || filterCriteria.dateTo)
        ? `${filterCriteria.dateFrom || 'Earliest'}  to  ${filterCriteria.dateTo || 'Present'}`
        : 'All Time (No date restrictions)';
    doc.text('Date Filter:', margin + 6, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightText);
    doc.text(dateRangeLabel, margin + 26, currentY + 7);

    // Column 2: Target User
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    const col2X = margin + (contentWidth / 3);
    doc.text('Target User:', col2X, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightText);
    const userLabel = filterCriteria.username
        ? (filterCriteria.userFullName ? `${filterCriteria.userFullName} (${filterCriteria.username})` : filterCriteria.username)
        : 'All Uploading Users';
    doc.text(userLabel, col2X + 22, currentY + 7);

    // Column 3: Grouping
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    const col3X = margin + (contentWidth * 2 / 3);
    doc.text('Grouping:', col3X, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightText);
    const groupMap: Record<string, string> = {
        user: 'By User (Default)',
        month: 'Monthly Horizon',
        week: 'Weekly Horizon',
        day: 'Daily Horizon',
        user_monthly: 'By User & Month',
    };
    doc.text(groupMap[filterCriteria.groupBy] || filterCriteria.groupBy, col3X + 18, currentY + 7);

    // Row 2 of metadata: Summary count overview
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...lightText);
    const rowsSummary = `Records in view: ${rows.length} ${filterCriteria.groupBy === 'user' ? 'users' : 'periods'} | Active Uploaders: ${summary.active_users_count || 0}`;
    doc.text(rowsSummary, margin + 6, currentY + 14);

    currentY += 24;

    // -------------------------------------------------------------------------
    // 3. KPI Executive Summary Cards
    // -------------------------------------------------------------------------
    const cardGap = 4;
    const cardCount = 5;
    const cardWidth = (contentWidth - (cardCount - 1) * cardGap) / cardCount;
    const cardHeight = 22;

    const cardsData = [
        {
            title: 'TOTAL UPLOADS',
            value: (summary.total_uploads || 0).toLocaleString(),
            color: primaryColor,
            bgColor: [239, 246, 255] as [number, number, number], // Blue-50
            border: [191, 219, 254] as [number, number, number],
        },
        {
            title: 'COMPLETED',
            value: (summary.total_completed || 0).toLocaleString(),
            color: successColor,
            bgColor: [236, 253, 245] as [number, number, number], // Emerald-50
            border: [167, 243, 208] as [number, number, number],
        },
        {
            title: 'PENDING REVIEW',
            value: (summary.total_pending || 0).toLocaleString(),
            color: warningColor,
            bgColor: [255, 251, 235] as [number, number, number], // Amber-50
            border: [253, 230, 138] as [number, number, number],
        },
        {
            title: 'COMPLETION RATE',
            value: `${summary.overall_completion_rate || 0}%`,
            color: (summary.overall_completion_rate >= 80 ? successColor : (summary.overall_completion_rate >= 50 ? warningColor : [239, 68, 68])) as [number, number, number],
            bgColor: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
        },
        {
            title: 'ACTIVE UPLOADERS',
            value: (summary.active_users_count || 0).toLocaleString(),
            color: accentColor,
            bgColor: [245, 243, 255] as [number, number, number], // Purple-50
            border: [221, 214, 254] as [number, number, number],
        },
    ];

    cardsData.forEach((c, idx) => {
        const cardX = margin + idx * (cardWidth + cardGap);
        doc.setFillColor(...c.bgColor);
        doc.setDrawColor(...c.border);
        doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

        // Top accent line
        doc.setFillColor(...c.color);
        doc.rect(cardX, currentY, cardWidth, 1.8, 'F');

        // Card title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...lightText);
        doc.text(c.title, cardX + cardWidth / 2, currentY + 7.5, { align: 'center' });

        // Card big value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...c.color);
        doc.text(c.value, cardX + cardWidth / 2, currentY + 16.5, { align: 'center' });
    });

    currentY += cardHeight + 8;

    // -------------------------------------------------------------------------
    // 4. Main Performance Table
    // -------------------------------------------------------------------------
    let tableHead: string[][] = [];
    let tableBody: (string | number)[][] = [];

    const isPeriodGroup = ['month', 'week', 'day'].includes(filterCriteria.groupBy);

    if (filterCriteria.groupBy === 'user_monthly') {
        tableHead = [
            ['#', 'User ID', 'Full Name', 'Month', 'Total Uploads', 'Completed', 'Pending', 'Completion Rate']
        ];
        tableBody = rows.map((r, i) => [
            i + 1,
            r.username || 'Unknown',
            r.full_name || r.username || 'Unknown',
            r.period || 'N/A',
            (r.total_uploads || 0).toLocaleString(),
            (r.completed_count || 0).toLocaleString(),
            (r.pending_count || 0).toLocaleString(),
            `${r.completion_rate || 0}%`,
        ]);
    } else if (isPeriodGroup) {
        tableHead = [
            ['#', 'Time Horizon', 'Total Uploads', 'Completed Pictures', 'Pending Pictures', 'Completion Rate', 'Active Uploaders', 'First Activity', 'Last Activity']
        ];
        tableBody = rows.map((r, i) => [
            i + 1,
            r.period || 'N/A',
            (r.total_uploads || 0).toLocaleString(),
            (r.completed_count || 0).toLocaleString(),
            (r.pending_count || 0).toLocaleString(),
            `${r.completion_rate || 0}%`,
            (r.active_users_count || 0).toLocaleString(),
            r.first_upload ? r.first_upload.split('T')[0] : 'N/A',
            r.last_upload ? r.last_upload.split('T')[0] : 'N/A',
        ]);
    } else {
        // Default: By User
        tableHead = [
            ['#', 'Username', 'Full Name', 'Total Uploads', 'Completed Pictures', 'Pending Pictures', 'Completion Rate', 'First Upload', 'Last Upload']
        ];
        tableBody = rows.map((r, i) => [
            i + 1,
            r.username || 'Unknown',
            r.full_name || r.username || 'Unknown',
            (r.total_uploads || 0).toLocaleString(),
            (r.completed_count || 0).toLocaleString(),
            (r.pending_count || 0).toLocaleString(),
            `${r.completion_rate || 0}%`,
            r.first_upload ? r.first_upload.split('T')[0] : 'N/A',
            r.last_upload ? r.last_upload.split('T')[0] : 'N/A',
        ]);
    }

    autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: currentY,
        margin: { left: margin, right: margin, bottom: 16 },
        theme: 'striped',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 3,
            textColor: darkText,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            valign: 'middle',
        },
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold',
            halign: 'left',
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252], // Slate-50
        },
        columnStyles: isPeriodGroup
            ? {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 35, fontStyle: 'bold' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'center' },
                7: { halign: 'center' },
                8: { halign: 'center' },
            }
            : {
                0: { cellWidth: 10, halign: 'center' },
                1: { fontStyle: 'bold' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'center' },
                8: { halign: 'center' },
            },
        didDrawPage: (data) => {
            // Footer on every page
            const str = `Page ${doc.internal.pages.length - 1}`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...lightText);
            doc.text('EDMS Media System • Confidential Upload Performance Audit', margin, pageHeight - 8);
            doc.text(str, pageWidth - margin, pageHeight - 8, { align: 'right' });
        },
    });

    // -------------------------------------------------------------------------
    // 5. User Drilldown Section (If single user report details are included)
    // -------------------------------------------------------------------------
    if (userDetails && (userDetails.monthlyTrend?.length || userDetails.recentDocs?.length)) {
        // @ts-ignore
        const lastAutoTable = (doc as any).lastAutoTable;
        let nextY = lastAutoTable ? lastAutoTable.finalY + 12 : currentY + 20;

        if (nextY + 40 > pageHeight) {
            doc.addPage();
            nextY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...primaryColor);
        doc.text(`Individual Performance Drill-down: ${userLabel}`, margin, nextY);
        nextY += 6;

        if (userDetails.monthlyTrend && userDetails.monthlyTrend.length > 0) {
            const trendHead = [['Month', 'Uploads', 'Completed', 'Pending', 'Completion Rate']];
            const trendBody = userDetails.monthlyTrend.map((m) => [
                m.month,
                (m.total_uploads || 0).toLocaleString(),
                (m.completed_count || 0).toLocaleString(),
                (m.pending_count || 0).toLocaleString(),
                `${m.completion_rate || 0}%`,
            ]);

            autoTable(doc, {
                head: trendHead,
                body: trendBody,
                startY: nextY,
                margin: { left: margin, right: margin, bottom: 16 },
                theme: 'striped',
                styles: { fontSize: 8, cellPadding: 2.5 },
                headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold' },
                didDrawPage: () => {
                    const str = `Page ${doc.internal.pages.length - 1}`;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(...lightText);
                    doc.text('EDMS Media System • Confidential Upload Performance Audit', margin, pageHeight - 8);
                    doc.text(str, pageWidth - margin, pageHeight - 8, { align: 'right' });
                },
            });

            // @ts-ignore
            nextY = (doc as any).lastAutoTable.finalY + 10;
        }

        if (userDetails.recentDocs && userDetails.recentDocs.length > 0) {
            if (nextY + 30 > pageHeight) {
                doc.addPage();
                nextY = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...darkText);
            doc.text('Recent Uploaded Documents (Sample)', margin, nextY);
            nextY += 4;

            const docHead = [['Doc #', 'Document Name', 'Upload Date', 'Photo Date', 'Status']];
            const docBody = userDetails.recentDocs.slice(0, 25).map((d) => [
                d.docnumber,
                d.docname || d.abstract || `Doc #${d.docnumber}`,
                d.creation_date || 'N/A',
                d.doc_date || 'N/A',
                d.is_completed ? 'Completed' : 'Pending',
            ]);

            autoTable(doc, {
                head: docHead,
                body: docBody,
                startY: nextY,
                margin: { left: margin, right: margin, bottom: 16 },
                theme: 'striped',
                styles: { fontSize: 7.5, cellPadding: 2.5 },
                headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
                didDrawPage: () => {
                    const str = `Page ${doc.internal.pages.length - 1}`;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(...lightText);
                    doc.text('EDMS Media System • Confidential Upload Performance Audit', margin, pageHeight - 8);
                    doc.text(str, pageWidth - margin, pageHeight - 8, { align: 'right' });
                },
            });
        }
    }

    // -------------------------------------------------------------------------
    // 6. Download the PDF
    // -------------------------------------------------------------------------
    const dateTag = new Date().toISOString().split('T')[0];
    const userTag = filterCriteria.username ? `_${filterCriteria.username}` : '';
    const groupTag = `_${filterCriteria.groupBy}`;
    const filename = `EDMS_Performance_Report${userTag}${groupTag}_${dateTag}.pdf`;

    doc.save(filename);
}

