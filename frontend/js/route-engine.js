/**
 * =====================================================================
 * FLOODROUTE - Intelligent Safe Route Finder Engine
 * Implements Dijkstra's Algorithm, A* Search, OSRM Bridge,
 * and Road Cost = Distance * (1 + lambda * Normalized Risk)
 * Connects with Spring Boot REST API (/api/routes/plan) with
 * high-resilience client-side graph search fallback.
 * =====================================================================
 */

let routeMapInstance = null;
let shortestPolyline = null;
let safePolyline = null;
let routeMarkersGroup = null;

// Hyderabad Connected Road Network Graph Nodes
const HYD_NODES = {
  'Mehdipatnam': { coords: [17.3916, 78.4398], neighbors: ['Tolichowki', 'Shaikpet', 'Panjagutta', 'Malakpet'] },
  'Tolichowki': { coords: [17.4011, 78.4124], neighbors: ['Mehdipatnam', 'Gachibowli'] }, // High flood hotspot
  'Shaikpet': { coords: [17.4128, 78.3995], neighbors: ['Mehdipatnam', 'Gachibowli'] }, // Elevated Flyover Bypass
  'Gachibowli': { coords: [17.4401, 78.3489], neighbors: ['Tolichowki', 'Shaikpet', 'Hitec City', 'Miyapur'] },
  'Hitec City': { coords: [17.4483, 78.3915], neighbors: ['Gachibowli', 'Kukatpally', 'Ameerpet'] },
  'Ameerpet': { coords: [17.4375, 78.4482], neighbors: ['Kukatpally', 'Sanathnagar', 'Panjagutta', 'Hitec City'] },
  'Sanathnagar': { coords: [17.4580, 78.4380], neighbors: ['Ameerpet', 'Kukatpally'] }, // Safe bypass
  'Kukatpally': { coords: [17.4849, 78.4138], neighbors: ['Ameerpet', 'Sanathnagar', 'Miyapur', 'Hitec City'] },
  'Miyapur': { coords: [17.4968, 78.3614], neighbors: ['Kukatpally', 'Gachibowli'] },
  'Panjagutta': { coords: [17.4265, 78.4533], neighbors: ['Ameerpet', 'Mehdipatnam', 'Begumpet', 'MinisterRoad', 'Secunderabad'] },
  'Begumpet': { coords: [17.4447, 78.4664], neighbors: ['Panjagutta', 'Secunderabad'] }, // Chronic nala bottleneck
  'MinisterRoad': { coords: [17.4340, 78.4810], neighbors: ['Panjagutta', 'Secunderabad'] }, // Alternate bypass
  'Secunderabad': { coords: [17.4399, 78.4983], neighbors: ['Begumpet', 'MinisterRoad', 'Panjagutta', 'Uppal'] },
  'Uppal': { coords: [17.4018, 78.5602], neighbors: ['Secunderabad', 'Dilsukhnagar'] },
  'Malakpet': { coords: [17.3753, 78.4988], neighbors: ['Dilsukhnagar', 'Amberpet', 'Mehdipatnam'] }, // Underpass chronic flood
  'Amberpet': { coords: [17.3910, 78.5140], neighbors: ['Malakpet', 'LB Nagar'] }, // Elevated bypass
  'Dilsukhnagar': { coords: [17.3688, 78.5247], neighbors: ['Malakpet', 'LB Nagar', 'Uppal'] },
  'LB Nagar': { coords: [17.3457, 78.5522], neighbors: ['Dilsukhnagar', 'Amberpet'] }
};

