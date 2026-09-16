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
  echo "[LOGIN] กำลังรอโหลดหน้า Lobby (12 วินาที)..." >&2
  sleep 12

  echo "[LOBBY] เดินไปยืนหน้า NPC Survival..." >&2
  echo "/move 102 5 -630 -f"
  sleep 9

  echo "[LOBBY] หันหน้าไปหา NPC..." >&2
  echo "/look 102.5 5.8 -630.5"
  sleep 2

  echo "[LOBBY] คลิกขวาคุยกับ NPC..." >&2
  echo "/entity 9 use"

  echo "[WORLD] กำลังรอโหลดข้ามห้องเข้า Survival (15 วินาที)..." >&2
  sleep 15
  echo "/home home"
  
  # ✅ เข้าสู่โลกและยืนประจำจุดสำเร็จ
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 ประจำจุด Survival เรียบร้อย!" >&2

  while true; do
    sleep 30
    echo ""
  done
) | ./MinecraftClient K666 - play.amorycraft.com

EXIT_CODE=$?
echo "offline" > "$READY_FILE"
echo "[DISCONNECTED] บอทหลุดจากเซิร์ฟเวอร์ (Exit Code: $EXIT_CODE) -> หน่วงเวลา 5 วินาทีให้ PM2 รีสตาร์ตรันใหม่..." >&2
sleep 5
exit 1