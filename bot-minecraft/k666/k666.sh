#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

READY_FILE="$(pwd)/k666_ready.txt"
echo "offline" > "$READY_FILE"

cleanup() {
  echo "offline" > "$READY_FILE"
  exit 0
}
trap cleanup SIGTERM SIGINT

(
  echo "[LOGIN] กำลังรอโหลดแมป Lobby (12 วินาที)..." >&2
  sleep 12

  echo "[LOBBY] กำลังเดินไปหา NPC Survival..." >&2
  echo "/move 102 4 -632 -f"
  
  # เพิ่มเวลารอเดินเป็น 6 วินาที เพื่อให้ตัวละครหยุดนิ่งหน้า NPC ชัวร์ๆ
  sleep 6

  echo "[LOBBY] หันหน้าและคลิกคุยกับ NPC..." >&2
  echo "/look 102.5 5 -630.5"
  sleep 1
  echo "/entity 9 use"

  echo "[WORLD] กำลังโหลดข้ามห้องเข้า Survival (15 วินาที)..." >&2
  sleep 15
  echo "/home home"
  
  # ตรวจสอบสถานะและเข้าสู่โหมด AFK
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 เข้า Survival และวาร์ปเรียบร้อย!" >&2

  while true; do
    sleep 30
    echo ""
  done
) | ./MinecraftClient K666 - play.amorycraft.com

EXIT_CODE=$?
echo "offline" > "$READY_FILE"
echo "[RECONNECT] บอทหลุดการเชื่อมต่อ (Exit Code: $EXIT_CODE) รอ 5 วินาทีก่อนให้ PM2 รีสตาร์ต..." >&2
sleep 5
exit 1