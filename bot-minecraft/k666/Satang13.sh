#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

PIPE="/tmp/mcc_pipe_satang_cmd"
CONSOLE_LOG="$(pwd)/satang_console.log"

rm -f "$PIPE"
mkfifo "$PIPE"
exec 3<>"$PIPE"

cleanup() {
  echo "🛑 ปิดโปรเซส Satang13..." >&2
  exec 3>&-
  pkill -9 -f "MinecraftClient.*Satang13" 2>/dev/null
  rm -f "$PIPE"
  exit 0
}

trap cleanup SIGTERM SIGINT EXIT

# รัน MCC และบังคับ Flush เขียนลงไฟล์ทันทีทุกบรรทัด
stdbuf -oL -eL ./MinecraftClient Satang13 - play.amorycraft.com < "$PIPE" > "$CONSOLE_LOG" 2>&1 &

# ==========================================
# 🔑 ล็อกอิน & เดินทางเข้า Survival
# ==========================================
sleep 10
echo "/dialog input pass 112233" >&3
sleep 3
echo "/dialog click 1" >&3

sleep 10
echo "/useitem mainhand" >&3
sleep 2
echo "/inventory container click 10 Left" >&3

# Keep-alive loop
while true; do
  sleep 25
  echo "" >&3
done