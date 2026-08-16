#!/bin/bash
cd "$(dirname "$0")"

chmod +x ./MinecraftClient

(
  # ==========================================
  # 🔑 1. ขั้นตอนล็อกอิน Dialog
  # ==========================================
  echo "[SYSTEM] รอโหลดหน้าต่าง Dialog 8 วินาที..." >&2
  sleep 8
  
  echo "[LOGIN] กรอกรหัสผ่าน..." >&2
  echo "dialog input 1 pass 112233"
  sleep 2
  
  echo "[LOGIN] กดยืนยันปุ่ม 1..." >&2
  echo "dialog submit 1 1"
  sleep 1
  echo "dialog click 1"
  
  # ==========================================
  # 🧭 2. ขั้นตอนเลือกห้อง Survival ผ่านเข็มทิศ
  # ==========================================
  echo "[LOGIN] รอย้ายเข้า Lobby 8 วินาที..." >&2
  sleep 8
  
  echo "[LOBBY] คลิกขวาใช้งานเข็มทิศในมือ..." >&2
  echo "useitem"
  sleep 2
  
  echo "[LOBBY] กดเลือกห้อง Survival (Slot 10)..." >&2
  echo "inventory 1 click 10"
  
  # ==========================================
  # 🏠 3. วาร์ปกลับหน้าคันโยก
  # ==========================================
  echo "[WARP] รอสลับเซิร์ฟเวอร์ 10 วินาที..." >&2
  sleep 10
  echo "/home home"
  echo "[READY] Lervy_Lever ประจำการที่จุดคันโยกเรียบร้อย!" >&2

  # ==========================================
  # ⏰ 4. ลูปตรวจสอบเวลาเครื่องจริง (Cron Loop)
  # นาทีที่ 3, 9, 15, 21, 27, 33, 39, 45, 51, 57
  # ==========================================
  LAST_TRIGGER_MIN=-1

  while true; do
    HOUR=$(date +%-H)
    MIN=$(date +%-M)

    # ⏸️ ช่วงพักระบบ (05:35 - 07:00 น.)
    if { [ "$HOUR" -eq 5 ] && [ "$MIN" -ge 35 ]; } || [ "$HOUR" -eq 6 ]; then
      sleep 5
      continue
    fi

    # 🎯 เช็คว่าตรงรอบนาทีเป้าหมาย (MIN % 6 == 3)
    if [ $(( MIN % 6 )) -eq 3 ] && [ "$MIN" -ne "$LAST_TRIGGER_MIN" ]; then
      LAST_TRIGGER_MIN=$MIN
      NOW_TIME=$(date '+%H:%M:%S')

      echo "==================================================" >&2
      echo "⏰ [CRON $NOW_TIME] ถึงรอบทำงาน! สั่งสับปิดคันโยก (OFF)..." >&2
      echo "useblock 10383 64 -5065"
      
      echo "⏱️ [CRON $NOW_TIME] รอ 5 วินาที..." >&2
      sleep 5
      
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🟢 [CRON $NOW_TIME] จบเวลาทำงาน: สั่งสับเปิดระบบ (ON)..." >&2
      echo "useblock 10383 64 -5065"
      echo "✅ [CRON $NOW_TIME] ไซเคิลรอบนี้เสร็จสมบูรณ์!" >&2
      echo "==================================================" >&2
    fi

    sleep 1
  done
) | ./MinecraftClient Lervy_Lever - play.amorycraft.com