/* ============================================================
   ROUTE PLANNING
   Straight-line A -> B distance/ETA/battery math, plus small
   Leaflet helpers shared by delivery.html and rescue.html.
   Auto mode = straight line. Manual mode = operator clicks
   waypoints on the map and flies that drawn path instead.
   ============================================================ */

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Total length of a multi-point path (used for manually drawn routes). */
function pathLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** Given a UAV spec and a distance, compute ETA and battery needed. */
function estimateMission(uav, distanceKm) {
  const cruise = uav.cruiseSpeedKmh || 35;
  const etaMin = (distanceKm / cruise) * 60;
  // Battery burn modeled off max range: full pack covers maxRangeKm, plus a
  // reserve margin, matching the "leave a safety buffer" note on every page.
  const battPctNeeded = Math.min(100, (distanceKm / uav.maxRangeKm) * 100 * 1.15);
  const feasible = distanceKm <= uav.maxRangeKm * 0.85; // 15% reserve, same margin everywhere
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    etaMin: Math.round(etaMin),
    battPctNeeded: Math.round(battPctNeeded),
    feasible,
  };
}

/** Build a Leaflet map with the dark basemap treatment used across the site. */
function buildMap(elId, center) {
  const map = L.map(elId, { zoomControl: false, attributionControl: true }).setView(
    [center.lat, center.lng],
    13
  );
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);
  return map;
}

function droneDivIcon(headingDeg = 0) {
  return L.divIcon({
    className: "drone-icon",
    html: `<div style="
      width:22px;height:22px;display:flex;align-items:center;justify-content:center;
      transform:rotate(${headingDeg}deg);filter:drop-shadow(0 0 4px rgba(143,191,134,.8));
    "><svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#8fbf86" stroke="#14181c" stroke-width="1"/>
    </svg></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function pinDivIcon(color) {
  return L.divIcon({
    className: "pin-icon",
    html: `<div style="width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:2px solid #14181c;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 14],
  });
}

/**
 * Attach manual draw mode to a map: while active, clicks add waypoints and
 * draw a polyline; returns handle with getPoints()/clear()/setActive().
 */
function attachManualDraw(map) {
  let active = false;
  let points = [];
  let line = null;
  let markers = [];

  function redraw() {
    if (line) map.removeLayer(line);
    if (points.length > 1) {
      line = L.polyline(points.map((p) => [p.lat, p.lng]), {
        color: "#c9a36a",
        weight: 3,
        dashArray: "6 6",
      }).addTo(map);
    }
  }

  function onClick(e) {
    if (!active) return;
    const p = { lat: e.latlng.lat, lng: e.latlng.lng };
    points.push(p);
    const m = L.circleMarker(e.latlng, {
      radius: 5,
      color: "#c9a36a",
      fillColor: "#c9a36a",
      fillOpacity: 1,
    }).addTo(map);
    markers.push(m);
    redraw();
  }

  map.on("click", onClick);

  return {
    setActive(v) { active = v; },
    isActive: () => active,
    getPoints: () => points.slice(),
    clear() {
      points = [];
      markers.forEach((m) => map.removeLayer(m));
      markers = [];
      if (line) { map.removeLayer(line); line = null; }
    },
  };
}
