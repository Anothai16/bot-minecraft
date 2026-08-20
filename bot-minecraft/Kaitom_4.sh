#!/bin/bash
cd "$(dirname "$0")"

chmod +x ./MinecraftClient

# ตั้งชื่อ Process ใน PM2 ให้ตรงกัน
PM2_NAME="Kaitom_4lever"

# ==========================================
# 🛑 ฟังก์ชันสั่ง PM2 Restart
# ==========================================
trigger_restart() {
  echo "🚨 [FAIL-SAFE] ตรวจพบการตัดการเชื่อมต่อ! สั่ง PM2 Restart '$PM2_NAME' ทันที..." >&2
  pm2 restart "$PM2_NAME" --update-env
  exit 1
}

# ==========================================
# 🚀 รัน MCC และส่งคำสั่งเข้า + ดักจับ Log ออกมาเช็ก
# ==========================================
(
  # --- ขั้นตอนล็อกอินปกติ ---
  echo "[LOGIN] กำลังรอหน้า Dialog โหลด..." >&2
  sleep 10
  echo "/dialog input pass 112233"
  
  sleep 3
  echo "/dialog click 1"
  echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2
  
  echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn..." >&2
  sleep 10
  echo "/useitem mainhand"
  
  sleep 1
  echo "/inventory container click 10 Left"
  echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2
  
  sleep 8
  echo "/home home"
  echo "[READY] บอทประจำการเรียบร้อย!" >&2

  # --- ลูปเช็กเวลาสับคันโยก ---
  TRIGGERED_0550=false
  TRIGGERED_0730=false

  while true; do
    HOUR=$(date +%-H)
    MIN=$(date +%-M)

    if [ "$HOUR" -eq 0 ] && [ "$MIN" -eq 0 ]; then
      TRIGGERED_0550=false
      TRIGGERED_0730=false
    fi

    # 05:50 น. สับปิดระบบ
    if [ "$HOUR" -eq 5 ] && [ "$MIN" -eq 50 ] && [ "$TRIGGERED_0550" = false ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🛑 [LEVER $NOW_TIME] ถึงเวลา 05:50 น. สั่งสับคันโยก (ปิดระบบ)..." >&2
      echo "/useblock 10383 64.00 -5064.51"
      TRIGGERED_0550=true
    fi

    # 07:10 น. สั่งรีสตาร์ตตามรอบ
    if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 10 ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🔄 [RESTART $NOW_TIME] ถึงเวลา 07:10 น. สั่ง PM2 Restart..." >&2
      pm2 restart "$PM2_NAME"
      exit 0
    fi

    # 07:30 น. สับเปิดระบบ
    if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 30 ] && [ "$TRIGGERED_0730" = false ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🟢 [LEVER $NOW_TIME] ถึงเวลา 07:30 น. สั่งสับคันโยก (เปิดระบบ)..." >&2
      echo "/useblock 10383 64.00 -5064.51"
      TRIGGERED_0730=true
    fi

    echo ""
    sleep 5
  done
) | ./MinecraftClient Kaitom_4 - play.amorycraft.com 2>&1 | while IFS= read -r line; do
  # แสดงผล log ออกมาปกติ
  echo "$line"

  # 🔍 ดักจับข้อความ Error หากเซิร์ฟเวอร์หลุด / เข้าไม่ได้
  if [[ "$line" == *"Not connected to any server"* ]] || [[ "$line" == *"Failed to login to this server"* ]]; then
    trigger_restart
  fi
done