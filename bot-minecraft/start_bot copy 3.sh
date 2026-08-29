#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

PM2_NAME="mcc-lever"
STATUS_FILE="$(pwd)/lervy_status.txt"
READY_FILE="$(pwd)/lervy_ready.txt"
LOG_FILE="$(pwd)/server_restart_lervy_logs.txt"
PIPE="/tmp/mcc_pipe_lervy_cmd"

echo "offline" > "$READY_FILE"

rm -f "$PIPE"
mkfifo "$PIPE"
exec 3<>"$PIPE"

if [ ! -f "$STATUS_FILE" ]; then
  echo "open" > "$STATUS_FILE"
fi

cleanup() {
  echo "🛑 [STOP] ปิดโปรเซส Lervy_Lever..." >&2
  echo "offline" > "$READY_FILE"
  exec 3>&-
  if [ -n "$MCC_PID" ]; then
    kill -9 "$MCC_PID" 2>/dev/null
  fi
  pkill -9 -f "MinecraftClient.*Lervy_Lever" 2>/dev/null
  rm -f "$PIPE"
  exit 0
}

trap cleanup SIGTERM SIGINT EXIT

trigger_restart() {
  echo "offline" > "$READY_FILE"
  exec 3>&-
  rm -f "$PIPE"
  if [ -n "$MCC_PID" ]; then
    kill -9 "$MCC_PID" 2>/dev/null
  fi
  echo "🚨 [FAIL-SAFE] หลุดการเชื่อมต่อ! สั่ง PM2 Restart '$PM2_NAME' ทันที..." >&2
  pm2 restart "$PM2_NAME" --update-env
  exit 1
}

# ==========================================
# 👂 1. Background Reader: รัน MCC ผ่านท่อ
# ==========================================
./MinecraftClient Lervy_Lever - play.amorycraft.com < "$PIPE" 2>&1 | while IFS= read -r line; do
  echo "$line"

  if [[ "$line" == *"Not connected to any server"* ]] || \
     [[ "$line" == *"Failed to login to this server"* ]] || \
     [[ "$line" == *"Connection lost"* ]] || \
     [[ "$line" == *"Server is full"* ]] || \
     [[ "$line" == *"Kicked by server"* ]]; then
    trigger_restart
  fi

  if ! echo "$line" | grep -qE "^<.*>|^\[.*\] [a-zA-Z0-9_]+:"; then
    if { echo "$line" | grep -q "รี" && echo "$line" | grep -q "สตาร์ท"; } || \
       echo "$line" | grep -q "ประจำวัน" || \
       echo "$line" | grep -iq "restart"; then

      FULL_TIME=$(date '+%Y-%m-%d %H:%M:%S')
      NOW=$(date '+%H:%M:%S')

      echo "[$FULL_TIME] $line" >> "$LOG_FILE"
      echo "==================================================" >&2
      echo "🚨 [ALERT $NOW] Lervy_Lever ตรวจพบประกาศรีเซิร์ฟ!" >&2
      echo "🛑 สั่งระงับลูปการสับคันโยกทันที..." >&2
      echo "close" > "$STATUS_FILE"
      echo "==================================================" >&2
    fi
  fi
done &

MCC_PID=$!

# ==========================================
# 🔑 2. ล็อกอิน & เดินทาง
# ==========================================
echo "[LOGIN] กำลังรอหน้า Dialog โหลด (16 วินาที)..." >&2
sleep 16
echo "/dialog input pass 112233" >&3
sleep 3
echo "/dialog click 1" >&3
echo "[LOGIN] ปลดล็อก Dialog เรียบร้อย" >&2

echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn (12 วินาที)..." >&2
sleep 12
echo "/useitem mainhand" >&3
sleep 3
echo "/inventory container click 10 Left" >&3
echo "[LOBBY] เลือก Survival เรียบร้อย..." >&2

sleep 10
echo "/home home" >&3
sleep 2

# บันทึก timestamp เริ่มต้น
date +%s > "$READY_FILE"
echo "[READY] Lervy_Lever ประจำการที่จุดคันโยกและ ONLINE เรียบร้อย!" >&2

# ==========================================
# ⏰ 3. ลูป Cron สับคันโยก + Heartbeat
# ==========================================
LAST_TRIGGER_MIN=-1
TRIGGERED_0540=false
LAST_HEARTBEAT=0

while true; do
  if ! kill -0 $MCC_PID 2>/dev/null; then
    echo "offline" > "$READY_FILE"
    break
  fi

  NOW_SEC=$(date +%s)

  # 💓 อัปเดต Heartbeat Timestamp ทุก 10 วินาที
  if [ $(( NOW_SEC - LAST_HEARTBEAT )) -ge 10 ]; then
    echo "$NOW_SEC" > "$READY_FILE"
    LAST_HEARTBEAT=$NOW_SEC
  fi

  HOUR=$(date +%-H)
  MIN=$(date +%-M)

  if [ "$HOUR" -eq 0 ] && [ "$MIN" -eq 0 ]; then
    TRIGGERED_0540=false
  fi

  # 🛑 05:40 น. -> สั่งพักระบบ (close)
  if [ "$HOUR" -eq 5 ] && [ "$MIN" -eq 40 ] && [ "$TRIGGERED_0540" = false ]; then
    NOW_TIME=$(date '+%H:%M:%S')
    echo "🛑 [AUTO-PAUSE $NOW_TIME] ถึงเวลา 05:40 น. สั่งหยุดลูปการสับคันโยก..." >&2
    echo "close" > "$STATUS_FILE"
    TRIGGERED_0540=true
  fi

  CURRENT_STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')

  if [ "$CURRENT_STATUS" = "open" ]; then
    if [ $(( MIN % 6 )) -eq 3 ] && [ "$MIN" -ne "$LAST_TRIGGER_MIN" ]; then
      LAST_TRIGGER_MIN=$MIN
      NOW_TIME=$(date '+%H:%M:%S')

      echo "==================================================" >&2
      echo "⏰ [CRON $NOW_TIME] ถึงรอบทำงาน! สั่งสับปิดคันโยก (OFF)..." >&2
      echo "/useblock 10383 64.00 -5064.51" >&3
      
      echo "⏱️ [CRON $NOW_TIME] รอ 5 วินาที..." >&2
      sleep 5
      
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🟢 [CRON $NOW_TIME] จบเวลาทำงาน: สั่งสับเปิดระบบ (ON)..." >&2
      echo "/useblock 10383 64.00 -5064.51" >&3
      echo "✅ [CRON $NOW_TIME] ไซเคิลรอบนี้เสร็จสมบูรณ์!" >&2
      echo "==================================================" >&2
    fi
  fi

  sleep 1
done

cleanup