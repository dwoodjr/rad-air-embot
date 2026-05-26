import time

_MODE1     = 0x00
_PRESCALE  = 0xFE
_LED0_ON_L = 0x06

class PCA9685:
    def __init__(self, i2c, address=0x40):
        self.i2c = i2c
        self.address = address
        self._write(_MODE1, 0x20)  # auto-increment enabled (bit 5), required for multi-byte writes
        self.frequency = 50

    def _write(self, reg, value):
        self.i2c.writeto_mem(self.address, reg, bytes([value]))

    def _read(self, reg):
        return self.i2c.readfrom_mem(self.address, reg, 1)[0]

    @property
    def frequency(self):
        return self._frequency

    @frequency.setter
    def frequency(self, freq):
        self._frequency = freq
        prescale = int(25_000_000 / (4096 * freq) - 0.5)
        old_mode = self._read(_MODE1)
        self._write(_MODE1, (old_mode & 0x7F) | 0x10)  # sleep to change prescale
        self._write(_PRESCALE, prescale)
        self._write(_MODE1, old_mode)
        time.sleep_ms(5)
        self._write(_MODE1, old_mode | 0x80)

    def set_pwm(self, channel, on, off):
        reg = _LED0_ON_L + 4 * channel
        self.i2c.writeto_mem(self.address, reg,
                             bytes([on & 0xFF, on >> 8, off & 0xFF, off >> 8]))


class Servo:
    def __init__(self, pca, channel, min_us=500, max_us=2500):
        self.pca = pca
        self.channel = channel
        period_us = 1_000_000 / pca.frequency
        self._min = int(min_us / period_us * 4096)
        self._max = int(max_us / period_us * 4096)
        self._angle = None

    @property
    def angle(self):
        return self._angle

    @angle.setter
    def angle(self, degrees):
        degrees = max(0, min(180, degrees))
        self._angle = degrees
        duty = int(self._min + (degrees / 180) * (self._max - self._min))
        self.pca.set_pwm(self.channel, 0, duty)
