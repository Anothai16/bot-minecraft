#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

READY_FILE="$(pwd)/kaitom67_ready.txt"
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
  echo "[READY] บอท Kaitom_67 ประจำจุด Survival เรียบร้อย!" >&2

  # ⏰ เช็กเวลาทุก 30 วินาทีเพื่อ Reconnect ตอน 07:20 น.
  while true; do
    HOUR=$(date +%-H)
    MIN=$(date +%-M)

    if [ "$HOUR" -eq 7 ] && [ "$MIN" -eq 20 ]; then
      NOW_TIME=$(date '+%H:%M:%S')
      echo "🔄 [RESTART $NOW_TIME] ถึงเวลา 07:20 น. สั่งออกจากเซิร์ฟเวอร์เพื่อให้ PM2 รีสตาร์ต..." >&2
      echo "offline" > "$READY_FILE"
      echo "/quit"
      exit 0
    fi

    echo ""
    sleep 30
  done
) | ./MinecraftClient Kaitom_67 - play.amorycraft.com 1.20.1

EXIT_CODE=$?
echo "offline" > "$READY_FILE"
echo "[DISCONNECTED] บอท Kaitom_67 หลุดจากเซิร์ฟเวอร์ (Exit Code: $EXIT_CODE) -> หน่วงเวลา 5 วินาทีให้ PM2 รีสตาร์ตรันใหม่..." >&2
sleep 5
exit 1