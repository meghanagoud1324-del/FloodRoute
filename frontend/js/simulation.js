/**
 * =====================================================================
 * FLOODROUTE - Rainfall Impact Simulator
 * Interactive downpour scenarios, hydrological projection & impact charts
 * =====================================================================
 */

let simMapInstance = null;
let simMarkersGroup = null;
let simChartInstance = null;

const SIM_LOCATIONS = [
  { name: 'Tolichowki', lat: 17.4011, lng: 78.4124, baseVuln: 85, elev: 508 },
  { name: 'Malakpet', lat: 17.3753, lng: 78.4988, baseVuln: 90, elev: 488 },
  { name: 'Begumpet', lat: 17.4447, lng: 78.4664, baseVuln: 82, elev: 503 },
  { name: 'LB Nagar', lat: 17.3457, lng: 78.5522, baseVuln: 78, elev: 495 },
  { name: 'Uppal', lat: 17.4018, lng: 78.5602, baseVuln: 75, elev: 492 },
  { name: 'Kukatpally', lat: 17.4849, lng: 78.4138, baseVuln: 65, elev: 510 },
  { name: 'Ameerpet', lat: 17.4375, lng: 78.4482, baseVuln: 68, elev: 505 },
  { name: 'Mehdipatnam', lat: 17.3916, lng: 78.4398, baseVuln: 62, elev: 512 },
  { name: 'Gachibowli', lat: 17.4401, lng: 78.3489, baseVuln: 35, elev: 545 },
  { name: 'Miyapur', lat: 17.4968, lng: 78.3614, baseVuln: 45, elev: 535 }
];

document.addEventListener('DOMContentLoaded', () => {
  initSimMap();
  setupSimulationControls();
  runHydrologicalSimulation();
});

function initSimMap() {
  const mapEl = document.getElementById('simulationMap');
  if (!mapEl) return;

  simMapInstance = L.map('simulationMap', {
    center: [17.4100, 78.4600],
    zoom: 12,
    zoomControl: false
  });

  L.control.zoom({ position: 'topright' }).addTo(simMapInstance);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap | Rainfall Simulator'
  }).addTo(simMapInstance);

  simMarkersGroup = L.layerGroup().addTo(simMapInstance);
}

function setupSimulationControls() {
  const rainSlider = document.getElementById('simRainSlider');
  const durSlider = document.getElementById('simDurationSlider');
  const rainBadge = document.getElementById('simRainBadge');
  const durBadge = document.getElementById('simDurBadge');

  if (rainSlider) {
    rainSlider.addEventListener('input', () => {
      if (rainBadge) rainBadge.textContent = `${rainSlider.value} mm/hr`;
    });
  }

  if (durSlider) {
    durSlider.addEventListener('input', () => {
      if (durBadge) durBadge.textContent = `${durSlider.value} hr(s)`;
    });
  }

  const runBtn = document.getElementById('btnRunSimulation');
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      runHydrologicalSimulation();
      showToast('Hydrological scenario simulated successfully', 'success');
    });
  }

  const resetBtn = document.getElementById('btnResetSimulation');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (rainSlider) rainSlider.value = 45;
      if (durSlider) durSlider.value = 2;
      if (rainBadge) rainBadge.textContent = '45 mm/hr';
      if (durBadge) durBadge.textContent = '2 hr(s)';
      runHydrologicalSimulation();
      showToast('Simulation reset to moderate baseline', 'info');
    });
  }
}

