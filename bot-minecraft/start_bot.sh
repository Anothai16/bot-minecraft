#!/bin/bash
cd "$(dirname "$0")"

# ให้สิทธิ์ execute แน่นอน
chmod +x ./MinecraftClient

(
  # ==========================================
  # 🔑 1. ขั้นตอนล็อกอิน & วาร์ปเข้าจุดคันโยก
  # ==========================================
  echo "[SYSTEM] รอเซิร์ฟเวอร์ส่งหน้าต่างล็อกอิน 8 วินาที..." >&2
  sleep 8
  
  echo "[LOGIN] ส่งรหัสผ่านเข้า Dialog #1..." >&2
  echo "/dialog input 1 pass 112233"
  sleep 2
  
  echo "[LOGIN] กดยืนยันปุ่ม [1] เข้าสู่ระบบ..." >&2
  echo "/dialog submit 1 1"
  sleep 2
  echo "/dialog click 1"
  
  echo "[LOGIN] รอย้ายเข้า Lobby 8 วินาที..." >&2
  sleep 8
  
  echo "[LOBBY] กดใช้งานเข็มทิศ..." >&2
  echo "/useitem mainhand"
  sleep 2
  
  echo "[LOBBY] เลือกห้อง Survival (Slot 10)..." >&2
  echo "/inventory 1 click 10"
  echo "/inventory container click 10 Left"
  
  echo "[WARP] รอโหลดเข้าโลก 8 วินาที แล้ววาร์ปกลับบ้าน..." >&2
  sleep 8
  echo "/home home"
  echo "[READY] Lervy_Lever พร้อมทำงานที่จุดคันโยกเรียบร้อย!" >&2

  # ==========================================
  # ⏰ 2. ลูปตรวจสอบเวลาเครื่องจริง (Cron Loop)
  # นาทีที่ 3, 9, 15, 21, 27, 33, 39, 45, 51, 57
  # ==========================================
  LAST_TRIGGER_MIN=-1

  while true; do
    HOUR=$(date +%-H)
    MIN=$(date +%-M)
    SEC=$(date +%-S)

    # ⏸️ ช่วงพักระบบ (05:35 - 07:00 น.)
    if { [ "$HOUR" -eq 5 ] && [ "$MIN" -ge 35 ]; } || [ "$HOUR" -eq 6 ]; then
      sleep 5
      continue
    fi

    # 🎯 เช็คว่าตรงรอบนาทีเป้าหมาย (MIN % 6 == 3) และยังไม่เคยทำงานในนาทีนี้
    if [ $(( MIN % 6 )) -eq 3 ] && [ "$MIN" -ne "$LAST_TRIGGER_MIN" ]; then
      LAST_TRIGGER_MIN=$MIN
      NOW_TIME=$(date '+%H:%M:%S')

      echo "==================================================" >&2
      echo "⏰ [CRON $NOW_TIME] ถึงรอบทำงาน! สั่งสับปิดคันโยก (OFF)..." >&2
      echo "/useblock 10383 64 -5065"
      
      echo "⏱️ [CRON $NOW_TIME] รอ 5 วินาที..." >&2
      sleep 5
      
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🟢 [CRON $NOW_TIME] จบเวลาทำงาน: สั่งสับเปิดระบบ (ON)..." >&2
      echo "/useblock 10383 64 -5065"
      echo "✅ [CRON $NOW_TIME] ไซเคิลรอบนี้เสร็จสมบูรณ์!" >&2
      echo "==================================================" >&2
    fi

    sleep 1
  done
) | ./MinecraftClient Lervy_Lever - play.amorycraft.com