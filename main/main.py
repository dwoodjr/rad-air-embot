from machine import Pin, I2C
import time
from pca9685 import PCA9685, Servo

# --- TIMING ---
SWITCH_SPEED = 0.1   # seconds per magnet phase
STEP_COUNT   = 20
STEP_DELAY   = SWITCH_SPEED / STEP_COUNT  # sweep fits exactly within phase

# --- SERVO POSITIONS (degrees, 0-180) ---
SERVO_0_POS_A = 30
SERVO_0_POS_B = 150
SERVO_1_POS_A = 150
SERVO_1_POS_B = 30

# --- MAGNET PINS ---
magnet_a = Pin(42, Pin.OUT)
magnet_b = Pin(41, Pin.OUT)
magnet_c = Pin(1,  Pin.OUT)
magnet_d = Pin(2,  Pin.OUT)

# --- PCA9685 + SERVOS ---
i2c = I2C(0, scl=Pin(9), sda=Pin(8), freq=400_000)

devices = i2c.scan()
print("I2C scan:", [hex(d) for d in devices])
if not devices:
    raise RuntimeError("No I2C devices found — check wiring and VCC")

pca    = PCA9685(i2c)
servo0 = Servo(pca, 0)
servo1 = Servo(pca, 1)

def sweep(pos0, pos1, steps=STEP_COUNT, step_delay=STEP_DELAY):
    start0 = servo0.angle if servo0.angle is not None else pos0
    start1 = servo1.angle if servo1.angle is not None else pos1
    for i in range(1, steps + 1):
        t = i / steps
        servo0.angle = start0 + (pos0 - start0) * t
        servo1.angle = start1 + (pos1 - start1) * t
        time.sleep(step_delay)

SWEEP_TIME = STEP_COUNT * STEP_DELAY  # == SWITCH_SPEED
print(f"Starting — magnet switch every {SWITCH_SPEED}s, servos synced")

while True:
    print("Phase A: A+C ON  / B+D OFF")
    magnet_a.value(1)
    magnet_b.value(0)
    magnet_c.value(1)
    magnet_d.value(0)
    sweep(SERVO_0_POS_A, SERVO_1_POS_A)
    time.sleep(SWITCH_SPEED - SWEEP_TIME)

    print("Phase B: B+D ON  / A+C OFF")
    magnet_a.value(0)
    magnet_b.value(1)
    magnet_c.value(0)
    magnet_d.value(1)
    sweep(SERVO_0_POS_B, SERVO_1_POS_B)
    time.sleep(SWITCH_SPEED - SWEEP_TIME)
