/**
 * Logosphere Dashboard JavaScript
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

// Global dashboard functionality
window.Dashboard = {
    socket: null,
    token: null,
    
    init() {
        this.token = localStorage.getItem('logosphere_token');
        this.initSocket();
    },
    
    initSocket() {
        if (!this.token) return;
        
        this.socket = io({
            auth: {
                token: this.token
            }
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to dashboard');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from dashboard');
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }
};

// Logs view functionality
window.LogsView = {
    logs: [],
    filteredLogs: [],
    autoScroll: true,
    filters: {
        text: '',
        level: '',
        startDate: '',
        endDate: ''
    },
    
    init() {
        this.bindEvents();
        this.initSocket();
        this.updateStatus('Connecting...', 'connecting');
    },
    
    bindEvents() {
        // Filter controls
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filters.text = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('level-filter').addEventListener('change', (e) => {
            this.filters.level = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('start-date').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('end-date').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.applyFilters();
        });
        
        // Toolbar actions
        document.getElementById('auto-scroll').addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });
        
        document.getElementById('export-logs').addEventListener('click', () => {
            this.exportLogs();
        });
    },
    
    initSocket() {
        const socket = io({
            auth: {
                token: localStorage.getItem('logosphere_token')
            }
        });
        
        socket.on('connect', () => {
            this.updateStatus('Connected', 'connected');
        });
        
        socket.on('disconnect', () => {
            this.updateStatus('Disconnected', 'disconnected');
        });
        
        socket.on('logs', (newLogs) => {
            this.addLogs(newLogs);
        });
        
        socket.on('error', (error) => {
            this.showError(error.message);
        });
    },
    
    addLogs(newLogs) {
        this.logs.push(...newLogs);
        
        // Keep only last 10000 logs to prevent memory issues
        if (this.logs.length > 10000) {
            this.logs = this.logs.slice(-10000);
        }
        
        this.applyFilters();
    },
    
    applyFilters() {
        this.filteredLogs = this.logs.filter(log => {
            // Text filter
            if (this.filters.text) {
                const searchText = this.filters.text.toLowerCase();
                const matchesMessage = log.message.toLowerCase().includes(searchText);
                const matchesMeta = log.meta && 
                    JSON.stringify(log.meta).toLowerCase().includes(searchText);
                
                if (!matchesMessage && !matchesMeta) {
                    return false;
                }
            }
            
            // Level filter
            if (this.filters.level && log.level !== this.filters.level) {
                return false;
            }
            
            // Date range filter
            if (this.filters.startDate) {
                const startTime = new Date(this.filters.startDate).getTime();
                if (log.timestamp < startTime) {
                    return false;
                }
            }
            
            if (this.filters.endDate) {
                const endTime = new Date(this.filters.endDate).getTime();
                if (log.timestamp > endTime) {
                    return false;
                }
            }
            
            return true;
        });
        
        this.renderLogs();
        this.updateLogsCount();
    },
    
    renderLogs() {
        const container = document.getElementById('logs-list');
        
        if (this.filteredLogs.length === 0) {
            container.innerHTML = `
                <div class="no-logs">
                    <i class="fas fa-inbox"></i>
                    <p>${this.logs.length === 0 ? 'No logs received yet' : 'No logs match the current filter'}</p>
                    <small>Logs will appear here in real-time</small>
                </div>
            `;
            return;
        }
        
        const html = this.filteredLogs.map(log => this.renderLogEntry(log)).join('');
        container.innerHTML = html;
        
        if (this.autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
    },
    
    renderLogEntry(log) {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const metaHtml = log.meta ? `
            <div class="log-meta">
                <pre>${JSON.stringify(log.meta, null, 2)}</pre>
            </div>
        ` : '';
        
        const errorHtml = log.error ? `
            <div class="log-meta">
                <strong>Error:</strong> ${log.error.name}: ${log.error.message}
                <pre>${log.error.stack}</pre>
            </div>
        ` : '';
        
        const aiAnalysisHtml = log.aiAnalysis ? `
            <div class="log-meta" style="background: #f0f9ff; border-color: #0ea5e9;">
                <strong>🤖 AI Analysis:</strong>
                <p><strong>Summary:</strong> ${log.aiAnalysis.summary}</p>
                <p><strong>Suggested Fix:</strong> ${log.aiAnalysis.suggestedFix}</p>
                <p><strong>Confidence:</strong> ${Math.round(log.aiAnalysis.confidenceScore * 100)}%</p>
            </div>
        ` : '';
        
        return `
            <div class="log-entry level-${log.level}">
                <div class="log-header">
                    <span class="log-timestamp">${timestamp}</span>
                    <span class="log-level ${log.level}">${log.level}</span>
                    <span class="log-pid">PID: ${log.pid}</span>
                </div>
                <div class="log-message">${this.escapeHtml(log.message)}</div>
                ${metaHtml}
                ${errorHtml}
                ${aiAnalysisHtml}
            </div>
        `;
    },
    
    clearLogs() {
        if (confirm('Are you sure you want to clear all logs?')) {
            this.logs = [];
            this.filteredLogs = [];
            this.renderLogs();
            this.updateLogsCount();
        }
    },
    
    exportLogs() {
        const data = JSON.stringify(this.filteredLogs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `logosphere-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    updateStatus(message, type) {
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = message;
        statusEl.className = `status-indicator ${type}`;
    },
    
    updateLogsCount() {
        const countEl = document.getElementById('logs-count');
        countEl.textContent = `${this.filteredLogs.length} logs${this.logs.length !== this.filteredLogs.length ? ` (${this.logs.length} total)` : ''}`;
    },
    
    showError(message) {
        const errorEl = document.getElementById('error-status');
        const messageEl = document.getElementById('error-message');
        messageEl.textContent = message;
        errorEl.style.display = 'block';
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Metrics view functionality
window.MetricsView = {
    charts: {},
    metricsData: {
        cpu: [],
        memory: [],
        eventLoop: []
    },
    
    init() {
        this.initCharts();
        this.initSocket();
        this.bindEvents();
    },
    
    bindEvents() {
        document.getElementById('refresh-metrics').addEventListener('click', () => {
            this.refreshMetrics();
        });
        
        document.getElementById('time-range').addEventListener('change', (e) => {
            this.updateTimeRange(e.target.value);
        });
    },
    
    initSocket() {
        const socket = io({
            auth: {
                token: localStorage.getItem('logosphere_token')
            }
        });
        
        socket.on('metrics', (metrics) => {
            this.updateMetrics(metrics);
        });
    },
    
    initCharts() {
        // CPU Chart
        const cpuCtx = document.getElementById('cpu-chart').getContext('2d');
        this.charts.cpu = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        // Memory Chart
        const memoryCtx = document.getElementById('memory-chart').getContext('2d');
        this.charts.memory = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'RSS (MB)',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Heap Used (MB)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        // Event Loop Chart
        const eventLoopCtx = document.getElementById('eventloop-chart').getContext('2d');
        this.charts.eventLoop = new Chart(eventLoopCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Event Loop Lag (ms)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },
    
    updateMetrics(metrics) {
        const timestamp = new Date(metrics.timestamp).toLocaleTimeString();
        
        // Update current values
        document.getElementById('cpu-current').textContent = `${metrics.cpu.total.toFixed(1)}%`;
        document.getElementById('memory-current').textContent = `${Math.round(metrics.memory.rss / 1024 / 1024)} MB`;
        document.getElementById('eventloop-current').textContent = `${metrics.eventLoop.lag.toFixed(2)} ms`;
        
        // Update process info
        document.getElementById('process-pid').textContent = metrics.process.pid;
        document.getElementById('process-uptime').textContent = this.formatUptime(metrics.process.uptime);
        
        // Add to charts
        this.addDataToChart('cpu', timestamp, metrics.cpu.total);
        this.addDataToChart('memory', timestamp, [
            Math.round(metrics.memory.rss / 1024 / 1024),
            Math.round(metrics.memory.heapUsed / 1024 / 1024)
        ]);
        this.addDataToChart('eventLoop', timestamp, metrics.eventLoop.lag);
        
        // Update summary
        this.updateSummary();
    },
    
    addDataToChart(chartName, label, data) {
        const chart = this.charts[chartName];
        const maxPoints = 50;
        
        chart.data.labels.push(label);
        
        if (Array.isArray(data)) {
            data.forEach((value, index) => {
                chart.data.datasets[index].data.push(value);
            });
        } else {
            chart.data.datasets[0].data.push(data);
        }
        
        // Keep only last N points
        if (chart.data.labels.length > maxPoints) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        chart.update('none');
    },
    
    updateSummary() {
        // Calculate averages and peaks
        const cpuData = this.charts.cpu.data.datasets[0].data;
        const memoryData = this.charts.memory.data.datasets[0].data;
        const eventLoopData = this.charts.eventLoop.data.datasets[0].data;
        
        if (cpuData.length > 0) {
            const avgCpu = cpuData.reduce((a, b) => a + b, 0) / cpuData.length;
            document.getElementById('avg-cpu').textContent = `${avgCpu.toFixed(1)}%`;
        }
        
        if (memoryData.length > 0) {
            const peakMemory = Math.max(...memoryData);
            document.getElementById('peak-memory').textContent = `${peakMemory} MB`;
        }
        
        if (eventLoopData.length > 0) {
            const maxEventLoop = Math.max(...eventLoopData);
            document.getElementById('max-eventloop').textContent = `${maxEventLoop.toFixed(2)} ms`;
        }
    },
    
    refreshMetrics() {
        // Request fresh metrics
        fetch('/api/metrics', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('logosphere_token')}`
            }
        })
        .then(response => response.json())
        .then(metrics => {
            this.updateMetrics(metrics);
        })
        .catch(error => {
            console.error('Failed to refresh metrics:', error);
        });
    },
    
    updateTimeRange(range) {
        // Clear existing data and adjust chart based on time range
        Object.values(this.charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        });
    },
    
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    Dashboard.init();
});