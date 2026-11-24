#!/bin/bash
# Supervised server loop for the Night Shift Sprite.
# Mastra restarts interrupted *runs* on boot (recovery.workflows: auto);
# this loop restarts the *process* if it dies — Mastra cannot.
set -u
cd /home/sprite/app
set -a; . /home/sprite/app/sentinel-runtime.env; set +a
while true; do
  bun /home/sprite/app/.mastra/output/index.mjs
  code=$?
  echo "[sentinel-watchdog] server exited (code $code) — restarting in 2s" >&2
  sleep 2
done
