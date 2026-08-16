#!/bin/bash
cd "$(dirname "$0")"

(
  # ==========================================
  # 🔑 1. ขั้นตอนล็อกอิน & วาร์ปเข้าจุดคันโยก
  # ==========================================
  sleep 10
  echo "/dialog input pass 112233"
  
  sleep 3
  echo "/dialog click 1"
  
  sleep 10
  echo "/useitem mainhand"
  
  sleep 1
  echo "/inventory container click 10 Left"
  
  sleep 8
  echo "/home home"

  # ==========================================
  # ⏰ 2. ลูปตรวจสอบเวลาเครื่องจริง (Cron Loop)
  # ทำงานทุกนาทีที่ 3, 9, 15, 21, 27, 33, 39, 45, 51, 57
  # ==========================================
  while true; do
    HOUR=$(date +%-H)
    MIN=$(date +%-M)
    SEC=$(date +%-S)

    # ⏸️ ช่วงพักระบบ (05:35 - 07:00 น.)
    if { [ "$HOUR" -eq 5 ] && [ "$MIN" -ge 35 ]; } || [ "$HOUR" -eq 6 ]; then
      sleep 5
      continue
    fi

    # 🎯 เช็คว่าตรงนาทีเป้าหมาย (ลงท้ายด้วยเศษ 3) และวินาทีที่ 0 หรือไม่
    if [ $(( MIN % 6 )) -eq 3 ] && [ "$SEC" -eq 0 ]; then
      # สับปิด (OFF)
      echo "/useblock 10383 64 -5065"
      sleep 5
      
      # สับเปิด (ON)
      echo "/useblock 10383 64 -5065"
      sleep 2
    fi

    sleep 0.5
  done
) | ./MinecraftClient Lervy_Lever - play.amorycraft.com