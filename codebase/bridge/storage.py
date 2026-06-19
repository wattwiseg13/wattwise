import csv
import json
import os

FIELDS = ["device_id", "ts_iso", "uptime_ms", "volts", "watts", "state"]


class Storage:
    def __init__(self, data_dir):
        os.makedirs(data_dir, exist_ok=True)
        self.jsonl_path = os.path.join(data_dir, "readings.jsonl")
        self.csv_path = os.path.join(data_dir, "readings.csv")
        self.count = 0
        if not os.path.exists(self.csv_path):
            with open(self.csv_path, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(FIELDS)

    def write(self, record):
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([record[k] for k in FIELDS])
        self.count += 1
