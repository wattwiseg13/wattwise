// Khanya UNO demo: potentiometer = usage dial, sound sensor = instant surge,
// two LEDs (green = normal, red = overuse). Switch off on command.
//
// Flow: START -> stream readings every 1s. The potentiometer (A0) sets the
// power draw (watts). A clap on the sound sensor (D7) adds a short surge.
// watts above WATTS_THRESHOLD -> state "alert": green off, red LED blinks.
// Python sends OFF -> appliance "cut": both LEDs off, stop streaming.
// STOP -> stop streaming.
//
// volts stays steady ~230 (reserved for the outage / voltage-sag signal).

const int POT_PIN = A0;     // potentiometer wiper (middle leg)
const int SOUND_PIN = 7;    // sound sensor digital OUT
const int LED_RED = 2;      // alert LED (blinks on overuse)
const int LED_GREEN = 3;    // normal LED (steady while usage is OK)

const unsigned long SEND_INTERVAL_MS = 1000;   // one reading per second
const unsigned long BLINK_INTERVAL_MS = 200;   // red blink rate during alert
const int WATTS_THRESHOLD = 2000;              // must match Python's threshold
const int WATTS_MAX = 2600;                    // pot fully turned = this many watts
const int SOUND_SURGE_WATTS = 1500;            // extra watts added by a clap
const unsigned long SOUND_SURGE_MS = 4000;     // how long the surge lasts

bool streaming = false;
unsigned long lastSend = 0;
unsigned long lastBlink = 0;
unsigned long surgeUntil = 0;
bool redOn = false;

void setLeds(bool red, bool green) {
  redOn = red;
  digitalWrite(LED_RED, red ? HIGH : LOW);
  digitalWrite(LED_GREEN, green ? HIGH : LOW);
}

void setup() {
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(SOUND_PIN, INPUT);
  setLeds(false, false);
  Serial.begin(9600);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    setLeds(false, true);  // start in the normal (green) state
  } else if (cmd == "STOP" || cmd == "OFF") {
    streaming = false;
    setLeds(false, false);
  }
}

// Power draw = potentiometer position, plus a temporary surge after a clap.
int readWatts() {
  int watts = map(analogRead(POT_PIN), 0, 1023, 0, WATTS_MAX);
  if (millis() < surgeUntil) {
    watts += SOUND_SURGE_WATTS;
  }
  if (watts > WATTS_MAX) watts = WATTS_MAX;
  return watts;
}

void loop() {
  if (Serial.available() > 0) {
    handleCommand(Serial.readStringUntil('\n'));
  }

  if (!streaming) {
    return;
  }

  // A clap (sound OUT goes HIGH) starts a short power surge.
  if (digitalRead(SOUND_PIN) == HIGH) {
    surgeUntil = millis() + SOUND_SURGE_MS;
  }

  int watts = readWatts();
  bool alert = watts > WATTS_THRESHOLD;

  // LEDs: red blinks during alert (green off); green steady when normal.
  if (alert) {
    digitalWrite(LED_GREEN, LOW);
    if (millis() - lastBlink >= BLINK_INTERVAL_MS) {
      lastBlink = millis();
      setLeds(!redOn, false);
    }
  } else {
    setLeds(false, true);
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
