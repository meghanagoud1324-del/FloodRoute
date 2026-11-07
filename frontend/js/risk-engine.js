/**
 * =====================================================================
 * FLOODROUTE - Flood Risk Analysis Engine
 * Multi-factor prototype risk-scoring algorithm and breakdown engine
 * =====================================================================
 */

const RISK_WEIGHTS = {
  rainfall: 0.30,
  waterDepth: 0.30,
  historicalFlooding: 0.15,
  drainageVulnerability: 0.15,
  reportFreshness: 0.10
};

document.addEventListener('DOMContentLoaded', () => {
  initRiskEngineSliders();
  calculateLiveRiskScore();
});

function initRiskEngineSliders() {
  const sliders = [
    { id: 'sliderRainfall', badgeId: 'valRainfall', unit: '%' },
    { id: 'sliderDepth', badgeId: 'valDepth', unit: ' cm' },
    { id: 'sliderHistory', badgeId: 'valHistory', unit: '%' },
    { id: 'sliderDrainage', badgeId: 'valDrainage', unit: '%' },
    { id: 'sliderFreshness', badgeId: 'valFreshness', unit: '%' }
  ];

  sliders.forEach(s => {
    const el = document.getElementById(s.id);
    const badge = document.getElementById(s.badgeId);
    if (el) {
      el.addEventListener('input', () => {
        if (badge) badge.textContent = `${el.value}${s.unit}`;
        calculateLiveRiskScore();
      });
    }
  });

  const localitySelect = document.getElementById('riskLocalityPreset');
  if (localitySelect) {
    localitySelect.addEventListener('change', () => {
      applyLocalityPreset(localitySelect.value);
    });
  }
}

function calculateLiveRiskScore() {
  const rainfall = parseFloat(document.getElementById('sliderRainfall')?.value || 50);
  const depth = parseFloat(document.getElementById('sliderDepth')?.value || 35);
  const history = parseFloat(document.getElementById('sliderHistory')?.value || 60);
  const drainage = parseFloat(document.getElementById('sliderDrainage')?.value || 55);
  const freshness = parseFloat(document.getElementById('sliderFreshness')?.value || 90);

  // Normalize depth: 0 to 80cm maps to 0 to 100
  const normDepth = Math.min(100, Math.max(0, (depth / 80) * 100));

  // Risk Score = (Rainfall × 0.30) + (Water Depth × 0.30) + (Historical × 0.15) + (Drainage × 0.15) + (Freshness × 0.10)
  const rainPart = rainfall * RISK_WEIGHTS.rainfall;
  const depthPart = normDepth * RISK_WEIGHTS.waterDepth;
  const histPart = history * RISK_WEIGHTS.historicalFlooding;
  const drainPart = drainage * RISK_WEIGHTS.drainageVulnerability;
  const freshPart = freshness * RISK_WEIGHTS.reportFreshness;

  const totalScore = Math.min(100, Math.max(0, rainPart + depthPart + histPart + drainPart + freshPart));

  updateRiskUI(totalScore, {
    rainPart,
    depthPart,
    histPart,
    drainPart,
    freshPart
  });
}

function updateRiskUI(score, parts) {
  const scoreDisplay = document.getElementById('riskScoreValue');
  const levelBadge = document.getElementById('riskLevelBadge');
  const gaugeFill = document.getElementById('riskGaugeFill');
  const explanationEl = document.getElementById('riskExplanationText');

  const rounded = Math.round(score * 10) / 10;
  if (scoreDisplay) scoreDisplay.textContent = rounded.toFixed(1);

  let level, color, badgeClass, explanation;

  if (score < 30) {
    level = 'LOW RISK';
    color = '#2DAD79';
    badgeClass = 'badge-low';
    explanation = 'Road conditions are predominantly manageable. Minor runoff along curbs, gutters flowing normally. Safe for commuter transit.';
  } else if (score < 60) {
    level = 'MODERATE RISK';
    color = '#E5A12B';
    badgeClass = 'badge-moderate';
    explanation = 'Partial street water accumulation (15-35 cm). Vehicles advised to reduce speed, avoid sudden braking, and remain in median lanes.';
  } else if (score < 80) {
    level = 'HIGH RISK';
    color = '#E67E22';
    badgeClass = 'badge-high';
    explanation = 'Deep surface ponding (35-60 cm) observed. Low ground-clearance vehicles face high danger of engine stalling. Alternative bypass strongly advised.';
  } else {
    level = 'CRITICAL RISK';
    color = '#D94D4D';
    badgeClass = 'badge-critical';
    explanation = 'Severe inundation (>60 cm). Roadway or underpass bottleneck is impassable. Avoid corridor completely and heed GHMC diversions.';
  }

  if (levelBadge) {
    levelBadge.textContent = level;
    levelBadge.className = `badge ${badgeClass}`;
  }

  if (gaugeFill) {
    gaugeFill.style.width = `${score}%`;
    gaugeFill.style.backgroundColor = color;
  }

  if (explanationEl) {
    explanationEl.textContent = explanation;
  }

  // Update Weight Contribution Bars
  updateBar('barRain', parts.rainPart, 30);
  updateBar('barDepth', parts.depthPart, 30);
  updateBar('barHist', parts.histPart, 15);
  updateBar('barDrain', parts.drainPart, 15);
  updateBar('barFresh', parts.freshPart, 10);
}

function updateBar(barId, val, maxVal) {
  const bar = document.getElementById(barId);
  const text = document.getElementById(`${barId}Val`);
  if (bar) {
    const pct = Math.min(100, (val / maxVal) * 100);
    bar.style.width = `${pct}%`;
  }
  if (text) {
    text.textContent = `${val.toFixed(1)} / ${maxVal}`;
  }
}

function applyLocalityPreset(preset) {
  const presets = {
    tolichowki: { rain: 75, depth: 65, hist: 90, drain: 85, fresh: 95 },
    malakpet: { rain: 85, depth: 75, hist: 92, drain: 88, fresh: 98 },
    begumpet: { rain: 65, depth: 52, hist: 85, drain: 82, fresh: 90 },
    kukatpally: { rain: 45, depth: 38, hist: 75, drain: 70, fresh: 85 },
    gachibowli: { rain: 25, depth: 18, hist: 40, drain: 45, fresh: 80 }
  };

  const p = presets[preset];
  if (!p) return;

  setSlider('sliderRainfall', 'valRainfall', p.rain, '%');
  setSlider('sliderDepth', 'valDepth', p.depth, ' cm');
  setSlider('sliderHistory', 'valHistory', p.hist, '%');
  setSlider('sliderDrainage', 'valDrainage', p.drain, '%');
  setSlider('sliderFreshness', 'valFreshness', p.fresh, '%');

  calculateLiveRiskScore();
  showToast(`Loaded ${preset.toUpperCase()} historical flood baseline`, 'info');
}

function setSlider(sliderId, badgeId, val, unit) {
  const s = document.getElementById(sliderId);
  const b = document.getElementById(badgeId);
  if (s) s.value = val;
  if (b) b.textContent = `${val}${unit}`;
}
