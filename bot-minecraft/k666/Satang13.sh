#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

PIPE="/tmp/mcc_pipe_satang_cmd"
LOG_FILE="$(pwd)/satang_logs.txt"
BAL_FILE="$(pwd)/balance.txt"

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

# รัน MCC และดักจับบรรทัดที่เกี่ยวกับ Economy
./MinecraftClient Satang13 - play.amorycraft.com < "$PIPE" 2>&1 | while IFS= read -r line; do
  echo "$line"
  
  # ดักจับบันทึกประวัติการโอน
  if echo "$line" | grep -qi "โอนเงิน"; then
    echo "$line" >> "$LOG_FILE"
  fi

  # ดักจับยอดเงินจากคำสั่ง /money
  if echo "$line" | grep -qi "economy"; then
    echo "$line" > "$BAL_FILE"
  fi
done &

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