// Khanya UNO demo: scan power usage, blink + alert on overuse, switch off on command.
//
// Flow: START -> stream readings every 1s (LED off = normal). watts climbs over
// time and spikes past WATTS_THRESHOLD -> state "alert", LED blinks fast.
// Python sends OFF -> appliance "cut": LED off, stop streaming (idle).
// STOP -> stop streaming.
//
// volts stays steady ~230 (reserved for the outage / voltage-sag signal).
// watts is the climbing value (the overuse signal). Swap the simulated watts
// for a real current-sensor reading when the hardware arrives.

const int LED_PIN = 2;  // external LED on breadboard: pin 2 -> resistor -> LED -> GND
const unsigned long SEND_INTERVAL_MS = 1000;   // one reading per second
const unsigned long BLINK_INTERVAL_MS = 200;   // LED blink rate during alert
const int WATTS_THRESHOLD = 2000;              // must match Python's threshold

bool streaming = false;
unsigned long lastSend = 0;
unsigned long lastBlink = 0;
unsigned long streamStart = 0;
bool ledOn = false;

void setLed(bool on) {
  ledOn = on;
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  setLed(false);
  Serial.begin(9600);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    streamStart = millis();
    setLed(false);
  } else if (cmd == "STOP" || cmd == "OFF") {
    streaming = false;
    setLed(false);
  }
}

// Simulated power draw: normal baseline for the first 12s, then climbs ~200W/s
// until it crosses the threshold and stays high (the "overuse" event).
int simulatedWatts() {
  unsigned long elapsed = millis() - streamStart;
  if (elapsed < 12000) {
    return 350 + (int)random(-30, 31);
  }
  int watts = 350 + (int)((elapsed - 12000) / 1000) * 200;
  if (watts > 2600) watts = 2600;  // cap so it plateaus
  return watts;
}

void loop() {
  if (Serial.available() > 0) {
    handleCommand(Serial.readStringUntil('\n'));
  }

  if (!streaming) {
    return;
  }

  int watts = simulatedWatts();
  bool alert = watts > WATTS_THRESHOLD;

  // Blink the LED while in alert; keep it off when usage is normal.
  if (alert) {
    if (millis() - lastBlink >= BLINK_INTERVAL_MS) {
      lastBlink = millis();
      setLed(!ledOn);
    }
  } else if (ledOn) {
    setLed(false);
  }

  // Send one reading per second.
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    int volts = 230 + (int)random(-3, 4);  // steady mains voltage
    Serial.print("{\"device_id\":\"uno1\",\"ts\":");
    Serial.print(millis());
    Serial.print(",\"volts\":");
    Serial.print(volts);
    Serial.print(",\"watts\":");
    Serial.print(watts);
    Serial.print(",\"state\":\"");
    Serial.print(alert ? "alert" : "normal");
    Serial.print("\"}");
    Serial.print("\n");
  }
}
