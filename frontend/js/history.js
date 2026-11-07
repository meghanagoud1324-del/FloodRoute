/**
 * =====================================================================
 * FLOODROUTE - Historical Flood Analysis
 * Chronological flood patterns, rainfall correlation & recurrence analysis
 * =====================================================================
 */

let historyTrendChart = null;
let historyRecurrenceChart = null;

const HISTORICAL_ROADS = [
  { road: 'Tolichowki Underpass Corridor', locality: 'Tolichowki', annualEvents: 18, avgStagnationHrs: 5.5, maxDepthCm: 78, status: 'Chronic Bottleneck' },
  { road: 'Malakpet Railway Bridge Underpass', locality: 'Malakpet', annualEvents: 22, avgStagnationHrs: 6.8, maxDepthCm: 90, status: 'Severe Catchment Dip' },
  { road: 'Rasoolpura / Begumpet Nala Junction', locality: 'Begumpet', annualEvents: 15, avgStagnationHrs: 4.2, maxDepthCm: 62, status: 'Stormwater Spill' },
  { road: 'LB Nagar Ring Road Underpass', locality: 'LB Nagar', annualEvents: 14, avgStagnationHrs: 4.0, maxDepthCm: 65, status: 'Drainage Overload' },
  { road: 'Uppal Bus Depot - Ramanthapur Road', locality: 'Uppal', annualEvents: 11, avgStagnationHrs: 3.5, maxDepthCm: 50, status: 'Surface Inundation' },
  { road: 'Kukatpally Y-Junction (Metro Pillar 780)', locality: 'Kukatpally', annualEvents: 9, avgStagnationHrs: 2.8, maxDepthCm: 45, status: 'Slow Runoff' },
  { road: 'Mehdipatnam Rythu Bazar Bus Bay', locality: 'Mehdipatnam', annualEvents: 8, avgStagnationHrs: 2.5, maxDepthCm: 35, status: 'Moderate Pooling' }
];

document.addEventListener('DOMContentLoaded', () => {
  renderHistoricalCharts();
  renderAffectedRoadsTable(HISTORICAL_ROADS);
  setupHistoryFilters();
});

function renderHistoricalCharts() {
  const trendCtx = document.getElementById('historyTrendChart');
  const recurCtx = document.getElementById('historyRecurrenceChart');

  if (trendCtx) {
    historyTrendChart = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ['June', 'July', 'August', 'September', 'October', 'November'],
        datasets: [
          {
            label: 'Recorded Waterlogging Events',
            data: [18, 46, 58, 64, 38, 12],
            borderColor: '#D94D4D',
            backgroundColor: 'rgba(217, 77, 77, 0.12)',
            tension: 0.35,
            fill: true
          },
          {
            label: 'Total Rainfall (mm)',
            data: [112, 235, 280, 310, 195, 42],
            borderColor: '#168AAD',
            borderDash: [5, 5],
            tension: 0.35,
            yAxisID: 'yRain'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Reported Incidents' } },
          yRain: { beginAtZero: true, position: 'right', title: { display: true, text: 'Rainfall (mm)' }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  if (recurCtx) {
    historyRecurrenceChart = new Chart(recurCtx, {
      type: 'bar',
      data: {
        labels: ['Tolichowki', 'Malakpet', 'Begumpet', 'LB Nagar', 'Uppal', 'Kukatpally'],
        datasets: [{
          label: 'Annual Monsoon Recurrence Frequency',
          data: [18, 22, 15, 14, 11, 9],
          backgroundColor: ['#D94D4D', '#D94D4D', '#E67E22', '#E67E22', '#E5A12B', '#E5A12B'],
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
}

function renderAffectedRoadsTable(roads) {
  const tbody = document.getElementById('historicalRoadsBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  roads.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-title">${r.road}</td>
      <td><strong>${r.locality}</strong></td>
      <td><span class="badge badge-high">${r.annualEvents} events/yr</span></td>
      <td>${r.avgStagnationHrs} hrs</td>
      <td>${r.maxDepthCm} cm</td>
      <td><span class="badge badge-critical">${r.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function setupHistoryFilters() {
  const locSelect = document.getElementById('historyLocalityFilter');
  if (locSelect) {
    locSelect.addEventListener('change', () => {
      const val = locSelect.value;
      if (!val || val === 'ALL') {
        renderAffectedRoadsTable(HISTORICAL_ROADS);
      } else {
        const filtered = HISTORICAL_ROADS.filter(r => r.locality.toLowerCase() === val.toLowerCase());
        renderAffectedRoadsTable(filtered);
      }
    });
  }
}
