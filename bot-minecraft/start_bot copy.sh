#!/bin/bash
cd "$(dirname "$0")"

chmod +x ./MinecraftClient

(
  # ==========================================
  # 🔑 1. รอให้หน้า Dialog โหลดขึ้นมาจนสมบูรณ์ แล้วล็อกอิน
  # ==========================================
  echo "[LOGIN] กำลังรอหน้า Dialog โหลด..." >&2
  sleep 10
  echo "/dialog input pass 112233"
  
  sleep 3
  echo "/dialog click 1"
  echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2
  
  # ==========================================
  # 🧭 2. รอปลดล็อกล็อกอิน แล้วสั่งกดใช้เข็มทิศ
  # ==========================================
  echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn..." >&2
  sleep 10
  echo "/useitem mainhand"
  
  # ==========================================
  # 📦 3. จิ้มเลือกสล็อต 10 (Survival)
  # ==========================================
  sleep 1
  echo "/inventory container click 10 Left"
  echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2
  
  # ==========================================
  # 🏠 4. รอโหลดเข้าโลก แล้ววาร์ปมาหน้าคันโยก
  # ==========================================
  sleep 8
  echo "/home home"
  echo "[READY] Lervy_Lever ประจำการที่จุดคันโยกเรียบร้อย!" >&2

  # ==========================================
  # ⏰ 5. ลูปตรวจสอบเวลาเครื่องจริง (Cron Loop)
  # ==========================================
  LAST_TRIGGER_MIN=-1

  while true; do
    HOUR=$(date +%-H)
    MIN=$(date +%-M)

    # 🔄 06:50 น. สั่งปิดตัวลง เพื่อให้ PM2 รีสตาร์ตเริ่มระบบใหม่ตั้งแต่ต้น
    if [ "$HOUR" -eq 6 ] && [ "$MIN" -eq 50 ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🔄 [RESTART $NOW_TIME] ถึงเวลา 06:50 น. สั่งออกจากเซิร์ฟเวอร์เพื่อให้ PM2 รีสตาร์ต..." >&2
      echo "/quit"
      exit 0
    fi

    # ⏸️ ช่วงพักระบบ (05:35 - 07:00 น.)
    if { [ "$HOUR" -eq 5 ] && [ "$MIN" -ge 35 ]; } || [ "$HOUR" -eq 6 ]; then
      sleep 5
      continue
    fi

    # 🎯 เช็คว่าตรงรอบนาทีเป้าหมาย (MIN % 6 == 3) -> 3, 9, 15, 21, 27, 33, 39, 45, 51, 57
    if [ $(( MIN % 6 )) -eq 3 ] && [ "$MIN" -ne "$LAST_TRIGGER_MIN" ]; then
      LAST_TRIGGER_MIN=$MIN
      NOW_TIME=$(date '+%H:%M:%S')

      echo "==================================================" >&2
      echo "⏰ [CRON $NOW_TIME] ถึงรอบทำงาน! สั่งสับปิดคันโยก (OFF)..." >&2
      echo "/useblock 10383 64.00 -5064.51"
      
      echo "⏱️ [CRON $NOW_TIME] รอ 5 วินาที..." >&2
      sleep 5
      
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🟢 [CRON $NOW_TIME] จบเวลาทำงาน: สั่งสับเปิดระบบ (ON)..." >&2
      echo "/useblock 10383 64.00 -5064.51"
      echo "✅ [CRON $NOW_TIME] ไซเคิลรอบนี้เสร็จสมบูรณ์!" >&2
      echo "==================================================" >&2
    fi

    sleep 1
  done
) | ./MinecraftClient Lervy_Lever - play.amorycraft.com