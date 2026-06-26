// Khanya UNO demo: potentiometer = usage dial, buzzer = audible alarm,
// two LEDs (green = normal, red = overuse). Switch off on command.
//
// Flow: START -> stream readings every 1s. The potentiometer (A0) sets the
// power draw (watts). Turn it up past WATTS_THRESHOLD -> state "alert":
// green off, red LED blinks, and the buzzer beeps in time with the blink.
// Python sends OFF -> appliance "cut": LEDs + buzzer off, stop streaming.
// STOP -> stop streaming.
//
// volts stays steady ~230 (reserved for the outage / voltage-sag signal).

const int POT_PIN = A0;     // potentiometer wiper (middle leg)
const int BUZZER_PIN = 7;   // passive buzzer signal pin (driven with tone())
const int BUZZER_HZ = 2000; // beep frequency for the passive buzzer
const int LED_RED = 2;      // alert LED (blinks on overuse)
const int LED_GREEN = 3;    // normal LED (steady while usage is OK)
const int BUTTON_PIN = 4;   // physical switch-off button (other side to GND)

const unsigned long SEND_INTERVAL_MS = 150;   // one reading per second
 const int WATTS_THRESHOLD = 1500;             // must match Python's threshold
const int WATTS_MAX = 2600;                    // pot fully turned = this many watts

bool streaming = false;
bool muted = false;       // user acknowledged the alarm; silence the buzzer (LED stays)
unsigned long lastSend = 0;
unsigned long lastBlink = 0;
bool redOn = false;

// Red LED + buzzer together. hz sets the beep pitch (rises with severity); the
// buzzer stays silent while muted, but the red LED keeps blinking as a warning.
void setAlarm(bool on, int hz) {
  redOn = on;
  digitalWrite(LED_RED, on ? HIGH : LOW);
  if (on && !muted) tone(BUZZER_PIN, hz);
  else              noTone(BUZZER_PIN);
}

void normalState() {  // green on, alarm off
  redOn = false;
  digitalWrite(LED_RED, LOW);
  noTone(BUZZER_PIN);
  digitalWrite(LED_GREEN, HIGH);
}

void allOff() {
  redOn = false;
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
  noTone(BUZZER_PIN);
}

void setup() {
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);  // pressed = LOW (no resistor needed)
  allOff();
  Serial.begin(115200);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    muted = false;
    normalState();  // start in the normal (green) state
  } else if (cmd == "STOP" || cmd == "OFF") {
    streaming = false;
    muted = false;
    allOff();
  } else if (cmd == "MUTE") {
    muted = true;   // silence the buzzer until usage drops back to normal
  }
}

// Power draw = potentiometer position.
int readWatts() {
  return map(analogRead(POT_PIN), 0, 1023, 0, WATTS_MAX);
}

void loop() {
  if (Serial.available() > 0) {
    handleCommand(Serial.readStringUntil('\n'));
  }

  if (!streaming) {
    return;
  }

  // Physical kill switch: pressing the button cuts the appliance.
  if (digitalRead(BUTTON_PIN) == LOW) {
    streaming = false;
    allOff();
    // tell Python the appliance was switched off
    Serial.print("{\"device_id\":\"uno1\",\"ts\":");
    Serial.print(millis());
    Serial.print(",\"volts\":0,\"watts\":0,\"state\":\"off\"}\n");
    return;
  }

  int watts = readWatts();
  bool alert = watts > WATTS_THRESHOLD;

  // Alert: pulse the red LED + buzzer, ESCALATING with how far over the line we
  // are — just over = slow, low beeps; near max = fast, high-pitched beeps.
  // Normal: steady green, and clear any mute so the next spike alarms again.
  if (alert) {
    digitalWrite(LED_GREEN, LOW);
    int over = constrain(watts, WATTS_THRESHOLD, WATTS_MAX);
    unsigned long interval = map(over, WATTS_THRESHOLD, WATTS_MAX, 500, 120);
    int hz = map(over, WATTS_THRESHOLD, WATTS_MAX, 1800, 3200);
    if (millis() - lastBlink >= interval) {
      lastBlink = millis();
      setAlarm(!redOn, hz);
    }
  } else {
    muted = false;
    normalState();
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
