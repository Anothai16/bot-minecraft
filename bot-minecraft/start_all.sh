#!/bin/bash
cd "$(dirname "$0")"

# รายชื่อบอททั้ง 5 ตัว
BOTS=("obs1" "Morgan05" "Domertown" "Nattanon09" "Nanepez")

# ลูปเปิดบอทรันคำสั่งทีละตัว
for BOT in "${BOTS[@]}"; do
    echo "--------------------------------------------------"
    echo "กำลังเปิดบอท: $BOT"
    echo "--------------------------------------------------"
    
    (
      # 1. รอ 10 วินาที ให้หน้า Dialog โหลดขึ้นมาจนสมบูรณ์
      sleep 10
      echo "/dialog input pass 112233"
      
      sleep 3
      echo "/dialog click 1"
      
      # 2. รอ 10 วินาที ให้เซิร์ฟเวอร์ปลดล็อกล็อกอิน
      sleep 10
      echo "/useitem mainhand"
      
      # 3. รอ 1 วินาที สั่งคลิก GUI เลือกสล็อต 10
      sleep 1
      echo "/inventory container click 10 Left"
      
      # 4. รอ 8 วินาที แล้วพิมพ์ /afk
      sleep 8
      echo "/afk"
      
      cat
    ) | ./MinecraftClient "$BOT" - play.amorycraft.com &

    # หน่วงเวลา 10 วินาทีก่อนที่จะเริ่มเปิดบอทตัวถัดไป
    sleep 10
done

# ค้าง Process ไว้ไม่ให้ PM2 สั่งปิดสคริปต์
wait