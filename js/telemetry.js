/* ============================================================
   TELEMETRY ENGINE
   ------------------------------------------------------------
   Right now this generates simulated-but-plausible telemetry
   (position, battery, speed) so every page works today, with
   your GPS still on the breadboard and no protocol locked in.

   >>> HOW TO SWAP IN YOUR REAL GPS LATER <<<
   Nothing on the page needs to change — only the two functions
   marked SWAP POINT below. Three ways to feed them real data,
   easiest first given where your build is right now:

   1. Bridge script on your laptop (recommended today)
      Breadboarded GPS -> Arduino/ESP32 over USB serial, printing
      NMEA sentences ($GPGGA/$GPRMC) -> a small Python script on
      your laptop reads the serial port, parses lat/lon, and
      re-broadcasts it as JSON over a local WebSocket
      (ws://localhost:8765). Point WS_ENDPOINT below at that
      address and flip USE_LIVE_FEED to true. See integrate.html
      for the ~30-line Python script.

   2. ESP32 hosting its own feed
      If your GPS module sits on an ESP32/ESP8266 (has WiFi), skip
      the laptop bridge entirely: have the board itself parse NMEA
      and serve JSON over its own WebSocket or HTTP endpoint on
      your local network. Point WS_ENDPOINT at the board's IP.

   3. Real flight-controller telemetry (MAVLink)
      Once you're past manual/breadboard and running a real
      autopilot (ArduPilot/PX4), swap this whole file for a
      MAVLink websocket bridge (mavsdk-server or similar). The
      shape of TelemetryEngine below (subscribe/state) stays the
      same either way — only where the numbers come from changes.
   ============================================================ */

const USE_LIVE_FEED = false;                 // flip true once your bridge is running
const WS_ENDPOINT = "ws://localhost:8765";   // SWAP POINT: your bridge/board address

class TelemetryEngine {
  constructor() {
    this.state = {
      connected: false,
      simulated: !USE_LIVE_FEED,
      uavCode: null,
      uav: null,
      lat: null,
      lng: null,
      headingDeg: 0,
      speedKmh: 0,
      batteryPct: 100,
      mode: "manual", // "manual" | "auto"
    };
    this.listeners = [];
    this._simHandle = null;
    this._ws = null;
    this._route = null; // {origin, dest, distanceKm} when flying a mission
  }

  subscribe(fn) {
    this.listeners.push(fn);
    fn(this.state);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  }

  _emit() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Connect to a UAV by its code. Returns the matched registry entry, or null. */
  connect(code) {
    const uav = findUav(code);
    if (!uav) return null;
    this.state.uavCode = code.trim().toUpperCase();
    this.state.uav = uav;
    this.state.connected = true;
    this.state.batteryPct = 100;

    if (USE_LIVE_FEED) {
      this._connectLiveFeed();       // SWAP POINT (path 1/2 above)
    } else {
      this._connectSimulated();      // demo data — safe to fly with, wires nothing real
    }
    this._emit();
    return uav;
  }

  disconnect() {
    this.state.connected = false;
    this._route = null;
    if (this._simHandle) clearInterval(this._simHandle);
    if (this._ws) this._ws.close();
    this._emit();
  }

  setMode(mode) {
    this.state.mode = mode;
    this._emit();
  }

  /** Register a planned A -> B mission so simulated flight can move toward it. */
  flyRoute(origin, dest, distanceKm) {
    this._route = { origin, dest, distanceKm, progress: 0 };
    this.state.lat = origin.lat;
    this.state.lng = origin.lng;
  }

  // ---- SWAP POINT: live feed -------------------------------------------
  _connectLiveFeed() {
    this.state.simulated = false;
    try {
      this._ws = new WebSocket(WS_ENDPOINT);
      this._ws.onmessage = (evt) => {
        const d = JSON.parse(evt.data);
        // Expected shape from your bridge: { lat, lng, headingDeg, speedKmh, batteryPct }
        Object.assign(this.state, d);
        this.state.speedKmh = 0;
        this._emit();
      };
      this._ws.onerror = () => {
        console.warn("Live feed unreachable — check your bridge script is running at", WS_ENDPOINT);
      };
    } catch (e) {
      console.warn("Could not open live feed:", e);
    }
  }

  // ---- simulated demo data ----------------------------------------------
  _connectSimulated() {
    this.state.simulated = true;
    // Start somewhere near a plausible default depot if no route set yet.
    if (this.state.lat === null) {
      this.state.lat = 25.5941 + (Math.random() - 0.5) * 0.02;
      this.state.lng = 85.1376 + (Math.random() - 0.5) * 0.02;
    }
    if (this._simHandle) clearInterval(this._simHandle);
    this._simHandle = setInterval(() => {
      const s = this.state;
      if (this._route && this._route.progress < 1) {
        const r = this._route;
        r.progress = Math.min(1, r.progress + 0.02 + Math.random() * 0.01);
        s.lat = r.origin.lat + (r.dest.lat - r.origin.lat) * r.progress;
        s.lng = r.origin.lng + (r.dest.lng - r.origin.lng) * r.progress;
        s.speedKmh = 0;
        s.batteryPct = Math.max(4, Math.round(100 - r.progress * 62));
        s.headingDeg = bearingBetween(r.origin, r.dest);
      } else {
        // idle hover jitter — small realistic drift, not a flight
        s.lat += (Math.random() - 0.5) * 0.00015;
        s.lng += (Math.random() - 0.5) * 0.00015;
        s.speedKmh = 0;
        s.batteryPct = Math.max(4, s.batteryPct - 0.03);
      }
      this._emit();
    }, 900);
  }
}

function bearingBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(b.lng - a.lng);
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Single shared instance used across every page.
const telemetry = new TelemetryEngine();
