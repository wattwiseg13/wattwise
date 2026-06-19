FROM python:3.12-slim

# Build context is ./bridge. The package is imported as `bridge.*`, so it lives
# at /app/bridge and we run from /app to keep `import bridge` working.
WORKDIR /app

COPY requirements.txt /app/bridge/requirements.txt
RUN pip install --no-cache-dir -r /app/bridge/requirements.txt

COPY . /app/bridge/

# Cloud default: hardware-free simulator feeding the backend relay.
# Override the command to run `python -m bridge.main` for real serial hardware.
CMD ["python", "-m", "bridge.simulate"]