function runHydrologicalSimulation() {
  const rain = parseFloat(document.getElementById('simRainSlider')?.value || 45);
  const dur = parseFloat(document.getElementById('simDurationSlider')?.value || 2);
  const targetLoc = document.getElementById('simLocalitySelect')?.value || 'ALL';

  const totalAccumulation = rain * dur;

  let criticalCount = 0;
  let highCount = 0;
  let modCount = 0;
  let lowCount = 0;

  const results = [];

  SIM_LOCATIONS.forEach(loc => {
    if (targetLoc !== 'ALL' && loc.name !== targetLoc) return;

    // Elevation & drainage multiplier
    const elevFactor = Math.max(0.7, 1.35 - ((loc.elev - 480) / 100));
    const waterDepthCm = Math.min(120, (totalAccumulation * 0.42 * (loc.baseVuln / 50) * elevFactor));

    // Dynamic risk formula
    const normRain = Math.min(100, (rain / 80) * 100);
    const normDepth = Math.min(100, (waterDepthCm / 70) * 100);
    const riskScore = (normRain * 0.30) + (normDepth * 0.30) + (loc.baseVuln * 0.25) + (90 * 0.15);
    const finalScore = Math.min(100, Math.max(0, riskScore));

    let riskLevel, color;
    if (finalScore >= 80) {
      riskLevel = 'CRITICAL';
      color = '#D94D4D';
      criticalCount++;
    } else if (finalScore >= 60) {
      riskLevel = 'HIGH';
      color = '#E67E22';
      highCount++;
    } else if (finalScore >= 35) {
      riskLevel = 'MODERATE';
      color = '#E5A12B';
      modCount++;
    } else {
      riskLevel = 'LOW';
      color = '#2DAD79';
      lowCount++;
    }

    results.push({
      ...loc,
      waterDepthCm: waterDepthCm.toFixed(1),
      riskScore: finalScore.toFixed(1),
      riskLevel,
      color
    });
  });

  // Update KPI counters
  document.getElementById('simCritCount').textContent = criticalCount;
  document.getElementById('simHighCount').textContent = highCount;
  document.getElementById('simAccumText').textContent = `${totalAccumulation.toFixed(0)} mm total rainfall`;

  const scenarioDesc = rain >= 80
    ? 'Extreme Downpour / Cloudburst Warning Scenario'
    : (rain >= 50 ? 'Heavy Monsoon Downpour Scenario' : 'Moderate Inundation Scenario');
  document.getElementById('simScenarioLabel').textContent = scenarioDesc;

  // Render Map Markers
  renderSimulationMap(results);

  // Render Projection Chart
  renderSimulationChart(results);
}

function renderSimulationMap(results) {
  if (!simMarkersGroup) return;
  simMarkersGroup.clearLayers();

  results.forEach(item => {
    const customPin = L.divIcon({
      className: `custom-pin pin-${item.riskLevel.toLowerCase()}`,
      html: `<span>${item.riskLevel.charAt(0)}</span>`,
      iconSize: [28, 28]
    });

    const marker = L.marker([item.lat, item.lng], { icon: customPin });
    marker.bindPopup(`
      <div class="popup-card">
        <div class="popup-header">
          <span class="popup-title">${item.name} (Simulated)</span>
          <span class="badge badge-${item.riskLevel.toLowerCase()}">${item.riskLevel}</span>
        </div>
        <div class="popup-body">
          <div class="popup-meta-row">
            <span class="popup-meta-label">Projected Water Depth:</span>
            <span class="popup-meta-val">${item.waterDepthCm} cm</span>
          </div>
          <div class="popup-meta-row">
            <span class="popup-meta-label">Calculated Flood Risk:</span>
            <span class="popup-meta-val">${item.riskScore} / 100</span>
          </div>
          <div class="popup-meta-row">
            <span class="popup-meta-label">Ground Elevation:</span>
            <span class="popup-meta-val">${item.elev} m</span>
          </div>
        </div>
      </div>
    `);

    simMarkersGroup.addLayer(marker);
  });
}

function renderSimulationChart(results) {
  const ctx = document.getElementById('simImpactChart');
  if (!ctx) return;

  const labels = results.map(r => r.name);
  const depths = results.map(r => parseFloat(r.waterDepthCm));
  const risks = results.map(r => parseFloat(r.riskScore));

  if (simChartInstance) simChartInstance.destroy();

  simChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Projected Water Depth (cm)',
          data: depths,
          backgroundColor: '#168AAD',
          borderRadius: 4
        },
        {
          label: 'Projected Risk Score (0-100)',
          data: risks,
          backgroundColor: '#E67E22',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: '#EAF4FA' } },
        x: { grid: { display: false } }
      }
    }
  });
}
