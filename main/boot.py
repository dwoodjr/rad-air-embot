import network
import time

try:
    from wifi_config import SSID, PASSWORD

    sta = network.WLAN(network.STA_IF)
    sta.active(True)

    if not sta.isconnected():
        sta.connect(SSID, PASSWORD)
        deadline = time.ticks_add(time.ticks_ms(), 15_000)
        while not sta.isconnected():
            if time.ticks_diff(deadline, time.ticks_ms()) <= 0:
                print("WiFi: timed out, continuing without network")
                break
            time.sleep_ms(200)

    if sta.isconnected():
        print("WiFi:", sta.ifconfig()[0])

except Exception as e:
    print("WiFi boot error:", e)
