#!/bin/bash
cd "$(dirname "$0")"

chmod +x ./MinecraftClient

PM2_NAME="Kaitom_4lever"
STATUS_FILE="$(pwd)/lever_status.txt"
LOG_FILE="$(pwd)/server_restart_kaitom4_logs.txt"
PIPE="/tmp/mcc_pipe_kaitom_$$"
LOCK_FILE="/tmp/mcc_kaitom_paused_$$"

rm -f "$PIPE" "$LOCK_FILE"
mkfifo "$PIPE"

# 📄 ตรวจสอบและสร้างไฟล์ lever_status.txt อัตโนมัติถ้ายังไม่มีในระบบ
if [ ! -f "$STATUS_FILE" ]; then
  echo "open" > "$STATUS_FILE"
fi

trigger_restart() {
  rm -f "$LOCK_FILE" "$PIPE"
  echo "🚨 [FAIL-SAFE] ตรวจพบการตัดการเชื่อมต่อ! สั่ง PM2 Restart '$PM2_NAME' ทันที..." >&2
  pm2 restart "$PM2_NAME" --update-env
  exit 1
}

# ==========================================
# 👂 1. Background Reader: ดักฟังแชท + สับปิดทันทีที่พบประกาศ
# ==========================================
./MinecraftClient Kaitom_4 - play.amorycraft.com < "$PIPE" 2>&1 | while IFS= read -r line; do
  echo "$line"

  # 🔍 ตรวจจับการหลุดการเชื่อมต่อ
  if [[ "$line" == *"Not connected to any server"* ]] || [[ "$line" == *"Failed to login to this server"* ]]; then
    trigger_restart
  fi

  # 🔍 ตรวจจับแชทรีเซิร์ฟเวอร์ (กรองไม่เอาแชทผู้เล่น)
  if ! echo "$line" | grep -qE "^<.*>|^\[.*\] [a-zA-Z0-9_]+:"; then
    if { echo "$line" | grep -q "รี" && echo "$line" | grep -q "สตาร์ท"; } || \
       echo "$line" | grep -q "ประจำวัน" || \
       echo "$line" | grep -iq "restart"; then

      FULL_TIME=$(date '+%Y-%m-%d %H:%M:%S')
      NOW=$(date '+%H:%M:%S')

      # 📝 บันทึกลงไฟล์ Log
      echo "[$FULL_TIME] $line" >> "$LOG_FILE"

      CURRENT_STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')
      
      echo "==================================================" >&2
      echo "🚨 [ALERT $NOW] Kaitom_4 ตรวจพบประกาศรีสตาร์ตเซิร์ฟเวอร์!" >&2
      echo "📝 บันทึกประโยคลง: $LOG_FILE" >&2
      
      # 🛑 ถ้าสถานะเดิมเป็น open ให้สับปิดทันทีก่อนเซิร์ฟดับ + เซฟสถานะ 'close'
      if [ "$CURRENT_STATUS" = "open" ]; then
        echo "🛑 สั่งสับคันโยก (ปิดระบบ) ทันที!" >&2
        echo "/useblock -2682 61 14542" >&3
        echo "close" > "$STATUS_FILE"
      fi
      
      echo "🛑 สั่งระงับการทำงานชั่วคราวและรอเซิร์ฟเวอร์ตัด..." >&2
      echo "==================================================" >&2

      touch "$LOCK_FILE"
    fi
  fi
done &

MCC_PID=$!
exec 3>"$PIPE"

# ==========================================
# 🔑 2. ขั้นตอนล็อกอิน & เดินทาง
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

sleep 1
echo "/inventory container click 10 Left" >&3
echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2

sleep 8
echo "/home home" >&3
echo "[READY] บอทประจำการที่จุด (-2682 61 14543) เรียบร้อย!" >&2

# ==========================================
# 🔍 3. ตรวจสอบสถานะทันทีหลังเข้าเซิร์ฟ (ถ้าค้าง close ให้สับเปิดทันที)
# ==========================================
sleep 2
CURRENT_STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')

# ถ้าพบว่าสถานะในไฟล์เป็น 'close' ไม่ว่าจะเวลาไหน ให้สับเปิดระบบทันที
if [ "$CURRENT_STATUS" = "close" ]; then
  NOW_TIME=$(date '+%H:%M:%S')
  echo "⚠️ [CATCH-UP $NOW_TIME] ตรวจพบระบบอยู่ในสถานะ 'close' -> สั่งสับเปิดระบบ (ON) ทันที!" >&2
  echo "/useblock -2682 61 14542" >&3
  echo "open" > "$STATUS_FILE"
fi

# ==========================================
# ⏰ 4. ลูปตรวจเช็กเวลาประจำวัน
# ==========================================
TRIGGERED_0550=false
TRIGGERED_0730=false

while true; do
  if ! kill -0 $MCC_PID 2>/dev/null; then
    break
  fi

  if [ -f "$LOCK_FILE" ]; then
    sleep 2
    continue
  fi

  HOUR=$(date +%-H)
  MIN=$(date +%-M)

  # รีเซ็ต Flag เที่ยงคืน
  if [ "$HOUR" -eq 0 ] && [ "$MIN" -eq 0 ]; then
    TRIGGERED_0550=false
    TRIGGERED_0730=false
  fi

  # 🔴 05:50 น. -> สับปิดระบบ + บันทึก 'close'
  if [ "$HOUR" -eq 5 ] && [ "$MIN" -eq 50 ] && [ "$TRIGGERED_0550" = false ]; then
    NOW_TIME=$(date '+%H:%M:%S')
    echo "🛑 [LEVER $NOW_TIME] ถึงเวลา 05:50 น. สั่งสับคันโยก (ปิดระบบ)..." >&2
    echo "/useblock -2682 61 14542" >&3
    echo "close" > "$STATUS_FILE"
    TRIGGERED_0550=true
  fi

  # 🔄 07:10 น. -> รีสตาร์ตเตรียมพร้อม
  if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 10 ]; then
    NOW_TIME=$(date '+%H:%M:%S')
    echo "🔄 [RESTART $NOW_TIME] ถึงเวลา 07:10 น. สั่ง PM2 Restart..." >&2
    rm -f "$LOCK_FILE" "$PIPE"
    pm2 restart "$PM2_NAME"
    exit 0
  fi

  # 🟢 07:30 น. -> สับเปิดระบบ + บันทึก 'open'
  if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 30 ] && [ "$TRIGGERED_0730" = false ]; then
    NOW_TIME=$(date '+%H:%M:%S')
    echo "🟢 [LEVER $NOW_TIME] ถึงเวลา 07:30 น. สั่งสับคันโยก (เปิดระบบ)..." >&2
    echo "/useblock -2682 61 14542" >&3
    echo "open" > "$STATUS_FILE"
    TRIGGERED_0730=true
  fi

  sleep 5
done

kill $MCC_PID 2>/dev/null
exec 3>&-
rm -f "$PIPE" "$LOCK_FILE"
exit 1