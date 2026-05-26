# embot — Collaborator Guide

This doc is for collaborators building the TouchDesigner control bridge and the Max/MSP soundscape. It covers what the hardware is doing right now, the OSC interface you should design against, and what to keep in mind as the system scales.

---

## What the embot is right now

A single ESP32-S3 microcontroller running MicroPython. It drives two types of actuators in a synchronized alternating loop:

- **4 electromagnets** — switched via a 4-channel MOSFET bank. The ESP32 outputs a logic HIGH/LOW signal; the MOSFET handles the actual coil current. The four magnets are labeled A, B, C, D.
- **2 servo motors** — controlled via a PCA9685 PWM driver board over I2C. The ESP32 talks to the PCA9685; the PCA9685 generates the PWM signals for the servos.

On power-up the device connects to WiFi and prints its IP address over USB serial. Everything else runs automatically.

---

## The phase loop (what it's doing physically)

The main loop alternates between two states continuously:

| | Magnets ON | Magnets OFF | Servo 0 | Servo 1 |
|---|---|---|---|---|
| **Phase A** | A + C | B + D | 30° | 150° |
| **Phase B** | B + D | A + C | 150° | 30° |

Each phase lasts **0.1 seconds**. The servos don't snap — they sweep across 20 interpolated steps to fill the phase window exactly. So the motion is: magnets switch → servos glide to new position → magnets switch → repeat.

The ABCD labeling maps to physical coil positions on the installation. A+C and B+D are opposing pairs — the alternation creates a push-pull magnetic field cycle.

---

## OSC interface — design against this

> **OSC is not yet implemented in the firmware.** This is the planned interface. Build your TD patch and Max patch against this schema now so that when the firmware layer is added, both sides slot in without redesign.

- **Transport**: UDP
- **ESP32 listen port**: `9000` (receives commands from TD)
- **Outbound port**: `9001` (ESP32 broadcasts state to Max/MSP and TD)
- **ESP32 IP**: printed to USB serial on boot — set a DHCP reservation in your router for a stable address

### TouchDesigner → ESP32 (commands)

| Address | Type | Values | Effect |
|---|---|---|---|
| `/embot/run` | `i` | `1` / `0` | Start or stop the phase loop |
| `/embot/speed` | `f` | seconds (e.g. `0.05`–`2.0`) | Set phase duration |
| `/embot/phase` | `i` | `0` = A, `1` = B | Force a specific phase (manual override) |
| `/embot/actuator/0/set` | `f` | `0.0`–`1.0` | Servo 0 position (normalized, maps to 0°–180°) |
| `/embot/actuator/1/set` | `f` | `0.0`–`1.0` | Servo 1 position (normalized) |
| `/embot/actuator/2/set` | `i` | `0` / `1` | Magnet A on/off |
| `/embot/actuator/3/set` | `i` | `0` / `1` | Magnet B on/off |
| `/embot/actuator/4/set` | `i` | `0` / `1` | Magnet C on/off |
| `/embot/actuator/5/set` | `i` | `0` / `1` | Magnet D on/off |

**Why index-based addressing?** See the scaling section below — named addresses (`/magnet/a`) break down fast. Design your TD patch using indices from day one.

### ESP32 → Max/MSP + TD (state broadcasts)

The ESP32 fires these on each phase transition:

| Address | Type | Values | When |
|---|---|---|---|
| `/embot/phase/state` | `i` | `0` = A, `1` = B | Every phase transition |
| `/embot/cycle` | `i` | cumulative count | Every phase transition |
| `/embot/actuator/0/pos` | `f` | `0.0`–`1.0` | Every phase transition |
| `/embot/actuator/1/pos` | `f` | `0.0`–`1.0` | Every phase transition |

**`/embot/phase/state` is the key signal for Max.** It fires at the magnet switch — a reliable rhythmic pulse. `/embot/cycle` lets you build longer compositional arcs (every 8 cycles, every 32, etc.).

---

## Timing expectations

- Phase duration is currently **100ms** (10 Hz). This is adjustable via `/embot/speed`.
- OSC over WiFi/UDP has ~5–20ms jitter on MicroPython. Fine for musical sync at this tempo — don't expect sample-accurate triggering.
- If you slow the installation down to 0.5–2s phases, the jitter becomes negligible.

---

## Scaling plan — what to keep in mind

The current setup (4 magnets, 2 servos, 1 device) is the MVP. The installation is intended to eventually scale to **hundreds of actuators** — either all electromagnets or all servos, not a mix.

### How it scales

**Multiple ESP32 boards, one per zone.** Rather than one giant controller, each board handles its local cluster of actuators. All boards receive OSC over WiFi simultaneously (broadcast or addressed individually). This keeps wiring local, isolates failures, and lets zones run different patterns.

**Servo path** — PCA9685 boards chain on I2C. One ESP32 can address up to 62 chained boards (992 servo channels). Your TD patch doesn't change — just the actuator count in config.

**Electromagnet path** — at scale, the MOSFET bank grows via I2C GPIO expander chips (MCP23017, 16 outputs each, chainable). The ESP32 still speaks I2C; the expanders drive the MOSFET gates. Same logic, more channels.

### What this means for your TD patch

- **Use index-based addressing** — `/embot/actuator/N/set` not named channels. When there are 64 magnets, you'll want to drive them with a loop, not 64 individual send nodes.
- **Think in zones** — each ESP32 has a device ID and owns a range of actuator indices (e.g. device 0 owns indices 0–15, device 1 owns 16–31). Your patch can address a specific board or broadcast to all.
- **Pattern arrays** — plan for a `/embot/pattern` message that sends a full array of states in one packet rather than N individual messages. Useful when you want to set 64 magnets simultaneously.

### What this means for the Max soundscape

- The phase transition broadcast (`/embot/phase/state`) stays the same regardless of scale — it's a per-device heartbeat.
- If there are multiple boards, each will have its own device ID in the OSC prefix (e.g. `/embot/1/phase/state`, `/embot/2/phase/state`). You can listen to all of them or pick specific zones.
- The cycle count is the most useful handle for musical structure — treat it as a clock that the physical installation is running on.

---

## Quick reference — current pin/channel map

| Label | Type | Interface | Address |
|---|---|---|---|
| Magnet A | Electromagnet (via MOSFET) | GPIO 42 | `/embot/actuator/2/set` |
| Magnet B | Electromagnet (via MOSFET) | GPIO 41 | `/embot/actuator/3/set` |
| Magnet C | Electromagnet (via MOSFET) | GPIO 1 | `/embot/actuator/4/set` |
| Magnet D | Electromagnet (via MOSFET) | GPIO 2 | `/embot/actuator/5/set` |
| Servo 0 | Servo | PCA9685 ch 0 (I2C 0x40) | `/embot/actuator/0/set` |
| Servo 1 | Servo | PCA9685 ch 1 (I2C 0x40) | `/embot/actuator/1/set` |

I2C bus: SCL = IO9, SDA = IO8, 400 kHz.

---

## Repo structure

```
main/
├── boot.py             # WiFi connect on startup, prints IP
├── main.py             # Phase loop — magnets + servo sweeps
├── pca9685.py          # PCA9685 PWM driver + Servo class
├── scan.py             # I2C scanner utility (run manually via REPL)
├── wifi_config.py      # NOT in repo — copy from .example
└── settings.toml       # NOT in repo — copy from .example
```

See `README.md` for hardware setup and flashing instructions.
