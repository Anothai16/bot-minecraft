#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

PM2_NAME="Kaitom_4lever"
STATUS_FILE="$(pwd)/lever_status.txt"
READY_FILE="$(pwd)/kaitom4_ready.txt"
LOG_FILE="$(pwd)/server_restart_kaitom4_logs.txt"
PIPE="/tmp/mcc_pipe_kaitom_cmd"

# เริ่มต้นให้สถานะเป็น offline ทันที (ยังไม่ถึงจุดยืน)
echo "offline" > "$READY_FILE"

rm -f "$PIPE"
mkfifo "$PIPE"

if [ ! -f "$STATUS_FILE" ]; then
  echo "open" > "$STATUS_FILE"
fi

cleanup() {
  echo "🛑 [STOP] ปิดโปรเซส..." >&2
  echo "offline" > "$READY_FILE"
  if [ -n "$MCC_PID" ]; then
    kill -9 "$MCC_PID" 2>/dev/null
  fi
  pkill -9 -f "MinecraftClient.*Kaitom_4" 2>/dev/null
  rm -f "$PIPE"
  exit 0
}

trap cleanup SIGTERM SIGINT EXIT

trigger_restart() {
  echo "offline" > "$READY_FILE"
  rm -f "$PIPE"
  if [ -n "$MCC_PID" ]; then
    kill -9 "$MCC_PID" 2>/dev/null
  fi
  echo "🚨 [FAIL-SAFE] หลุดการเชื่อมต่อ! สั่ง PM2 Restart '$PM2_NAME' ทันที..." >&2
  pm2 restart "$PM2_NAME" --update-env
  exit 1
}

# ==========================================
# 👂 1. Background Reader: ดักฟังแชท + รัน MCC
# ==========================================
tail -f "$PIPE" | ./MinecraftClient Kaitom_4 - play.amorycraft.com 2>&1 | while IFS= read -r line; do
  echo "$line"

  if [[ "$line" == *"Not connected to any server"* ]] || [[ "$line" == *"Failed to login to this server"* ]]; then
    trigger_restart
  fi

  if ! echo "$line" | grep -qE "^<.*>|^\[.*\] [a-zA-Z0-9_]+:"; then
    if { echo "$line" | grep -q "รี" && echo "$line" | grep -q "สตาร์ท"; } || \
       echo "$line" | grep -q "ประจำวัน" || \
       echo "$line" | grep -iq "restart"; then

      FULL_TIME=$(date '+%Y-%m-%d %H:%M:%S')
      NOW=$(date '+%H:%M:%S')

      echo "[$FULL_TIME] $line" >> "$LOG_FILE"
      CURRENT_STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')
      
      echo "==================================================" >&2
      echo "🚨 [ALERT $NOW] Kaitom_4 ตรวจพบประกาศรีเซิร์ฟ!" >&2
      
      if [ "$CURRENT_STATUS" = "open" ]; then
        echo "🛑 สั่งสับคันโยก (ปิดระบบ) ก่อนเซิร์ฟดับ..." >&2
        echo "/useblock -2682 61 14542" > "$PIPE"
        echo "close" > "$STATUS_FILE"
      fi
      echo "==================================================" >&2
    fi
  fi
done &

MCC_PID=$!

# ==========================================
# 🔑 2. ขั้นตอนล็อกอิน & เดินทาง
# ==========================================
echo "[LOGIN] กำลังรอเซิร์ฟเวอร์เชื่อมต่อและโหลดหน้า Dialog (16 วินาที)..." >&2
sleep 16

echo "/dialog input pass 112233" > "$PIPE"
sleep 3
echo "/dialog click 1" > "$PIPE"
echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2

echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn (12 วินาที)..." >&2
sleep 12
echo "/useitem mainhand" > "$PIPE"

sleep 3
echo "/inventory container click 10 Left" > "$PIPE"
echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2

sleep 10
echo "/home home" > "$PIPE"
sleep 2

# ✅ ถึงจุดนี้แปลว่าผ่านขั้นตอนเลือกโหมดและวาร์ปมายืนประจำจุดสำเร็จแล้ว
echo "online" > "$READY_FILE"
echo "[READY] บอทประจำการที่จุด (-2682 61 14543) และสถานะเป็น ONLINE เรียบร้อย!" >&2

# ==========================================
# ⏰ 3. ลูปตรวจเช็กเวลาสับปิดอัตโนมัติ (05:40 น.)
# ==========================================
TRIGGERED_0540=false

while true; do
  if ! kill -0 $MCC_PID 2>/dev/null; then
    echo "offline" > "$READY_FILE"
    break
  fi

  HOUR=$(date +%-H)
  MIN=$(date +%-M)

  if [ "$HOUR" -eq 0 ] && [ "$MIN" -eq 0 ]; then
    TRIGGERED_0540=false
  fi

  if [ "$HOUR" -eq 5 ] && [ "$MIN" -eq 40 ] && [ "$TRIGGERED_0540" = false ]; then
    NOW_TIME=$(date '+%H:%M:%S')
    CURRENT_STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')

    echo "🛑 [AUTO-CLOSE $NOW_TIME] ถึงเวลา 05:40 น. ทำการตรวจเช็กเพื่อปิดระบบ..." >&2
    
    if [ "$CURRENT_STATUS" = "open" ]; then
      echo "🛑 สถานะเป็น 'open' -> สั่งสับคันโยก (ปิดระบบ) ทันที!" >&2
      echo "/useblock -2682 61 14542" > "$PIPE"
    else
      echo "ℹ️ สถานะเป็น '$CURRENT_STATUS' อยู่แล้ว ข้ามการสับคันโยก" >&2
    fi

    echo "close" > "$STATUS_FILE"
    TRIGGERED_0540=true
  fi

  sleep 5
done

cleanup