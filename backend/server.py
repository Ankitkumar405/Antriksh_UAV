"""Read-only ArduPilot MAVLink to WebSocket bridge.

No flight-control commands are sent. MAVLink is received from UDP and
normalized into a small JSON snapshot for the browser dashboard.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import time
from datetime import datetime, timezone
from typing import Any

from pymavlink import mavutil
import websockets

LOG = logging.getLogger("antriksh.mavlink")
UDP_ENDPOINT = os.getenv("MAVLINK_UDP", "udp:127.0.0.1:14550")
WEBSOCKET_HOST = os.getenv("WS_HOST", "127.0.0.1")
WEBSOCKET_PORT = int(os.getenv("WS_PORT", "8765"))
TEST_MODE = os.getenv("TEST_MODE", "0").lower() in {"1", "true", "yes"}
STALE_AFTER_SECONDS = float(os.getenv("STALE_AFTER_SECONDS", "3"))

clients: set[Any] = set()
state: dict[str, Any] = {
    "testMode": TEST_MODE,
    "timestamp": None,
    "connected": False,
    "latitude": None,
    "longitude": None,
    "altitude": None,
    "relativeAltitude": None,
    "groundSpeed": None,
    "airSpeed": None,
    "heading": None,
    "roll": None,
    "pitch": None,
    "yaw": None,
    "batteryVoltage": None,
    "batteryRemaining": None,
    "gpsFix": None,
    "satellites": None,
    "flightMode": None,
    "armed": None,
}
last_message_monotonic = 0.0


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def number(value: Any, digits: int = 2) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
        if not math.isfinite(parsed):
            return None
        return round(parsed, digits)
    except (TypeError, ValueError):
        return None


def update(**values: Any) -> None:
    global last_message_monotonic
    for key, value in values.items():
        if value is not None:
            state[key] = value
    state["timestamp"] = iso_now()
    state["connected"] = True
    last_message_monotonic = time.monotonic()


def handle_message(message: Any, connection: Any) -> None:
    message_type = message.get_type()
    if message_type == "BAD_DATA":
        return

    if message_type == "HEARTBEAT":
        armed = bool(message.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
        update(
            flightMode=mavutil.mode_string_v10(message),
            armed=armed,
        )
    elif message_type == "GLOBAL_POSITION_INT":
        update(
            latitude=number(message.lat / 1e7, 7),
            longitude=number(message.lon / 1e7, 7),
            altitude=number(message.alt / 1000),
            relativeAltitude=number(message.relative_alt / 1000),
            groundSpeed=number(math.hypot(message.vx, message.vy) / 100),
            heading=number(message.hdg / 100 if message.hdg != 65535 else None),
        )
    elif message_type == "VFR_HUD":
        update(
            airSpeed=number(message.airspeed),
            groundSpeed=number(message.groundspeed),
            heading=number(message.heading),
            altitude=number(message.alt),
        )
    elif message_type == "ATTITUDE":
        update(
            roll=number(math.degrees(message.roll)),
            pitch=number(math.degrees(message.pitch)),
            yaw=number((math.degrees(message.yaw) + 360) % 360),
        )
    elif message_type == "GPS_RAW_INT":
        update(
            latitude=number(message.lat / 1e7, 7) if message.lat else None,
            longitude=number(message.lon / 1e7, 7) if message.lon else None,
            gpsFix=int(message.fix_type),
            satellites=int(message.satellites_visible),
        )
    elif message_type == "SYS_STATUS":
        update(
            batteryVoltage=number(message.voltage_battery / 1000),
            batteryRemaining=(int(message.battery_remaining) if message.battery_remaining >= 0 else None),
        )
    elif message_type == "BATTERY_STATUS":
        voltage = next((item for item in message.voltages if item not in (0, 65535)), None)
        update(
            batteryVoltage=number(voltage / 1000 if voltage is not None else None),
            batteryRemaining=(int(message.battery_remaining) if message.battery_remaining >= 0 else None),
        )


def valid_gps(snapshot: dict[str, Any]) -> bool:
    return (
        snapshot.get("latitude") is not None
        and snapshot.get("longitude") is not None
        and snapshot["latitude"] != 0
        and snapshot["longitude"] != 0
        and (snapshot.get("gpsFix") or 0) >= 2
    )


def snapshot() -> dict[str, Any]:
    result = dict(state)
    result["connected"] = bool(last_message_monotonic and time.monotonic() - last_message_monotonic <= STALE_AFTER_SECONDS)
    if not result["connected"]:
        result["gpsFix"] = result.get("gpsFix")
    return result


async def mavlink_reader() -> None:
    global last_message_monotonic
    if TEST_MODE:
        LOG.warning("TEST_MODE enabled: generating clearly labelled simulated telemetry")
        angle = 0.0
        while True:
            angle += 0.08
            update(
                latitude=22.5726 + math.sin(angle) * 0.002,
                longitude=88.3639 + math.cos(angle) * 0.002,
                altitude=120 + math.sin(angle * 0.7) * 4,
                relativeAltitude=95 + math.sin(angle * 0.7) * 4,
                groundSpeed=18.2,
                airSpeed=17.5,
                heading=(245 + math.degrees(angle)) % 360,
                roll=math.sin(angle) * 8,
                pitch=math.cos(angle) * 3,
                yaw=(245 + math.degrees(angle)) % 360,
                batteryVoltage=11.8,
                batteryRemaining=87,
                gpsFix=3,
                satellites=12,
                flightMode="TEST-AUTO",
                armed=False,
            )
            await asyncio.sleep(0.25)
        return

    while True:
        connection = None
        try:
            LOG.info("Opening MAVLink UDP connection: %s", UDP_ENDPOINT)
            connection = mavutil.mavlink_connection(UDP_ENDPOINT)
            LOG.info("Waiting for MAVLink heartbeat...")
            await asyncio.to_thread(connection.wait_heartbeat, timeout=10)
            LOG.info("MAVLink heartbeat received")
            last_message_monotonic = time.monotonic()
            while True:
                message = await asyncio.to_thread(connection.recv_match, blocking=True, timeout=1)
                if message is not None:
                    handle_message(message, connection)
                if last_message_monotonic and time.monotonic() - last_message_monotonic > STALE_AFTER_SECONDS:
                    state["connected"] = False
        except Exception:
            LOG.exception("MAVLink reader stopped; retrying in 3 seconds")
            state["connected"] = False
            await asyncio.sleep(3)
        finally:
            if connection is not None:
                connection.close()


async def broadcast_loop() -> None:
    while True:
        if clients:
            payload = json.dumps(snapshot(), separators=(",", ":"))
            results = await asyncio.gather(*(client.send(payload) for client in clients), return_exceptions=True)
            for client, result in zip(tuple(clients), results):
                if isinstance(result, Exception):
                    clients.discard(client)
        await asyncio.sleep(0.25)


async def websocket_handler(websocket: Any, _path: str | None = None) -> None:
    clients.add(websocket)
    LOG.info("WebSocket client connected (%d active)", len(clients))
    try:
        await websocket.send(json.dumps(snapshot(), separators=(",", ":")))
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        LOG.info("WebSocket client disconnected (%d active)", len(clients))


async def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    LOG.info("WebSocket bridge listening on ws://%s:%d", WEBSOCKET_HOST, WEBSOCKET_PORT)
    async with websockets.serve(websocket_handler, WEBSOCKET_HOST, WEBSOCKET_PORT):
        await asyncio.gather(mavlink_reader(), broadcast_loop())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        LOG.info("Bridge stopped")
