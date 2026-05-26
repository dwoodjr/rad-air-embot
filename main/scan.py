from machine import SoftI2C, Pin

pins = [(4,5),(8,9),(21,22),(1,2),(6,7),(10,11)]
for sda, scl in pins:
    i2c = SoftI2C(scl=Pin(scl), sda=Pin(sda))
    found = i2c.scan()
    if found:
        print("FOUND on SDA={} SCL={}: {}".format(sda, scl, [hex(d) for d in found]))
    else:
        print("nothing on SDA={} SCL={}".format(sda, scl))
