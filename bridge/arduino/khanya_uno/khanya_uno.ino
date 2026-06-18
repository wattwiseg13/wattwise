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
const int BUZZER_PIN = 7;   // buzzer signal pin (active buzzer: HIGH = beep)
const int LED_RED = 2;      // alert LED (blinks on overuse)
const int LED_GREEN = 3;    // normal LED (steady while usage is OK)
const int BUTTON_PIN = 4;   // physical switch-off button (other side to GND)

const unsigned long SEND_INTERVAL_MS = 1000;   // one reading per second
const unsigned long BLINK_INTERVAL_MS = 200;   // red/buzzer pulse rate during alert
const int WATTS_THRESHOLD = 2000;              // must match Python's threshold
const int WATTS_MAX = 2600;                    // pot fully turned = this many watts

bool streaming = false;
unsigned long lastSend = 0;
unsigned long lastBlink = 0;
bool redOn = false;

void setAlarm(bool on) {  // red LED + buzzer together
  redOn = on;
  digitalWrite(LED_RED, on ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
}

void normalState() {  // green on, alarm off
  redOn = false;
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_GREEN, HIGH);
}

void allOff() {
  redOn = false;
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

void setup() {
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);  // pressed = LOW (no resistor needed)
  allOff();
  Serial.begin(9600);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    normalState();  // start in the normal (green) state
  } else if (cmd == "STOP" || cmd == "OFF") {
    streaming = false;
    allOff();
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

  // Alert: pulse the red LED + buzzer together. Normal: steady green.
  if (alert) {
    digitalWrite(LED_GREEN, LOW);
    if (millis() - lastBlink >= BLINK_INTERVAL_MS) {
      lastBlink = millis();
      setAlarm(!redOn);
    }
  } else {
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
