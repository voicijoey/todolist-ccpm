class AnalyticsManager {
    constructor() {
        this.charts = {};
        this.currentDateRange = {
            startDate: null,
            endDate: null
        };
        this.isInitialized = false;
        this.isLoading = false;
        this.chartColors = {
            primary: '#007bff',
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#17a2b8',
            secondary: '#6c757d'
        };
    }

    async init() {
        if (this.isInitialized) return;

        // Wait for Chart.js to load
        await this.waitForChart();
        await this.setupEventListeners();
        this.isInitialized = true;
    }

    /**
     * Wait for Chart.js library to load
     */
    async waitForChart() {
        return new Promise((resolve) => {
            if (typeof Chart !== 'undefined') {
                console.log('Chart.js already loaded');
                resolve();
                return;
            }

            console.log('Waiting for Chart.js to load...');
            const checkChart = () => {
                if (typeof Chart !== 'undefined') {
                    console.log('Chart.js loaded successfully');
                    resolve();
                } else {
                    setTimeout(checkChart, 100);
                }
            };
            checkChart();
        });
    }

    setupEventListeners() {
        // Date range controls
        document.getElementById('apply-date-range').addEventListener('click', () => {
            this.applyDateRange();
        });

        document.getElementById('reset-date-range').addEventListener('click', () => {
            this.resetDateRange();
        });

        // Export controls
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportCSV();
        });

        document.getElementById('export-pdf').addEventListener('click', () => {
            this.exportPDF();
        });

        // Chart controls
        document.getElementById('trends-interval').addEventListener('change', (e) => {
            this.updateCompletionTrends(e.target.value);
        });
    }

    async loadDashboard() {
        // Prevent concurrent calls
        if (this.isLoading) {
            console.log('Analytics dashboard already loading, skipping duplicate call');
            return;
        }

        try {
            this.isLoading = true;
            this.showLoading();

            const params = {};
            if (this.currentDateRange.startDate) {
                params.startDate = this.currentDateRange.startDate;
            }
            if (this.currentDateRange.endDate) {
                params.endDate = this.currentDateRange.endDate;
            }

            console.log('Loading analytics dashboard with params:', params);
            const response = await window.api.getAnalyticsDashboard(params);
            console.log('Analytics response:', response); // Debug log

            // Handle response format (backend returns {success, data})
            if (response && response.success && response.data) {
                await this.renderDashboard(response.data);
                window.toast.success('Analytics dashboard loaded successfully');
            } else {
                throw new Error(response?.message || 'Failed to load analytics');
            }
        } catch (error) {
            console.error('Analytics dashboard error:', error);

            // Show more detailed error message
            const errorMsg = error.message || 'Failed to load analytics dashboard';
            window.toast.error(`Analytics Error: ${errorMsg}`);

            // Show empty dashboard instead of complete failure
            this.renderEmptyDashboard();
        } finally {
            this.hideLoading();
            this.isLoading = false;
        }
    }

    /**
     * Render empty dashboard when no data is available
     */
    renderEmptyDashboard() {
        // Show default empty state
        const defaultData = {
            overview: {
                total_tasks: 0,
                completed_tasks: 0,
                completion_rate: 0,
                overdue_tasks: 0,
                avg_completion_time: 'N/A'
            },
            trends: [],
            categoryBreakdown: [],
            priorityAnalysis: [],
            productivity: { daily_productivity: [], day_of_week_analysis: [] },
            goals: { monthly_goals: [] }
        };

        this.updateOverviewCards(defaultData.overview);
        console.log('Rendered empty dashboard due to error or no data');
    }

    async renderDashboard(data) {
        this.updateOverviewCards(data.overview);
        await this.renderCharts(data);
        this.updateTables(data);
    }

    updateOverviewCards(overview) {
        const elements = {
            'total-tasks': overview.total_tasks,
            'completed-tasks': overview.completed_tasks,
            'completion-rate': `${(overview.completion_rate * 100).toFixed(1)}%`,
            'overdue-tasks': overview.overdue_tasks,
            'avg-completion-time': overview.avg_completion_time
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Overview element not found: ${id}`);
            }
        });
    }

    async renderCharts(data) {
        console.log('Rendering charts with data:', data);

        // Store data for debugging
        window.lastAnalyticsData = data;

        // Only render charts if data exists and elements are present
        const chartPromises = [];

        if (data.trends && data.trends.length > 0 && document.getElementById('completion-trends-chart')) {
            chartPromises.push(this.renderCompletionTrends(data.trends));
        }

        if (data.categoryBreakdown && data.categoryBreakdown.length > 0 && document.getElementById('category-chart')) {
            chartPromises.push(this.renderCategoryChart(data.categoryBreakdown));
        }

        if (data.priorityAnalysis && data.priorityAnalysis.length > 0 && document.getElementById('priority-chart')) {
            chartPromises.push(this.renderPriorityChart(data.priorityAnalysis));
        }

        if (data.productivity?.daily_productivity && data.productivity.daily_productivity.length > 0 && document.getElementById('productivity-chart')) {
            chartPromises.push(this.renderProductivityChart(data.productivity.daily_productivity));
        }

        if (data.productivity?.day_of_week_analysis && data.productivity.day_of_week_analysis.length > 0 && document.getElementById('day-of-week-chart')) {
            chartPromises.push(this.renderDayOfWeekChart(data.productivity.day_of_week_analysis));
        }

        if (data.goals?.monthly_goals && data.goals.monthly_goals.length > 0 && document.getElementById('goals-chart')) {
            chartPromises.push(this.renderGoalsChart(data.goals.monthly_goals));
        }

        // Hide/show chart containers based on data availability
        this.toggleChartContainer('completion-trends-chart', data.trends && data.trends.length > 0);
        this.toggleChartContainer('category-chart', data.categoryBreakdown && data.categoryBreakdown.length > 0);
        this.toggleChartContainer('priority-chart', data.priorityAnalysis && data.priorityAnalysis.length > 0);
        this.toggleChartContainer('productivity-chart', data.productivity?.daily_productivity && data.productivity.daily_productivity.length > 0);
        this.toggleChartContainer('day-of-week-chart', data.productivity?.day_of_week_analysis && data.productivity.day_of_week_analysis.length > 0);
        this.toggleChartContainer('goals-chart', data.goals?.monthly_goals && data.goals.monthly_goals.length > 0);

        if (chartPromises.length > 0) {
            await Promise.all(chartPromises);
            console.log('Charts rendered successfully');
        } else {
            console.warn('No charts rendered - either no data or chart elements not found');
            this.showEmptyChartsMessage();
        }
    }

    /**
     * Toggle chart container visibility based on data availability
     */
    toggleChartContainer(chartId, hasData) {
        const chart = document.getElementById(chartId);
        if (chart) {
            const container = chart.closest('.chart-container');
            if (container) {
                if (hasData) {
                    container.style.display = 'block';
                } else {
                    container.style.display = 'none';
                }
            }
        }
    }

    /**
     * Show message when no charts have data
     */
    showEmptyChartsMessage() {
        const chartsGrid = document.querySelector('.charts-grid');
        if (chartsGrid) {
            const existingMessage = chartsGrid.querySelector('.empty-charts-message');
            if (!existingMessage) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'empty-charts-message';
                messageDiv.style.cssText = `
                    text-align: center;
                    padding: 40px 20px;
                    color: #666;
                    background: #f9f9f9;
                    border-radius: 8px;
                    margin: 20px 0;
                `;
                messageDiv.innerHTML = `
                    <h3>No Chart Data Available</h3>
                    <p>Create some tasks and complete them to see analytics charts.</p>
                `;
                chartsGrid.appendChild(messageDiv);
            }
        }
    }

    async renderCompletionTrends(trends) {
        const chartElement = document.getElementById('completion-trends-chart');
        if (!chartElement) {
            console.warn('Completion trends chart element not found');
            return;
        }

        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library is not loaded');
            return;
        }

        const ctx = chartElement.getContext('2d');
        if (this.charts.completionTrends) {
            this.charts.completionTrends.destroy();
        }

        this.charts.completionTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trends.map(t => t.period),
                datasets: [
                    {
                        label: 'Total Tasks',
                        data: trends.map(t => t.total_tasks),
                        borderColor: this.chartColors.primary,
                        backgroundColor: this.chartColors.primary + '20',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Completed Tasks',
                        data: trends.map(t => t.completed_tasks),
                        borderColor: this.chartColors.success,
                        backgroundColor: this.chartColors.success + '20',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    async renderCategoryChart(categoryData) {
        const ctx = document.getElementById('category-chart').getContext('2d');

        if (this.charts.category) {
            this.charts.category.destroy();
        }

        const colors = [
            this.chartColors.primary,
            this.chartColors.success,
            this.chartColors.warning,
            this.chartColors.danger,
            this.chartColors.info
        ];

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData.map(c => c.category.charAt(0).toUpperCase() + c.category.slice(1)),
                datasets: [{
                    data: categoryData.map(c => c.total),
                    backgroundColor: colors.slice(0, categoryData.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async renderPriorityChart(priorityData) {
        const ctx = document.getElementById('priority-chart').getContext('2d');

        if (this.charts.priority) {
            this.charts.priority.destroy();
        }

        const priorityColors = {
            'high': this.chartColors.danger,
            'medium': this.chartColors.warning,
            'low': this.chartColors.success
        };

        this.charts.priority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: priorityData.map(p => p.priority.charAt(0).toUpperCase() + p.priority.slice(1)),
                datasets: [
                    {
                        label: 'Total',
                        data: priorityData.map(p => p.total),
                        backgroundColor: priorityData.map(p => priorityColors[p.priority] + '60'),
                        borderColor: priorityData.map(p => priorityColors[p.priority]),
                        borderWidth: 1
                    },
                    {
                        label: 'Completed',
                        data: priorityData.map(p => p.completed),
                        backgroundColor: priorityData.map(p => priorityColors[p.priority]),
                        borderColor: priorityData.map(p => priorityColors[p.priority]),
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    async renderProductivityChart(dailyData) {
        const ctx = document.getElementById('productivity-chart').getContext('2d');

        if (this.charts.productivity) {
            this.charts.productivity.destroy();
        }

        // Show last 14 days
        const recentData = dailyData.slice(-14);

        this.charts.productivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: recentData.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Created',
                        data: recentData.map(d => d.tasks_created),
                        backgroundColor: this.chartColors.primary + '60',
                        borderColor: this.chartColors.primary,
                        borderWidth: 1
                    },
                    {
                        label: 'Completed',
                        data: recentData.map(d => d.tasks_completed),
                        backgroundColor: this.chartColors.success + '60',
                        borderColor: this.chartColors.success,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    async renderDayOfWeekChart(dayData) {
        const ctx = document.getElementById('day-of-week-chart').getContext('2d');

        if (this.charts.dayOfWeek) {
            this.charts.dayOfWeek.destroy();
        }

        this.charts.dayOfWeek = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: dayData.map(d => d.day_name),
                datasets: [{
                    label: 'Completion Rate',
                    data: dayData.map(d => (d.completion_rate * 100).toFixed(1)),
                    borderColor: this.chartColors.primary,
                    backgroundColor: this.chartColors.primary + '20',
                    pointBackgroundColor: this.chartColors.primary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: this.chartColors.primary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    async renderGoalsChart(goalsData) {
        const ctx = document.getElementById('goals-chart').getContext('2d');

        if (this.charts.goals) {
            this.charts.goals.destroy();
        }

        // Show last 6 months
        const recentGoals = goalsData.slice(-6);

        this.charts.goals = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: recentGoals.map(g => g.month),
                datasets: [{
                    label: 'Completion Rate',
                    data: recentGoals.map(g => (g.completion_rate * 100).toFixed(1)),
                    backgroundColor: recentGoals.map(g =>
                        g.goal_status === 'Goal Achieved' ?
                        this.chartColors.success + '80' :
                        this.chartColors.danger + '80'
                    ),
                    borderColor: recentGoals.map(g =>
                        g.goal_status === 'Goal Achieved' ?
                        this.chartColors.success :
                        this.chartColors.danger
                    ),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });

        // Add goal line at 80%
        ctx.canvas.addEventListener('chartjs-afterdraw', () => {
            const chartArea = this.charts.goals.chartArea;
            const ctx = this.charts.goals.ctx;

            ctx.save();
            ctx.strokeStyle = this.chartColors.warning;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            const yPosition = chartArea.top + (chartArea.bottom - chartArea.top) * 0.2; // 80% from bottom
            ctx.moveTo(chartArea.left, yPosition);
            ctx.lineTo(chartArea.right, yPosition);
            ctx.stroke();
            ctx.restore();
        });
    }

    updateTables(data) {
        this.updateCategoryTable(data.categoryBreakdown);
        this.updatePriorityTable(data.priorityAnalysis);
    }

    updateCategoryTable(categoryData) {
        const tbody = document.querySelector('#category-table tbody');
        tbody.innerHTML = '';

        categoryData.forEach(cat => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}</td>
                <td>${cat.total}</td>
                <td>${cat.completed}</td>
                <td>${(cat.completion_rate * 100).toFixed(1)}%</td>
                <td>${cat.avg_completion_time}</td>
            `;
            tbody.appendChild(row);
        });
    }

    updatePriorityTable(priorityData) {
        const tbody = document.querySelector('#priority-table tbody');
        tbody.innerHTML = '';

        priorityData.forEach(pri => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pri.priority.charAt(0).toUpperCase() + pri.priority.slice(1)}</td>
                <td>${pri.total}</td>
                <td>${pri.completed}</td>
                <td>${(pri.completion_rate * 100).toFixed(1)}%</td>
                <td>${pri.overdue}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async updateCompletionTrends(interval) {
        try {
            const params = { interval };

            if (this.currentDateRange.startDate) {
                params.startDate = this.currentDateRange.startDate;
            }
            if (this.currentDateRange.endDate) {
                params.endDate = this.currentDateRange.endDate;
            }

            const response = await window.api.getCompletionTrends(params);

            if (response.success) {
                await this.renderCompletionTrends(response.data.trends);
            }
        } catch (error) {
            console.error('Error updating trends:', error);
            window.toast.error('Failed to update trends');
        }
    }

    applyDateRange() {
        const startDate = document.getElementById('analytics-start-date').value;
        const endDate = document.getElementById('analytics-end-date').value;

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            showToast('Start date must be before end date', 'error');
            return;
        }

        this.currentDateRange = { startDate, endDate };
        this.loadDashboard();
    }

    resetDateRange() {
        this.currentDateRange = { startDate: null, endDate: null };
        document.getElementById('analytics-start-date').value = '';
        document.getElementById('analytics-end-date').value = '';
        this.loadDashboard();
    }

    async exportCSV() {
        try {
            window.toast.info('Preparing CSV export...');

            const exportData = {
                startDate: this.currentDateRange.startDate,
                endDate: this.currentDateRange.endDate,
                filters: {},
                includeAnalytics: true
            };

            const response = await window.api.exportCSV(exportData);

            if (response.success) {
                window.toast.success('CSV export ready for download');
                // Create download link
                const downloadUrl = window.api.baseURL + response.data.downloadUrl;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = response.data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error(response.message || 'Export failed');
            }
        } catch (error) {
            console.error('CSV export error:', error);
            window.toast.error('Failed to export CSV');
        }
    }

    async exportPDF() {
        try {
            window.toast.info('Generating PDF report...');

            const exportData = {
                startDate: this.currentDateRange.startDate,
                endDate: this.currentDateRange.endDate,
                reportType: 'comprehensive'
            };

            const response = await window.api.exportPDF(exportData);

            if (response.success) {
                window.toast.success('PDF report ready for download');
                // Create download link
                const downloadUrl = window.api.baseURL + response.data.downloadUrl;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = response.data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error(response.message || 'Export failed');
            }
        } catch (error) {
            console.error('PDF export error:', error);
            window.toast.error('Failed to export PDF');
        }
    }

    showLoading() {
        const loadingEl = document.getElementById('analytics-loading');
        const overviewEl = document.getElementById('overview-cards');
        const chartsEl = document.getElementById('charts-grid');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (overviewEl) overviewEl.style.opacity = '0.5';
        if (chartsEl) chartsEl.style.opacity = '0.5';
    }

    hideLoading() {
        const loadingEl = document.getElementById('analytics-loading');
        const overviewEl = document.getElementById('overview-cards');
        const chartsEl = document.getElementById('charts-grid');

        if (loadingEl) loadingEl.classList.add('hidden');
        if (overviewEl) overviewEl.style.opacity = '1';
        if (chartsEl) chartsEl.style.opacity = '1';
    }

    destroy() {
        // Clean up charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Global analytics manager instance
window.analyticsManager = new AnalyticsManager();