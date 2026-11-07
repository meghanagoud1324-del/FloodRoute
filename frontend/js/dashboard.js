/**
 * =====================================================================
 * FLOODROUTE - Smart Flood Dashboard Script
 * Visualizes KPIs, Chart.js graphs, live weather, and reported incidents
 * =====================================================================
 */

let severityChartInstance = null;
let localityChartInstance = null;
let trendChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadLiveWeather();
  await loadDashboardData();
  setupFilterHandlers();
});

async function loadLiveWeather() {
  const weather = await FloodAPI.fetchLiveHyderabadWeather();
  const tempEl = document.getElementById('weatherTemp');
  const precipEl = document.getElementById('weatherPrecip');
  const conditionEl = document.getElementById('weatherCondition');

  if (tempEl) tempEl.textContent = `${weather.temperature_2m || 26.5} °C`;
  if (precipEl) precipEl.textContent = `${weather.precipitation || 22.0} mm/hr`;
  if (conditionEl) {
    const isRaining = (weather.precipitation || 0) > 0.5 || (weather.rain || 0) > 0.5;
    conditionEl.textContent = isRaining ? 'Active Monsoon Rain' : 'Overcast / High Humidity';
  }
}

async function loadDashboardData() {
  const analytics = await FloodAPI.getAnalytics();
  const reports = await FloodAPI.getReports();

  // Update KPI counters
  updateMetric('statTotalReports', analytics.totalReports || reports.length);
  updateMetric('statCriticalRisk', analytics.criticalRiskCount || 3);
  updateMetric('statHighRisk', analytics.highRiskCount || 2);
  updateMetric('statModerateRisk', analytics.moderateRiskCount || 4);
  updateMetric('statAvgRainfall', `${analytics.currentAvgRainfallMm || 48.5} mm`);

  // Render Charts
  renderSeverityChart(analytics.severityDistribution);
  renderLocalityChart(analytics.localityStats);
  renderTrendChart(analytics.monthlyTrends);

  // Render Recent Incidents Table
  renderRecentReportsTable(reports);
}

function updateMetric(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = value;
}

function renderSeverityChart(data) {
  const ctx = document.getElementById('severityChart');
  if (!ctx) return;

  const defaultData = [
    { severity: 'Critical', count: 3, color: '#D94D4D' },
    { severity: 'High', count: 2, color: '#E67E22' },
    { severity: 'Moderate', count: 4, color: '#E5A12B' },
    { severity: 'Low', count: 2, color: '#2DAD79' }
  ];

  const items = data && data.length ? data : defaultData;
  const labels = items.map(d => d.severity);
  const counts = items.map(d => d.count);
  const colors = items.map(d => d.color);

  if (severityChartInstance) severityChartInstance.destroy();

  severityChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }
      },
      cutout: '68%'
    }
  });
}

function renderLocalityChart(data) {
  const ctx = document.getElementById('localityChart');
  if (!ctx) return;

  const defaultLocs = [
    { locality: 'Tolichowki', count: 18 },
    { locality: 'Malakpet', count: 22 },
    { locality: 'Begumpet', count: 15 },
    { locality: 'LB Nagar', count: 14 },
    { locality: 'Uppal', count: 11 },
    { locality: 'Kukatpally', count: 9 },
    { locality: 'Ameerpet', count: 8 }
  ];

  const items = data && data.length ? data : defaultLocs;
  const labels = items.map(d => d.locality);
  const counts = items.map(d => d.count);

  if (localityChartInstance) localityChartInstance.destroy();

  localityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Reported Waterlogging Events',
        data: counts,
        backgroundColor: '#168AAD',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#EAF4FA' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderTrendChart(data) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const defaultMonthly = [
    { month: 'Jun', reports: 18, rainfallMm: 112 },
    { month: 'Jul', reports: 46, rainfallMm: 235 },
    { month: 'Aug', reports: 58, rainfallMm: 280 },
    { month: 'Sep', reports: 64, rainfallMm: 310 },
    { month: 'Oct', reports: 38, rainfallMm: 195 },
    { month: 'Nov', reports: 12, rainfallMm: 42 }
  ];

  const items = data && data.length ? data : defaultMonthly;
  const labels = items.map(d => d.month);
  const reports = items.map(d => d.reports);
  const rainfall = items.map(d => d.rainfallMm);

  if (trendChartInstance) trendChartInstance.destroy();

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Flood Incidents',
          data: reports,
          borderColor: '#168AAD',
          backgroundColor: 'rgba(22, 138, 173, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Rainfall (mm)',
          data: rainfall,
          borderColor: '#E5A12B',
          borderDash: [5, 5],
          tension: 0.3,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Reports' } },
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Rainfall mm' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function renderRecentReportsTable(reports) {
  const tbody = document.getElementById('recentReportsBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!reports || reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No recent waterlogging reports found.</td></tr>`;
    return;
  }

  const list = reports.slice(0, 7);
  list.forEach(r => {
    const tr = document.createElement('tr');
    const badgeClass = `badge-${r.severity.toLowerCase()}`;
    const statusClass = `badge-${r.status.toLowerCase().replace('_', '-')}`;

    tr.innerHTML = `
      <td><strong>${r.reportUid}</strong></td>
      <td class="cell-title">${r.locality}</td>
      <td>${r.landmark || r.hazardCategory}</td>
      <td>${r.waterDepthCm} cm</td>
      <td><span class="badge ${badgeClass}">${r.severity}</span></td>
      <td><span class="badge ${statusClass}">${r.status.replace('_', ' ')}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function setupFilterHandlers() {
  const localityFilter = document.getElementById('localityFilter');
  const severityFilter = document.getElementById('severityFilter');

  async function applyFilters() {
    const locVal = localityFilter ? localityFilter.value : '';
    const sevVal = severityFilter ? severityFilter.value : '';

    const allReports = await FloodAPI.getReports();
    const filtered = allReports.filter(r => {
      const matchLoc = !locVal || locVal === 'ALL' || r.locality.toLowerCase() === locVal.toLowerCase();
      const matchSev = !sevVal || sevVal === 'ALL' || r.severity.toLowerCase() === sevVal.toLowerCase();
      return matchLoc && matchSev;
    });

    renderRecentReportsTable(filtered);
    showToast(`Showing ${filtered.length} filtered incident reports`, 'info');
  }

  if (localityFilter) localityFilter.addEventListener('change', applyFilters);
  if (severityFilter) severityFilter.addEventListener('change', applyFilters);
}
