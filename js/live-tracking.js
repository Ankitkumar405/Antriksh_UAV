/* Read-only live MAVLink dashboard client. It never sends flight commands. */

(() => {
  const WS_URL = window.ANTRIKSH_WS_URL || "ws://127.0.0.1:8765";
  const TEST_MODE = new URLSearchParams(window.location.search).get("testMode") === "1";
  const MAX_TRAIL_POINTS = 400;
  const FIXED_MODEL_ROTATION = { x: -Math.PI / 2, y: Math.PI / 2, z: 0 };
  let map;
  let marker;
  let trail;
  let aircraft;
  let socket;
  let reconnectTimer;
  let reconnectDelay = 500;
  let lastValidPoint;
  let testTimer;
  let testAngle = 0;

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const number = (value, suffix = "") => value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : `${Number(value).toFixed(1)}${suffix}`;
  const coordinate = (value) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(5);

  function setStatus(connected, message, timestamp) {
    const dot = $("liveTrackingDot");
    if (dot) dot.className = `dot ${connected ? "live" : "off"}`;
    setText("liveTrackingStatus", message);
    setText("liveTrackingUpdated", timestamp ? `Last update · ${new Date(timestamp).toLocaleTimeString()}` : "Last update · waiting");
  }

  function validPoint(data) {
    return data && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude)) && Number(data.latitude) !== 0 && Number(data.longitude) !== 0 && Number(data.gpsFix || 0) >= 2;
  }

  function updateMap(data) {
    if (!validPoint(data) || !map) return;
    const point = [Number(data.latitude), Number(data.longitude)];
    if (!marker) {
      marker = L.marker(point, { icon: L.divIcon({ className: "live-aircraft-marker", html: "<span>✈</span>", iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map);
      trail = L.polyline([], { color: "#8fbf86", weight: 3, opacity: .8 }).addTo(map);
    }
    marker.setLatLng(point);
    const points = trail.getLatLngs();
    if (!lastValidPoint || Math.abs(point[0] - lastValidPoint[0]) + Math.abs(point[1] - lastValidPoint[1]) > 0.000001) {
      points.push(point);
      if (points.length > MAX_TRAIL_POINTS) points.shift();
      trail.setLatLngs(points);
      lastValidPoint = point;
    }
    if ($("liveFollow")?.checked) map.panTo(point, { animate: true, duration: .4 });
  }

  function updateModel(data) {
    if (!aircraft) return;
    const toRad = Math.PI / 180;
    const target = {
      x: FIXED_MODEL_ROTATION.x + Number(data.pitch || 0) * toRad,
      y: FIXED_MODEL_ROTATION.y + Number(data.heading ?? data.yaw ?? 0) * toRad,
      z: FIXED_MODEL_ROTATION.z + Number(data.roll || 0) * toRad,
    };
    aircraft.rotation.x += (target.x - aircraft.rotation.x) * .12;
    aircraft.rotation.y += (target.y - aircraft.rotation.y) * .12;
    aircraft.rotation.z += (target.z - aircraft.rotation.z) * .12;
  }

  function updateCards(data) {
    setText("liveLatitude", coordinate(data.latitude));
    setText("liveLongitude", coordinate(data.longitude));
    setText("liveAltitude", number(data.altitude, " m"));
    setText("liveGroundSpeed", number(data.groundSpeed, " m/s"));
    setText("liveHeading", number(data.heading, "°"));
    setText("liveBattery", data.batteryRemaining == null ? "—" : `${data.batteryRemaining}%`);
    setText("liveGpsFix", data.gpsFix == null ? "—" : `${data.gpsFix}`);
    setText("liveSatellites", data.satellites == null ? "—" : `${data.satellites}`);
    setText("liveFlightMode", data.flightMode || "—");
    setText("liveArmed", data.armed == null ? "—" : data.armed ? "ARMED" : "DISARMED");
    const armed = $("liveArmed");
    if (armed) armed.className = data.armed ? "telemetry-value danger" : "telemetry-value good";
  }

  function handleData(data) {
    if (!data || typeof data !== "object") return;
    updateCards(data);
    updateMap(data);
    updateModel(data);
    setStatus(Boolean(data.connected), data.connected ? (data.testMode ? "TEST MODE · CONNECTED" : "LIVE · CONNECTED") : "OFFLINE · WAITING", data.timestamp);
  }

  function connect() {
    if (TEST_MODE) { startTestMode(); return; }
    try {
      socket = new WebSocket(WS_URL);
      socket.addEventListener("open", () => { reconnectDelay = 500; setStatus(false, "CONNECTED · WAITING FOR MAVLINK", null); });
      socket.addEventListener("message", (event) => { try { handleData(JSON.parse(event.data)); } catch (error) { console.warn("Invalid telemetry JSON", error); } });
      socket.addEventListener("close", () => { setStatus(false, "OFFLINE · RETRYING", null); scheduleReconnect(); });
      socket.addEventListener("error", () => setStatus(false, "OFFLINE · WAITING", null));
    } catch (error) { console.warn("WebSocket unavailable", error); setStatus(false, "OFFLINE · WAITING", null); scheduleReconnect(); }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  }

  function startTestMode() {
    setStatus(true, "TEST MODE · SIMULATED", new Date().toISOString());
    testTimer = setInterval(() => {
      testAngle += .06;
      handleData({ timestamp: new Date().toISOString(), connected: true, testMode: true, latitude: 22.5726 + Math.sin(testAngle) * .002, longitude: 88.3639 + Math.cos(testAngle) * .002, altitude: 120 + Math.sin(testAngle) * 4, groundSpeed: 18.2, heading: (245 + testAngle * 20) % 360, roll: Math.sin(testAngle) * 8, pitch: Math.cos(testAngle) * 3, yaw: 245, batteryRemaining: 87, gpsFix: 3, satellites: 12, flightMode: "TEST-AUTO", armed: false });
    }, 250);
  }

  function initModel() {
    if (typeof THREE === "undefined" || typeof THREE.GLTFLoader === "undefined") return;
    const container = $("liveModelViewer");
    if (!container) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, container.clientWidth / container.clientHeight, .01, 100);
    camera.position.set(4.8, 2.8, 5.2); camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputEncoding = THREE.sRGBEncoding; container.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff7eb, 0x202830, 1.7));
    const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(4, 6, 5); scene.add(light);
    const rig = new THREE.Group(); scene.add(rig); aircraft = new THREE.Group(); rig.add(aircraft);
    new THREE.GLTFLoader().load("rc_aircraft_3d_model.glb", (gltf) => {
      const model = gltf.scene; const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const scale = 3.8 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale); model.position.copy(center).multiplyScalar(-scale); model.rotation.set(FIXED_MODEL_ROTATION.x, FIXED_MODEL_ROTATION.y, FIXED_MODEL_ROTATION.z); aircraft.add(model); container.dataset.modelLoaded = "true";
    }, undefined, () => { container.dataset.modelLoaded = "error"; });
    rig.rotation.set(.18, -.5, 0);
    const animate = () => { requestAnimationFrame(animate); renderer.render(scene, camera); }; animate();
    window.addEventListener("resize", () => { const w = container.clientWidth; const h = container.clientHeight; if (!w || !h) return; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); });
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (!$("liveTracking")) return;
    map = L.map("liveMap", { zoomControl: true }).setView([25.5941, 85.1376], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
    initModel();
    connect();
  });
})();
