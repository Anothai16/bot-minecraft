#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

READY_FILE="$(pwd)/k666_ready.txt"
echo "offline" > "$READY_FILE"

cleanup() {
  echo "offline" > "$READY_FILE"
  exit 0
}
trap cleanup SIGTERM SIGINT EXIT

(
  echo "[LOGIN] กำลังรอหน้า Dialog โหลด (16 วินาที)..." >&2
  sleep 16
  echo "/dialog input pass 112233"
  
  sleep 3
  echo "/dialog click 1"
  echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2
  
  echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn (15 วินาที)..." >&2
  sleep 15

  # ดักดูว่าตอนนี้ถือไอเทมอะไรอยู่ และกระเป๋ามีอะไรบ้าง
  echo "[DEBUG] ตรวจสอบไอเทมในตัว..." >&2
  echo "/inventory"
  sleep 2

  # ส่งคำสั่งคลิกขวาใช้งานไอเทม
  echo "[LOBBY] สั่งคลิกขวาใช้งานเข็มทิศ..." >&2
  echo "/useitem mainhand"
  sleep 4

  # ตรวจสอบว่า Container GUI ของเซิร์ฟเวอร์เปิดขึ้นมาหรือยัง
  echo "[DEBUG] ตรวจสอบสถานะ GUI Menu..." >&2
  echo "/inventory container"
  sleep 2

  echo "[LOBBY] คลิกเลือก Survival (Slot 10)..." >&2
  echo "/inventory container click 10 Left"
  echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2
  
  sleep 12
  echo "/home home"
  
  # เข้าสู่โลกและยืนประจำจุดสำเร็จแล้ว
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 ประจำจุดและเข้าสู่โหมด AFK เรียบร้อย!" >&2

  # วนลูปให้อยู่ในเซิร์ฟเวอร์ตลอดเวลา ป้องกัน subshell หลุด
  while true; do
    sleep 30
    echo ""
  done
) | ./MinecraftClient K666 - play.amorycraft.com

EXIT_CODE=$?
echo "offline" > "$READY_FILE"
echo "[ERROR] MCC หยุดทำงาน (Exit Code: $EXIT_CODE) สั่ง PM2 รีสตาร์ต..." >&2
exit 1