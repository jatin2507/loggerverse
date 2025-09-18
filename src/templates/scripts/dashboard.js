/**
 * Dashboard Client-Side JavaScript
 */
(function() {
  'use strict';

  // Configuration from server
  const config = window.DASHBOARD_CONFIG || {};
  let eventSource = null;
  let metricsInterval = null;

  /**
   * Load logs from API
   */
  async function loadLogs() {
    const level = document.getElementById('logLevel').value;
    const source = document.getElementById('logSource').value;
    const search = document.getElementById('searchBox').value;

    const params = new URLSearchParams({ level, source, search }).toString();

    try {
      const response = await fetch(`${config.apiPath}/logs?${params}`);
      const logs = await response.json();
      displayLogs(logs);
    } catch (error) {
      console.error('Error loading logs:', error);
      showError('Failed to load logs');
    }
  }

  /**
   * Display logs in container
   */
  function displayLogs(logs) {
    const container = document.getElementById('logContainer');

    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="loading">No logs found</div>';
      return;
    }

    container.innerHTML = logs.map(log => formatLogEntry(log)).join('');
  }

  /**
   * Format a single log entry
   */
  function formatLogEntry(log) {
    const level = log.level || 'info';
    const timestamp = log.timestamp || 'N/A';
    const message = escapeHtml(log.message || '');
    const meta = log.meta ? escapeHtml(JSON.stringify(log.meta, null, 2)) : '';

    return `
      <div class="log-entry ${level}">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level ${level}">${level.toUpperCase()}</span>
        <span class="log-message">${message}</span>
        ${meta ? `<div class="log-meta">${meta}</div>` : ''}
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Load metrics from API
   */
  async function loadMetrics() {
    if (!config.showMetrics) return;

    try {
      const response = await fetch(`${config.apiPath}/metrics`);
      const metrics = await response.json();
      updateMetricsDisplay(metrics);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }

  /**
   * Update metrics display
   */
  function updateMetricsDisplay(metrics) {
    if (metrics.cpu) {
      const cpuUsage = document.getElementById('cpuUsage');
      const cpuBar = document.getElementById('cpuBar');
      if (cpuUsage) cpuUsage.textContent = metrics.cpu.usage + '%';
      if (cpuBar) cpuBar.style.width = metrics.cpu.usage + '%';
    }

    if (metrics.memory) {
      const memUsage = document.getElementById('memUsage');
      const memBar = document.getElementById('memBar');
      if (memUsage) {
        memUsage.textContent = `${metrics.memory.used}GB / ${metrics.memory.total}GB (${metrics.memory.percentage}%)`;
      }
      if (memBar) memBar.style.width = metrics.memory.percentage + '%';
    }

    if (metrics.disk && metrics.disk[0]) {
      const disk = metrics.disk[0];
      const diskUsage = document.getElementById('diskUsage');
      const diskBar = document.getElementById('diskBar');
      if (diskUsage) {
        diskUsage.textContent = `${disk.used}GB / ${disk.size}GB (${disk.percentage}%)`;
      }
      if (diskBar) diskBar.style.width = disk.percentage + '%';
    }

    if (metrics.os) {
      const sysInfo = document.getElementById('sysInfo');
      if (sysInfo) {
        sysInfo.textContent = `${metrics.os.platform} | ${metrics.os.hostname} | Uptime: ${metrics.os.uptime}h`;
      }
    }
  }

  /**
   * Start log streaming
   */
  function startStream() {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`${config.apiPath}/stream`);

    eventSource.onmessage = (event) => {
      const logs = JSON.parse(event.data);
      if (logs.length > 0) {
        const container = document.getElementById('logContainer');
        const newEntries = logs.map(log => formatLogEntry(log)).join('');
        container.innerHTML = newEntries + container.innerHTML;
      }
    };

    eventSource.onerror = (error) => {
      console.error('Stream error:', error);
      stopStream();
    };
  }

  /**
   * Stop log streaming
   */
  function stopStream() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    const container = document.getElementById('logContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
  }

  /**
   * Debounce function for search
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Initialize event listeners
   */
  function initEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadLogs);
    }

    // Log level filter
    const logLevel = document.getElementById('logLevel');
    if (logLevel) {
      logLevel.addEventListener('change', loadLogs);
    }

    // Log source filter
    const logSource = document.getElementById('logSource');
    if (logSource) {
      logSource.addEventListener('change', loadLogs);
    }

    // Search box with debounce
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', debounce(loadLogs, 500));
    }

    // Stream button
    if (config.realtime) {
      const streamBtn = document.getElementById('streamBtn');
      if (streamBtn) {
        streamBtn.addEventListener('click', function() {
          if (this.textContent.includes('Live')) {
            startStream();
            this.textContent = '⏹ Stop Stream';
          } else {
            stopStream();
            this.textContent = '📡 Live Stream';
          }
        });
      }
    }
  }

  /**
   * Initialize dashboard
   */
  function init() {
    // Initialize event listeners
    initEventListeners();

    // Load initial logs
    loadLogs();

    // Load and update metrics if enabled
    if (config.showMetrics) {
      loadMetrics();
      metricsInterval = setInterval(loadMetrics, 5000);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (eventSource) eventSource.close();
    if (metricsInterval) clearInterval(metricsInterval);
  });
})();