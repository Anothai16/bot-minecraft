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

# รัน MCC และส่ง output ออกทั้งหน้าจอและบันทึกลง satang_console.log
./MinecraftClient Satang13 - play.amorycraft.com < "$PIPE" 2>&1 | tee -a "$CONSOLE_LOG" &

# ==========================================
# 🔑 ล็อกอิน & เดินทางเข้า Survival
# ==========================================
echo "[LOGIN] กำลังรอหน้า Dialog โหลด..." >&2
sleep 10
echo "/dialog input pass 112233" >&3
sleep 3
echo "/dialog click 1" >&3
echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2

echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn..." >&2
sleep 10
echo "/useitem mainhand" >&3
sleep 2
echo "/inventory container click 10 Left" >&3
echo "[LOBBY] เลือก Survival เรียบร้อย..." >&2

# Keep-alive loop ป้องกันหลุด
while true; do
  sleep 25
  echo "" >&3
done