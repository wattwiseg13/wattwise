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

const unsigned long SEND_INTERVAL_MS = 1000;   // one reading per second
 const int WATTS_THRESHOLD = 1500;             // must match Python's threshold
const int WATTS_MAX = 2600;                    // pot fully turned = this many watts

bool streaming = false;
bool muted = false;       // user acknowledged the alarm; silence the buzzer (LED stays)
unsigned long lastSend = 0;
unsigned long lastBlink = 0;
bool redOn = false;

// --- Potentiometer smoothing + auto-calibration ---
// Raw analogRead is noisy: single-sample SPIKES (0 -> 2576 -> 0) make the
// dashboard and the alarm jump around. We (1) take the MEDIAN of many samples
// per read, which throws spikes out entirely, (2) run an exponential moving
// average so the value glides, and (3) scale against the pot's OBSERVED range
// so a full turn always reaches WATTS_MAX no matter how the pot is wired.
const int POT_SAMPLES = 15;      // odd count; median of these rejects spikes
const float POT_ALPHA = 0.25;    // EMA smoothing: lower = smoother (more lag)
float potEMA = -1.0;             // -1 = not yet initialised

int potRawMin = 1023;
int potRawMax = 0;
const int POT_MIN_SPAN = 40;     // need at least this much sweep before scaling

// Alert with hysteresis so it doesn't chatter on/off at the threshold. It turns
// ON at WATTS_THRESHOLD and only back OFF once usage drops a clear margin below.
bool alertState = false;
const int ALERT_OFF_WATTS = WATTS_THRESHOLD - 200;  // ON at 1500, OFF below 1300

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
  Serial.begin(9600);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    muted = false;
    // Reset smoothing + calibration so every run starts clean at 0 W and never
    // beeps the instant the script connects. Sweep the knob once to recalibrate.
    potEMA = -1.0;
    potRawMin = 1023;
    potRawMax = 0;
    alertState = false;
    normalState();  // start in the normal (green) state
  } else if (cmd == "STOP" || cmd == "OFF") {
    streaming = false;
    muted = false;
    allOff();
  } else if (cmd == "MUTE") {
    muted = true;   // silence the buzzer until usage drops back to normal
  }
}

// Power draw = smoothed potentiometer position, scaled to the pot's OBSERVED
// range. Turn the knob fully min->max once to calibrate. Until enough range is
// seen we report 0 W.
int readWatts() {
  // 1. MEDIAN of several samples — a single spike sample is discarded outright,
  //    unlike an average which a spike still drags upward.
  int s[POT_SAMPLES];
  for (int i = 0; i < POT_SAMPLES; i++) {
    s[i] = analogRead(POT_PIN);
    delayMicroseconds(150);  // small gap so samples aren't all in one noisy burst
  }
  for (int i = 1; i < POT_SAMPLES; i++) {  // insertion sort (POT_SAMPLES is small)
    int key = s[i], j = i - 1;
    while (j >= 0 && s[j] > key) { s[j + 1] = s[j]; j--; }
    s[j + 1] = key;
  }
  int raw = s[POT_SAMPLES / 2];

  // 2. Exponential moving average so the value glides as the knob turns.
  if (potEMA < 0) potEMA = raw;
  potEMA += POT_ALPHA * (raw - potEMA);
  int smooth = (int)(potEMA + 0.5);

  // 3. Learn the real range from the SMOOTHED signal (a noise spike can't
  //    corrupt the calibration and throw the whole scale off).
  if (smooth < potRawMin) potRawMin = smooth;
  if (smooth > potRawMax) potRawMax = smooth;

  if (potRawMax - potRawMin < POT_MIN_SPAN) return 0;

  long watts = map(smooth, potRawMin, potRawMax, 0, WATTS_MAX);
  return (int)constrain(watts, 0, WATTS_MAX);
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

  // Hysteresis: flip to alert at the threshold, only clear it once usage has
  // dropped a clear margin below. Stops the alarm chattering near the line.
  if (!alertState && watts >= WATTS_THRESHOLD) alertState = true;
  else if (alertState && watts <= ALERT_OFF_WATTS) alertState = false;
  bool alert = alertState;

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
    int volts = 230;  // steady mains voltage (the pot drives watts, not volts)
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