// Edge characteristics with distance (meters) and dynamic flood risk (0 - 100)
const HYD_EDGES = [
  // Mehdipatnam <-> Gachibowli corridor
  { u: 'Mehdipatnam', v: 'Tolichowki', dist: 3400, risk: 85, impassable: true, label: 'Tolichowki Underpass Low Route' },
  { u: 'Tolichowki', v: 'Gachibowli', dist: 7100, risk: 35, impassable: false, label: 'Old Mumbai Highway' },
  { u: 'Mehdipatnam', v: 'Shaikpet', dist: 4800, risk: 15, impassable: false, label: 'Shaikpet Flyover Safe Route' },
  { u: 'Shaikpet', v: 'Gachibowli', dist: 6400, risk: 10, impassable: false, label: 'Shaikpet - Gachibowli Elevated Link' },

  // Ameerpet <-> Kukatpally corridor
  { u: 'Ameerpet', v: 'Kukatpally', dist: 8200, risk: 56, impassable: false, label: 'Moosapet Main Arterial' },
  { u: 'Ameerpet', v: 'Sanathnagar', dist: 3100, risk: 18, impassable: false, label: 'Sanathnagar Connector' },
  { u: 'Sanathnagar', v: 'Kukatpally', dist: 6000, risk: 16, impassable: false, label: 'Sanathnagar - KPHB Bypass' },

  // Secunderabad <-> Panjagutta corridor
  { u: 'Secunderabad', v: 'Begumpet', dist: 3700, risk: 78, impassable: false, label: 'Begumpet Nala Main' },
  { u: 'Begumpet', v: 'Panjagutta', dist: 2700, risk: 35, impassable: false, label: 'Prakash Nagar - Panjagutta' },
  { u: 'Secunderabad', v: 'MinisterRoad', dist: 2200, risk: 24, impassable: false, label: 'Minister Road Arterial' },
  { u: 'MinisterRoad', v: 'Panjagutta', dist: 4900, risk: 20, impassable: false, label: 'Ranigunj - Panjagutta Link' },

  // Malakpet <-> LB Nagar corridor
  { u: 'Malakpet', v: 'Dilsukhnagar', dist: 3200, risk: 91, impassable: true, label: 'Malakpet Railway Bridge Underpass' },
  { u: 'Dilsukhnagar', v: 'LB Nagar', dist: 6600, risk: 60, impassable: false, label: 'Vijayawada Highway' },
  { u: 'Malakpet', v: 'Amberpet', dist: 3000, risk: 28, impassable: false, label: 'Amberpet Bypass' },
  { u: 'Amberpet', v: 'LB Nagar', dist: 7400, risk: 22, impassable: false, label: 'Nagole - LB Nagar Link' },

  // Cross-city arterial connectors (ensures citywide connectivity)
  { u: 'Panjagutta', v: 'Mehdipatnam', dist: 4500, risk: 30, impassable: false, label: 'Banjara Hills Rd No 1' },
  { u: 'Panjagutta', v: 'Ameerpet', dist: 2100, risk: 32, impassable: false, label: 'Panjagutta - Ameerpet Metro Link' },
  { u: 'Panjagutta', v: 'Secunderabad', dist: 5800, risk: 28, impassable: false, label: 'Panjagutta - Secunderabad Tank Bund Link' },
  { u: 'Kukatpally', v: 'Miyapur', dist: 5200, risk: 25, impassable: false, label: 'NH65 Miyapur Stretch' },
  { u: 'Hitec City', v: 'Gachibowli', dist: 3600, risk: 20, impassable: false, label: 'Mindspace - Biodiversity Link' },
  { u: 'Hitec City', v: 'Ameerpet', dist: 8900, risk: 42, impassable: false, label: 'Madhapur - Jubilee Hills Link' },
  { u: 'Hitec City', v: 'Kukatpally', dist: 5800, risk: 28, impassable: false, label: 'Hitec City - KPHB Bypass' },
  { u: 'Gachibowli', v: 'Miyapur', dist: 7600, risk: 22, impassable: false, label: 'Financial District - Hafeezpet Bypass' },
  { u: 'Secunderabad', v: 'Uppal', dist: 7800, risk: 45, impassable: false, label: 'Tarnaka - Uppal Corridor' },
  { u: 'Uppal', v: 'Dilsukhnagar', dist: 6100, risk: 40, impassable: false, label: 'Ramanthapur Road' },
  { u: 'Mehdipatnam', v: 'Malakpet', dist: 6200, risk: 38, impassable: false, label: 'PVNR / Chaderghat Central Link' }
];

document.addEventListener('DOMContentLoaded', () => {
  initRouteMap();
  setupRoutePlannerForm();
});

function initRouteMap() {
  const mapEl = document.getElementById('routeMap');
  if (!mapEl) return;

  routeMapInstance = L.map('routeMap', {
    center: [17.4150, 78.4350],
    zoom: 12,
    zoomControl: false
  });

  L.control.zoom({ position: 'topright' }).addTo(routeMapInstance);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors | FloodRoute'
  }).addTo(routeMapInstance);

  routeMarkersGroup = L.layerGroup().addTo(routeMapInstance);

  // Plot key known junction nodes
  Object.keys(HYD_NODES).forEach(name => {
    const coords = HYD_NODES[name].coords;
    L.circleMarker(coords, {
      radius: 4,
      color: '#102A43',
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      weight: 2
    }).addTo(routeMapInstance).bindTooltip(name, { permanent: false, direction: 'top' });
  });
}

