/**
 * =====================================================================
 * FLOODROUTE - Hotspot Detection & Spatial Clustering Engine
 * DBSCAN-style distance clustering & ranking of chronic flood zones
 * =====================================================================
 */

const EPSILON_KM = 0.8; // Proximity threshold (~800m)
const MIN_SAMPLES = 2; // Min incidents to form a cluster

document.addEventListener('DOMContentLoaded', async () => {
  await loadAndComputeHotspots();
});

async function loadAndComputeHotspots() {
  const reports = await FloodAPI.getReports();
  const clusters = runDBSCANClustering(reports, EPSILON_KM, MIN_SAMPLES);
  renderHotspotRankingTable(clusters);
}

function runDBSCANClustering(reports, epsKm, minPts) {
  const clusters = [];
  const visited = new Set();
  const noise = [];

  for (let i = 0; i < reports.length; i++) {
    const p = reports[i];
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    const neighbors = getRegionNeighbors(p, reports, epsKm);
    if (neighbors.length < minPts) {
      noise.push(p);
    } else {
      const newCluster = [];
      expandCluster(p, neighbors, newCluster, reports, visited, epsKm, minPts);
      clusters.push(newCluster);
    }
  }

  // Format clusters with statistics
  return clusters.map((group, idx) => {
    let sumRisk = 0;
    let sumDepth = 0;
    group.forEach(item => {
      sumRisk += (item.riskScore || 50);
      sumDepth += (item.waterDepthCm || 20);
    });

    const avgRisk = sumRisk / group.size || sumRisk / group.length;
    const avgDepth = sumDepth / group.length;
    const locality = group[0].locality;

    return {
      rank: idx + 1,
      code: `HOT-HYD-${String(idx + 1).padStart(2, '0')}`,
      locality: locality,
      incidentCount: group.length,
      averageDepthCm: avgDepth.toFixed(1),
      averageRiskScore: avgRisk.toFixed(1),
      riskLevel: avgRisk >= 80 ? 'CRITICAL' : (avgRisk >= 60 ? 'HIGH' : 'MODERATE'),
      keyHazard: group[0].hazardCategory
    };
  }).sort((a, b) => b.incidentCount - a.incidentCount);
}

function expandCluster(p, neighbors, cluster, reports, visited, epsKm, minPts) {
  cluster.push(p);
  const queue = [...neighbors];

  while (queue.length > 0) {
    const q = queue.shift();
    if (!visited.has(q.id)) {
      visited.add(q.id);
      const qNeighbors = getRegionNeighbors(q, reports, epsKm);
      if (qNeighbors.length >= minPts) {
        queue.push(...qNeighbors);
      }
    }
    if (!cluster.some(item => item.id === q.id)) {
      cluster.push(q);
    }
  }
}

function getRegionNeighbors(target, allPoints, epsKm) {
  return allPoints.filter(p => {
    if (p.id === target.id) return false;
    const d = haversineDistanceKm(target.latitude, target.longitude, p.latitude, p.longitude);
    return d <= epsKm;
  });
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderHotspotRankingTable(clusters) {
  const tbody = document.getElementById('hotspotsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!clusters || clusters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No clustered flood hotspots identified yet.</td></tr>`;
    return;
  }

  clusters.forEach((h, index) => {
    const tr = document.createElement('tr');
    const badgeClass = `badge-${h.riskLevel.toLowerCase()}`;

    tr.innerHTML = `
      <td><strong>#${index + 1}</strong></td>
      <td><code>${h.code}</code></td>
      <td class="cell-title">${h.locality}</td>
      <td><strong>${h.incidentCount}</strong> reports</td>
      <td>${h.averageDepthCm} cm</td>
      <td><span class="badge ${badgeClass}">${h.riskLevel}</span></td>
      <td>${h.keyHazard}</td>
    `;
    tbody.appendChild(tr);
  });
}
