/* ============================================================
   UAV REGISTRY
   Static lookup table keyed by UAV code. This is the single
   place that defines what a "drone model" is on this site.

   >>> TO ADD YOUR REAL AIRFRAME <<<
   Add an entry here with your drone's real specs. That's it —
   every page (connect, delivery, rescue) reads from this table,
   so one edit updates the whole site.
   ============================================================ */

const UAV_REGISTRY = {
  "SCT-7734-KX": {
    name: "Scout MK1",
    role: "Delivery quad",
    weightKg: 2.4,
    maxPayloadKg: 1.5,
    batteryWh: 99,
    cruiseSpeedKmh: 42,
    maxRangeKm: 11,
    frame: "Quadcopter",
    controller: "Manual + waypoint (dual mode)",
  },
  "ANT-1000-RS": {
    name: "Antriksh Core",
    role: "Modular multi-role frame",
    weightKg: 3.1,
    maxPayloadKg: 2.0,
    batteryWh: 133,
    cruiseSpeedKmh: 38,
    maxRangeKm: 14,
    frame: "Quadcopter, swappable payload bay",
    controller: "Manual + waypoint (dual mode)",
  },
  "RSQ-2200-FX": {
    name: "Rescuewing FX",
    role: "Disaster-response fixed-wing hybrid",
    weightKg: 4.6,
    maxPayloadKg: 2.5,
    batteryWh: 210,
    cruiseSpeedKmh: 61,
    maxRangeKm: 26,
    frame: "VTOL fixed-wing",
    controller: "Manual + waypoint (dual mode)",
  },
};

/** Look up a UAV by code. Case/whitespace tolerant. */
function findUav(code) {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  return UAV_REGISTRY[key] || null;
}

/** Demo codes shown as placeholders/hints in the UI. */
const DEMO_UAV_CODES = Object.keys(UAV_REGISTRY);