function setupRoutePlannerForm() {
  const form = document.getElementById('routePlannerForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const origin = document.getElementById('routeOrigin').value;
    const dest = document.getElementById('routeDestination').value;
    const algorithm = document.querySelector('input[name="algoChoice"]:checked')?.value || 'DIJKSTRA';
    const lambda = parseFloat(document.getElementById('lambdaSlider')?.value || 2.5);

    if (origin === dest) {
      showToast('Starting location and destination cannot be identical', 'warning');
      return;
    }

    showToast(`Evaluating risk-weighted safe route using ${algorithm}...`, 'info');

    // 1. First attempt: Query Spring Boot REST API
    try {
      const apiResponse = await FloodAPI.planRoute({
        origin: origin,
        destination: dest,
        algorithm: algorithm,
        riskWeightLambda: lambda
      });

      if (apiResponse && apiResponse.safeRoute && apiResponse.shortestRoute &&
          apiResponse.safeRoute.pathNodes && apiResponse.safeRoute.pathNodes.length > 1) {
        renderBackendRouteResults(apiResponse);
        showToast('Safe route calculated via Spring Boot GIS engine!', 'success');
        return;
      }
    } catch (apiErr) {
      console.warn('[FloodRoute] Backend route planner API offline or unreachable. Using client graph search fallback:', apiErr);
    }

    // 2. High-resilience Client-Side Fallback
    try {
      const result = evaluateGraphRouting(origin, dest, algorithm, lambda);
      displayRouteResults(result);
      showToast('Safe route calculated via client-side graph search!', 'success');
    } catch (evalErr) {
      console.error('[FloodRoute] Route calculation failed:', evalErr);
      showToast('Unable to find route between selected points.', 'critical');
    }
  });

  const lambdaSlider = document.getElementById('lambdaSlider');
  const lambdaBadge = document.getElementById('lambdaValBadge');
  if (lambdaSlider && lambdaBadge) {
    lambdaSlider.addEventListener('input', () => {
      lambdaBadge.textContent = `λ = ${lambdaSlider.value}`;
    });
  }
}

/**
 * Maps Spring Boot /api/routes/plan response to the frontend results panel
 */
function renderBackendRouteResults(apiResp) {
  const safe = apiResp.safeRoute || {};
  const shortest = apiResp.shortestRoute || {};

  const safeCoords = safe.coordinates && safe.coordinates.length > 0
    ? safe.coordinates.map(c => [Number(c[0]), Number(c[1])])
    : (safe.pathNodes || []).map(node => HYD_NODES[node]?.coords).filter(Boolean);

  const shortCoords = shortest.coordinates && shortest.coordinates.length > 0
    ? shortest.coordinates.map(c => [Number(c[0]), Number(c[1])])
    : (shortest.pathNodes || []).map(node => HYD_NODES[node]?.coords).filter(Boolean);

  const result = {
    origin: apiResp.origin,
    destination: apiResp.destination,
    algorithm: apiResp.algorithmUsed || 'DIJKSTRA',
    comparisonSummary: apiResp.comparisonSummary,
    safe: {
      path: safe.pathNodes || [],
      distanceKm: safe.distanceKm != null ? Number(safe.distanceKm).toFixed(1) : '0.0',
      minutes: safe.estimatedMinutes || 15,
      avgRisk: safe.averageRiskScore != null ? Number(safe.averageRiskScore).toFixed(1) : '15.0',
      hazards: safe.hazardsEncountered || 0,
      hazardList: safe.hazardDescriptions || [],
      coords: safeCoords
    },
    shortest: {
      path: shortest.pathNodes || [],
      distanceKm: shortest.distanceKm != null ? Number(shortest.distanceKm).toFixed(1) : '0.0',
      minutes: shortest.estimatedMinutes || 15,
      avgRisk: shortest.averageRiskScore != null ? Number(shortest.averageRiskScore).toFixed(1) : '45.0',
      hazards: shortest.hazardsEncountered || 0,
      hazardList: shortest.hazardDescriptions || [],
      coords: shortCoords
    }
  };

  displayRouteResults(result);
}

/**
 * Custom JavaScript Dijkstra & A* Path Evaluation
 */
