// Khanya UNO demo: LED on/off + simulated voltage stream over serial.
const int LED_PIN = LED_BUILTIN;
const unsigned long INTERVAL_MS = 1000;

bool streaming = false;
unsigned long lastSend = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(9600);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    digitalWrite(LED_PIN, HIGH);
  } else if (cmd == "STOP") {
    streaming = false;
    digitalWrite(LED_PIN, LOW);
  }
}

void loop() {
  if (Serial.available() > 0) {
    handleCommand(Serial.readStringUntil('\n'));
  }

  if (streaming && millis() - lastSend >= INTERVAL_MS) {
    lastSend = millis();
    // Simulated voltage wobbling around 230 (swap for analogRead later).
    int volts = 230 + (int)(random(-5, 6));
    Serial.print("{\"device_id\":\"uno1\",\"ts\":");
    Serial.print(millis());
    Serial.print(",\"volts\":");
    Serial.print(volts);
    Serial.print(",\"watts\":0,\"state\":\"on\"}");
    Serial.print("\n");
  }
}
