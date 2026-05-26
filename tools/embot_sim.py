"""
embot_sim.py — Desktop simulator for the embot ESP32 OSC interface.

Mimics the OSC broadcasts the ESP32 will send, and receives commands
from TouchDesigner so both sides of the interface can be built and
tested without physical hardware.

Usage:
    python embot_sim.py                         # default: localhost, 0.1s phases
    python embot_sim.py --speed 0.5             # slower phases
    python embot_sim.py --host 192.168.1.42     # send to another machine on LAN

Install dependency:
    pip install python-osc

Ports (match what TD and Max are configured to use):
    9000  — this sim LISTENS here (TD sends commands to this port)
    9001  — this sim SENDS here  (Max/TD listen on this port)
"""

import argparse
import threading
import time

from pythonosc import dispatcher, osc_server, udp_client

# ---------------------------------------------------------------------------
# Default config — override with CLI args
# ---------------------------------------------------------------------------
DEFAULT_HOST      = "127.0.0.1"
DEFAULT_SEND_PORT = 9001   # matches ESP32 outbound (Max/TD listen here)
DEFAULT_RECV_PORT = 9000   # matches ESP32 listen port (TD sends here)
DEFAULT_SPEED     = 0.1    # seconds per phase

# Magnet states per phase: [A, B, C, D] as floats 0.0–1.0
# (binary now, but float-typed so PWM values work without schema changes)
PHASE_MAGNETS = {
    0: [1.0, 0.0, 1.0, 0.0],   # Phase A: A+C on
    1: [0.0, 1.0, 0.0, 1.0],   # Phase B: B+D on
}

# Actuator indices for magnets (A=2, B=3, C=4, D=5)
MAGNET_LABELS = ["A", "B", "C", "D"]
MAGNET_INDEX_OFFSET = 2   # magnet A = actuator index 2

# ---------------------------------------------------------------------------
# Shared sim state
# ---------------------------------------------------------------------------
state = {
    "running":      True,
    "speed":        DEFAULT_SPEED,
    "phase":        0,
    "cycle":        0,
    "manual_phase": None,
    "magnets":      list(PHASE_MAGNETS[0]),
}
state_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Broadcast helpers
# ---------------------------------------------------------------------------

def broadcast_state(client: udp_client.SimpleUDPClient) -> None:
    with state_lock:
        phase   = state["phase"]
        cycle   = state["cycle"]
        magnets = list(state["magnets"])

    client.send_message("/embot/phase/state", phase)
    client.send_message("/embot/cycle",       cycle)

    for i, val in enumerate(magnets):
        client.send_message(f"/embot/actuator/{i + MAGNET_INDEX_OFFSET}/state", val)

    label_str = "  ".join(
        f"{MAGNET_LABELS[i]}={'ON ' if v > 0 else 'off'}"
        for i, v in enumerate(magnets)
    )
    print(f"  phase={phase}  cycle={cycle:4d}  |  {label_str}")


# ---------------------------------------------------------------------------
# Sim loop
# ---------------------------------------------------------------------------

def sim_loop(client: udp_client.SimpleUDPClient) -> None:
    print("[sim] loop started\n")
    while True:
        with state_lock:
            running      = state["running"]
            speed        = state["speed"]
            manual_phase = state["manual_phase"]

        if running:
            with state_lock:
                if manual_phase is not None:
                    state["phase"] = manual_phase
                else:
                    state["phase"] = 1 - state["phase"]
                state["cycle"]   += 1
                state["magnets"]  = list(PHASE_MAGNETS[state["phase"]])

            broadcast_state(client)

        time.sleep(speed)


# ---------------------------------------------------------------------------
# OSC command handlers (incoming from TouchDesigner)
# ---------------------------------------------------------------------------

def handle_run(address, value):
    with state_lock:
        state["running"] = bool(int(value))
    print(f"[cmd] {address} → running={state['running']}")


def handle_speed(address, value):
    with state_lock:
        state["speed"] = float(value)
    print(f"[cmd] {address} → {value}s per phase")


def handle_phase(address, value):
    with state_lock:
        state["manual_phase"] = int(value)
    print(f"[cmd] {address} → manual phase override={value}")


def handle_actuator_set(address, *args):
    value = args[0] if args else None
    # Parse index from address: /embot/actuator/N/set
    parts = address.split("/")
    idx = int(parts[3]) if len(parts) > 3 else "?"
    magnet_label = MAGNET_LABELS[idx - MAGNET_INDEX_OFFSET] if isinstance(idx, int) and 0 <= idx - MAGNET_INDEX_OFFSET < 4 else "?"
    print(f"[cmd] {address} → {value}  (magnet {magnet_label}, logged only)")


def handle_pattern(address, *args):
    # /embot/pattern expects 4 float values: [A, B, C, D]
    values = list(args)
    print(f"[cmd] /embot/pattern → {values}  (logged only)")


def handle_fallback(address, *args):
    print(f"[cmd] unrecognised: {address} {args}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="embot OSC simulator")
    parser.add_argument("--host",      default=DEFAULT_HOST,
                        help="IP to send OSC output to (default: 127.0.0.1)")
    parser.add_argument("--send-port", type=int, default=DEFAULT_SEND_PORT,
                        help=f"Port to broadcast state on (default: {DEFAULT_SEND_PORT})")
    parser.add_argument("--recv-port", type=int, default=DEFAULT_RECV_PORT,
                        help=f"Port to receive commands on (default: {DEFAULT_RECV_PORT})")
    parser.add_argument("--speed",     type=float, default=DEFAULT_SPEED,
                        help=f"Phase duration in seconds (default: {DEFAULT_SPEED})")
    args = parser.parse_args()

    with state_lock:
        state["speed"] = args.speed

    client = udp_client.SimpleUDPClient(args.host, args.send_port)

    disp = dispatcher.Dispatcher()
    disp.map("/embot/run",              handle_run)
    disp.map("/embot/speed",            handle_speed)
    disp.map("/embot/phase",            handle_phase)
    disp.map("/embot/actuator/*/*",     handle_actuator_set)
    disp.map("/embot/pattern",          handle_pattern)
    disp.set_default_handler(handle_fallback)

    server = osc_server.ThreadingOSCUDPServer(("0.0.0.0", args.recv_port), disp)

    print("=" * 60)
    print("  embot OSC simulator")
    print("=" * 60)
    print(f"  Broadcasting state → {args.host}:{args.send_port}")
    print(f"  Receiving commands ← 0.0.0.0:{args.recv_port}")
    print(f"  Phase speed: {args.speed}s  ({1/args.speed:.1f} Hz)")
    print()
    print("  Broadcasts sent (Max/TD listens on send-port):")
    print("    /embot/phase/state         i   0=A  1=B")
    print("    /embot/cycle               i   cumulative")
    print("    /embot/actuator/2/state    f   magnet A  0.0/1.0")
    print("    /embot/actuator/3/state    f   magnet B")
    print("    /embot/actuator/4/state    f   magnet C")
    print("    /embot/actuator/5/state    f   magnet D")
    print()
    print("  Commands accepted from TD (recv-port):")
    print("    /embot/run             i   1=start  0=stop")
    print("    /embot/speed           f   seconds per phase")
    print("    /embot/phase           i   0=A  1=B  (manual override)")
    print("    /embot/actuator/N/set  f   0.0–1.0  (logged, not applied)")
    print("    /embot/pattern         ffff  [A B C D] values  (logged)")
    print("=" * 60)
    print()

    sim_thread = threading.Thread(target=sim_loop, args=(client,), daemon=True)
    sim_thread.start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[sim] stopped")


if __name__ == "__main__":
    main()