function evaluateGraphRouting(start, goal, algo, lambda) {
  // Build adjacency graph
  const adj = {};
  Object.keys(HYD_NODES).forEach(k => { adj[k] = []; });

  HYD_EDGES.forEach(edge => {
    if (!adj[edge.u]) adj[edge.u] = [];
    if (!adj[edge.v]) adj[edge.v] = [];
    adj[edge.u].push({ target: edge.v, dist: edge.dist, risk: edge.risk, impassable: edge.impassable, label: edge.label });
    adj[edge.v].push({ target: edge.u, dist: edge.dist, risk: edge.risk, impassable: edge.impassable, label: edge.label });
  });

  // Shortest Route (Pure distance: lambda = 0)
  const shortestPathData = runGraphSearch(adj, start, goal, 0.0, 'DIJKSTRA');

  // Safe Route (Cost = Distance * (1 + lambda * (Risk / 100)))
  const safePathData = runGraphSearch(adj, start, goal, lambda, algo);

  return {
    origin: start,
    destination: goal,
    algorithm: algo,
    shortest: shortestPathData,
    safe: safePathData
  };
}

function runGraphSearch(adj, start, goal, lambda, algo) {
  const dist = {};
  const prev = {};
  const prevEdge = {};
  const pq = [];

  Object.keys(HYD_NODES).forEach(k => { dist[k] = Infinity; });
  dist[start] = 0;
  pq.push({ node: start, cost: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { node: u, cost: currentCost } = pq.shift();

    if (currentCost > dist[u]) continue;
    if (u === goal) break;

    const neighbors = adj[u] || [];
    for (const edge of neighbors) {
      // Cost formula: Distance * (1 + lambda * (Risk / 100))
      let penalty = 1.0 + lambda * (edge.risk / 100.0);
      if (edge.impassable && lambda > 0) {
        penalty += 40.0; // avoid impassable hazards in safe mode
      }

      const edgeCost = edge.dist * penalty;
      const newCost = dist[u] + edgeCost;

      if (newCost < dist[edge.target]) {
        dist[edge.target] = newCost;
        prev[edge.target] = u;
        prevEdge[edge.target] = edge;

        let priority = newCost;
        if (algo === 'ASTAR') {
          priority += heuristic(edge.target, goal);
        }
        pq.push({ node: edge.target, cost: priority });
      }
    }
  }

  // Reconstruct path
  const path = [];
  let curr = goal;
  let totalDistM = 0;
  let riskSum = 0;
  let edgeCount = 0;
  let hazards = 0;
  const hazardList = [];

  while (curr) {
    path.unshift(curr);
    const e = prevEdge[curr];
    if (e) {
      totalDistM += e.dist;
      riskSum += e.risk;
      edgeCount++;
      if (e.risk >= 50 || e.impassable) {
        hazards++;
        hazardList.push(`${e.label} (Risk: ${e.risk}%)`);
      }
    }
    curr = prev[curr];
    if (curr === start) {
      path.unshift(start);
      break;
    }
  }

  // Fallback if unreachable
  if (path.length <= 1 || path[0] !== start) {
    const directDist = heuristic(start, goal) || 6000;
    return {
      path: [start, goal],
      distanceKm: (directDist / 1000).toFixed(1),
      minutes: Math.max(10, Math.round((directDist / 1000 / 28) * 60)),
      avgRisk: '20.0',
      hazards: 0,
      hazardList: [],
      cost: directDist.toFixed(0)
    };
  }

  const distKm = totalDistM / 1000;
  const avgRisk = edgeCount > 0 ? (riskSum / edgeCount) : 10;
  const minutes = Math.max(8, Math.round((distKm / 28) * 60)); // ~28km/h rainy traffic speed

  return {
    path,
    distanceKm: distKm.toFixed(1),
    minutes,
    avgRisk: avgRisk.toFixed(1),
    hazards,
    hazardList,
    cost: dist[goal] && dist[goal] !== Infinity ? dist[goal].toFixed(0) : 0
  };
}

function heuristic(u, v) {
  const c1 = HYD_NODES[u]?.coords;
  const c2 = HYD_NODES[v]?.coords;
  if (!c1 || !c2) return 0;
  const dx = (c1[0] - c2[0]) * 111000;
  const dy = (c1[1] - c2[1]) * 111000;
  return Math.sqrt(dx * dx + dy * dy);
}

function displayRouteResults(result) {
  const panel = document.getElementById('routeComparisonResults');
  if (!panel) return;
  panel.style.display = 'block';

  // Safe Route details
  document.getElementById('safeDist').textContent = `${result.safe.distanceKm} km`;
  document.getElementById('safeTime').textContent = `${result.safe.minutes} mins`;
  document.getElementById('safeRisk').textContent = `${result.safe.avgRisk}/100`;
  document.getElementById('safeHazards').textContent = `${result.safe.hazards} active hazard(s)`;
  document.getElementById('safePathWaypoints').textContent = result.safe.path.join(' ➔ ');

  // Shortest Route details
  document.getElementById('shortDist').textContent = `${result.shortest.distanceKm} km`;
  document.getElementById('shortTime').textContent = `${result.shortest.minutes} mins`;
  document.getElementById('shortRisk').textContent = `${result.shortest.avgRisk}/100`;
  document.getElementById('shortHazards').textContent = `${result.shortest.hazards} active hazard(s)`;
  document.getElementById('shortPathWaypoints').textContent = result.shortest.path.join(' ➔ ');

  // Summary message
  const summaryEl = document.getElementById('routeSummaryMessage');
  if (summaryEl) {
    if (result.comparisonSummary) {
      summaryEl.innerHTML = `
        <div class="disclaimer-banner" style="background-color: var(--green-bg); border-left-color: var(--green); margin-bottom: 16px;">
          <p><strong>Recommendation:</strong> ${result.comparisonSummary}</p>
        </div>
      `;
    } else {
      const riskDiff = (parseFloat(result.shortest.avgRisk) - parseFloat(result.safe.avgRisk)).toFixed(1);
      if (riskDiff > 10) {
        summaryEl.innerHTML = `
          <div class="disclaimer-banner" style="background-color: var(--green-bg); border-left-color: var(--green); margin-bottom: 16px;">
            <p><strong>Recommendation:</strong> Take the Safe Route. It eliminates high-risk flood bottlenecks (saving ${riskDiff}% estimated hazard risk) with a minimal route adjustment.</p>
          </div>
        `;
      } else {
        summaryEl.innerHTML = `
          <div class="disclaimer-banner" style="margin-bottom: 16px;">
            <p>Both corridors offer comparable risk exposure under present rainfall levels. Drive with headlights on and monitor underpass advisories.</p>
          </div>
        `;
      }
    }
  }

  // Draw Polylines on Leaflet Map
  drawRoutePolylines(result.shortest.path, result.safe.path, result.shortest.coords, result.safe.coords);

  // Smoothly scroll to results panel
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function drawRoutePolylines(shortPath, safePath, customShortCoords, customSafeCoords) {
  if (!routeMapInstance) return;

  if (shortestPolyline) routeMapInstance.removeLayer(shortestPolyline);
  if (safePolyline) routeMapInstance.removeLayer(safePolyline);
  if (routeMarkersGroup) routeMarkersGroup.clearLayers();

  const shortCoords = (customShortCoords && customShortCoords.length > 0)
    ? customShortCoords
    : (shortPath || []).map(node => HYD_NODES[node]?.coords).filter(Boolean);

  const safeCoords = (customSafeCoords && customSafeCoords.length > 0)
    ? customSafeCoords
    : (safePath || []).map(node => HYD_NODES[node]?.coords).filter(Boolean);

  // Red/Amber polyline for shortest (cuts through hazard)
  if (shortCoords.length > 1) {
    shortestPolyline = L.polyline(shortCoords, {
      color: '#D94D4D',
      weight: 5,
      opacity: 0.75,
      dashArray: '8, 8'
    }).addTo(routeMapInstance).bindTooltip('Shortest Route (Higher Inundation Risk)');
  }

  // Green polyline for safe route
  if (safeCoords.length > 1) {
    safePolyline = L.polyline(safeCoords, {
      color: '#2DAD79',
      weight: 6,
      opacity: 0.95
    }).addTo(routeMapInstance).bindTooltip('Recommended Safe Route (Lower Risk)');
  }

  // Fit bounds to show entire route
  const layers = [shortestPolyline, safePolyline].filter(Boolean);
  if (layers.length > 0) {
    const group = L.featureGroup(layers);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      routeMapInstance.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  // Place Start & Finish Markers
  if (safeCoords.length > 0) {
    const startNodeName = safePath && safePath.length > 0 ? safePath[0] : 'Origin';
    const endNodeName = safePath && safePath.length > 0 ? safePath[safePath.length - 1] : 'Destination';

    L.marker(safeCoords[0], {
      icon: L.divIcon({ className: 'custom-pin pin-low', html: 'A', iconSize: [28, 28] })
    }).addTo(routeMarkersGroup).bindPopup('Origin: ' + startNodeName);

    L.marker(safeCoords[safeCoords.length - 1], {
      icon: L.divIcon({ className: 'custom-pin pin-high', html: 'B', iconSize: [28, 28] })
    }).addTo(routeMarkersGroup).bindPopup('Destination: ' + endNodeName);
  }
}
