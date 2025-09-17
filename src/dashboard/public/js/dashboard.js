// Dashboard JavaScript utilities and helpers

class LoggerverseDashboard {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startHeartbeat();
  }

  setupEventListeners() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.isConnected) {
        this.reconnect();
      }
    });

    // Handle network status changes
    window.addEventListener('online', () => {
      if (!this.isConnected) {
        this.reconnect();
      }
    });

    window.addEventListener('offline', () => {
      this.updateConnectionStatus(false);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            this.focusSearch();
            break;
          case 'r':
            e.preventDefault();
            this.refreshData();
            break;
        }
      }
    });
  }

  startHeartbeat() {
    // Send heartbeat every 30 seconds to maintain connection
    setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, 30000);
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (window.initSocket) {
        window.initSocket();
      }
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  updateConnectionStatus(connected) {
    this.isConnected = connected;

    if (connected) {
      this.reconnectAttempts = 0;
    }

    // Update UI connection indicator
    const indicator = document.getElementById('connection-status');
    if (indicator) {
      if (connected) {
        indicator.innerHTML = '<div class="connection-dot"></div><span class="text-sm text-gray-600">Connected</span>';
      } else {
        indicator.innerHTML = '<div class="connection-dot disconnected"></div><span class="text-sm text-gray-600">Disconnected</span>';
      }
    }

    // Dispatch custom event for components to listen to
    document.dispatchEvent(new CustomEvent('connectionStatusChanged', {
      detail: { connected }
    }));
  }

  focusSearch() {
    const searchInput = document.querySelector('input[placeholder*="Search"]');
    if (searchInput) {
      searchInput.focus();
    }
  }

  refreshData() {
    if (this.socket && this.isConnected) {
      this.socket.emit('refresh_data');
    } else {
      location.reload();
    }
  }

  // Utility methods
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  static formatTimestamp(timestamp, options = {}) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (options.relative && diff < 86400000) { // Less than 24 hours
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      return `${Math.floor(diff / 3600000)}h ago`;
    }

    return date.toLocaleString();
  }

  static getLevelColor(level) {
    const colors = {
      debug: 'bg-blue-100 text-blue-800',
      info: 'bg-green-100 text-green-800',
      warn: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      fatal: 'bg-red-200 text-red-900',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  }

  static exportLogs(logs, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let content, filename, mimeType;

    switch (format) {
      case 'json':
        content = JSON.stringify(logs, null, 2);
        filename = `loggerverse-export-${timestamp}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        const headers = ['timestamp', 'level', 'hostname', 'pid', 'message'];
        const csvContent = [
          headers.join(','),
          ...logs.map(log => [
            new Date(log.timestamp).toISOString(),
            log.level,
            log.hostname,
            log.pid,
            `"${log.message.replace(/"/g, '""')}"`
          ].join(','))
        ].join('\n');
        content = csvContent;
        filename = `loggerverse-export-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      case 'txt':
        content = logs.map(log =>
          `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()} [${log.pid}] ${log.message}`
        ).join('\n');
        filename = `loggerverse-export-${timestamp}.txt`;
        mimeType = 'text/plain';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Chart utilities
  static createSimpleChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const {
      color = '#3b82f6',
      backgroundColor = '#f8fafc',
      gridColor = '#e5e7eb',
      padding = 20
    } = options;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!data || data.length === 0) return;

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const maxValue = Math.max(...data, 1);
    const stepX = chartWidth / (data.length - 1);

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw chart line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (value / maxValue) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under curve
    ctx.fillStyle = color + '20';
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fill();
  }
}

// Initialize dashboard
const loggerverseDashboard = new LoggerverseDashboard();

// Make utilities available globally
window.LoggerverseDashboard = LoggerverseDashboard;