# embot-mvp

MicroPython firmware for an electromagnetic kinetic "robot room" running on an ESP32-S3.
The device alternates between two phases creating a cyclic push-pull motion driven by electromagnetic or mechanical actuation.
1) Switching four electromagnets and ((Primary MVP focus))
2) Sweeping two servo motors in sync ((Secondary testing focus only))

## Hardware

| Component | Details |
|---|---|
| MCU | ESP32-S3-DevKitC-1 (WROOM-2) |
| Firmware | MicroPython |
| Electromagnet driver | 4-channel MOSFET driver board — channels A/B/C/D |
| Electromagnets | 4× coils, one per MOSFET channel |
| Servo driver | PCA9685 PWM controller (I2C, addr `0x40`, SCL=IO9, SDA=IO8) |
| Servos | 2× on PCA9685 channels 0 and 1 |

### Electromagnet circuit

The ESP32 cannot drive coils directly — its GPIO pins only source ~12 mA, far below what an electromagnet needs. The MOSFET board sits between them:

```
ESP32 GPIO (logic signal) → MOSFET gate → coil current switched to electromagnet
```

The four ESP32 pins output **logic HIGH/LOW only**. The MOSFET board handles the coil voltage and current on a separate power rail. Each channel maps to one magnet:

| Channel | GPIO | Magnet label |
|---|---|---|
| A | IO42 | Magnet A |
| B | IO41 | Magnet B |
| C | IO1  | Magnet C |
| D | IO2  | Magnet D |

> When scaling to more electromagnets, this MOSFET board gets replaced or augmented — see `COLLAB.md` for the expansion path.

## How it works

The main loop runs two alternating phases:

- **Phase A** — Magnets A (IO42) + C (IO1) on, B+D off → servos sweep to positions A (30°, 150°)
- **Phase B** — Magnets B (IO41) + D (IO2) on, A+C off → servos sweep to positions B (150°, 30°)

Each phase is 0.1 s. The servo sweep interpolates over 20 steps so motion fits exactly within the phase window. On boot, the device connects to WiFi (`boot.py`).

## Repo structure

```
embot-mvp/
├── main/
│   ├── boot.py               # WiFi connection on startup
│   ├── main.py               # Main loop: magnet phases + servo sweeps
│   ├── pca9685.py            # PCA9685 PWM driver + Servo class
│   ├── scan.py               # I2C bus scanner utility (run manually)
│   ├── wifi_config.py.example
│   └── settings.toml.example
├── tools/
│   ├── embot_sim.py          # Desktop OSC simulator (build TD/Max patches without hardware)
│   └── requirements.txt
├── mps_pinouts.json          # ESP32-S3 pinout reference for MicroPython Workbench
├── COLLAB.md                 # OSC interface spec and collaborator guide
├── .vscode/settings.json     # VS Code / Pylance config (paths need local setup)
└── .gitignore
```

> `wifi_config.py`, `settings.toml`, and `device.cfg` are **not tracked** — they contain credentials and machine-specific paths. See setup below.

## Setup

### 1. Clone and create credential files

```bash
git clone <repo-url>
cd embot-mvp/main
cp wifi_config.py.example wifi_config.py
cp settings.toml.example  settings.toml
```

Edit both files with your WiFi SSID and password.

### 2. Install MicroPython Workbench

This project uses the [MicroPython Workbench](https://marketplace.visualstudio.com/items?itemName=micropython-studio.micropython-ide) VS Code extension to sync code to the device.

After installing, run its setup command to install MicroPython stubs for your OS. Then update `.vscode/settings.json` → `python.analysis.extraPaths` to point at your local stubs and venv:

```json
"python.analysis.extraPaths": [
  "C:\\Users\\<you>\\.micropython-studio\\stubs\\micropython-esp32-stubs",
  "C:\\Users\\<you>\\.micropython-studio\\.venv\\Lib\\site-packages"
]
```

> `device.cfg` is machine-specific (COM port, absolute paths) and is regenerated automatically by MicroPython Workbench when you open the project — you do not need to create it manually.

### 3. Flash MicroPython (if starting fresh)

Download the ESP32-S3 MicroPython firmware from [micropython.org/download/ESP32_GENERIC_S3](https://micropython.org/download/ESP32_GENERIC_S3/) and flash it with `esptool`:

```bash
esptool.py --chip esp32s3 --port COMx erase_flash
esptool.py --chip esp32s3 --port COMx write_flash 0x0 ESP32_GENERIC_S3-*.bin
```

### 4. Sync to device

Connect the board via USB. In VS Code, use MicroPython Workbench's sync command to push `main/` to the device. The `main.py` and `boot.py` files run automatically on power-up.

## Tuning

Key constants in `main.py`:

| Constant | Default | Effect |
|---|---|---|
| `SWITCH_SPEED` | `0.1` s | Duration of each magnet phase |
| `STEP_COUNT` | `20` | Servo sweep resolution (steps per phase) |
| `SERVO_0_POS_A/B` | `30° / 150°` | Servo 0 positions for phase A and B |
| `SERVO_1_POS_A/B` | `150° / 30°` | Servo 1 positions for phase A and B |

## Utilities

- **`scan.py`** — Run manually over REPL to scan common I2C pin pairs and find what address your PCA9685 is on. Useful when wiring is uncertain.

## Dependencies

All code is self-contained MicroPython — no package manager needed. `pca9685.py` is a minimal PCA9685 + Servo driver included directly in the repo.
