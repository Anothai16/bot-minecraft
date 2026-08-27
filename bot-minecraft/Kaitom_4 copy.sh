#!/bin/bash
cd "$(dirname "$0")"

chmod +x ./MinecraftClient

PM2_NAME="Kaitom_4lever"
STATUS_FILE="$(pwd)/lever_status.txt"

# 📄 ตรวจสอบและสร้างไฟล์ lever_status.txt อัตโนมัติถ้ายังไม่มีในระบบ Linux
if [ ! -f "$STATUS_FILE" ]; then
  echo "open" > "$STATUS_FILE"
fi

trigger_restart() {
  echo "🚨 [FAIL-SAFE] ตรวจพบการตัดการเชื่อมต่อ! สั่ง PM2 Restart '$PM2_NAME' ทันที..." >&2
  pm2 restart "$PM2_NAME" --update-env
  exit 1
}

(
  # ==========================================
  # 🔑 1. ขั้นตอนล็อกอิน
  # ==========================================
  echo "[LOGIN] กำลังรอหน้า Dialog โหลด..." >&2
  sleep 10
  echo "/dialog input pass 112233"
  
  sleep 3
  echo "/dialog click 1"
  echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2
  
  # ==========================================
  # 🧭 2. กดใช้เข็มทิศ
  # ==========================================
  echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn..." >&2
  sleep 10
  echo "/useitem mainhand"
  
  # ==========================================
  # 📦 3. จิ้มเลือก Survival
  # ==========================================
  sleep 1
  echo "/inventory container click 10 Left"
  echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2
  
  # ==========================================
  # 🏠 4. วาร์ปมาหน้าคันโยก
  # ==========================================
  sleep 8
  echo "/home home"
  echo "[READY] บอทประจำการที่จุด (-2682 61 14543) เรียบร้อย!" >&2

  # ==========================================
  # 🔍 5. ตรวจสอบสถานะตกค้างทันทีที่เข้าเซิร์ฟเวอร์
  # ==========================================
  sleep 2
  CURRENT_HOUR=$(date +%-H)
  CURRENT_MIN=$(date +%-M)
  TOTAL_MINS=$(( CURRENT_HOUR * 60 + CURRENT_MIN ))
  CURRENT_STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')

  # 07:30 น. = 450 นาที | 05:50 น. = 350 นาที
  # ถ้าเวลาปัจจุบันเลย 07:30 น. (หรือยังไม่ถึง 05:50 น.) แต่ไฟล์ยังค้างเป็น close
  if { [ "$TOTAL_MINS" -ge 450 ] || [ "$TOTAL_MINS" -lt 350 ]; } && [ "$CURRENT_STATUS" = "close" ]; then
    NOW_TIME=$(date '+%H:%M:%S')
    echo "⚠️ [CATCH-UP $NOW_TIME] บอทเข้าเซิร์ฟหลัง 07:30 น. และพบสถานะยังเป็น 'close' -> สั่งสับเปิดระบบทันที!" >&2
    echo "/useblock -2682 61 14542"
    echo "open" > "$STATUS_FILE"
  fi

  # ==========================================
  # ⏰ 6. ลูปตรวจเช็กเวลาประจำวัน
  # ==========================================
  TRIGGERED_0550=false
  TRIGGERED_0730=false

  while true; do
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
      echo "/useblock -2682 61 14542"
      echo "close" > "$STATUS_FILE"
      TRIGGERED_0550=true
    fi

    # 🔄 07:10 น. -> รีสตาร์ตเตรียมพร้อม
    if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 10 ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🔄 [RESTART $NOW_TIME] ถึงเวลา 07:10 น. สั่ง PM2 Restart..." >&2
      pm2 restart "$PM2_NAME"
      exit 0
    fi

    # 🟢 07:30 น. -> สับเปิดระบบ + บันทึก 'open'
    if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 30 ] && [ "$TRIGGERED_0730" = false ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🟢 [LEVER $NOW_TIME] ถึงเวลา 07:30 น. สั่งสับคันโยก (เปิดระบบ)..." >&2
      echo "/useblock -2682 61 14542"
      echo "open" > "$STATUS_FILE"
      TRIGGERED_0730=true
    fi

    echo ""
    sleep 5
  done
) | ./MinecraftClient Kaitom_4 - play.amorycraft.com 2>&1 | while IFS= read -r line; do
  echo "$line"

  if [[ "$line" == *"Not connected to any server"* ]] || [[ "$line" == *"Failed to login to this server"* ]]; then
    trigger_restart
  fi
done