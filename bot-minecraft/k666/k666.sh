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

  echo "[LOBBY] กำลังเดินไปหาแท่นหน้า NPC Survival..." >&2
  echo "/move 102 4 -632 -f"
  
  # รอให้ตัวละครเดินถึงจุดและหยุดนิ่งหน้าแท่นชัวร์ๆ
  sleep 10

  echo "[LOBBY] สลับมือเปล่าและหันหน้าตรง..." >&2
  echo "/slot 9"
  sleep 1
  echo "/look 102.5 5 -630.5"
  sleep 2

  echo "[LOBBY] คลิกคุยกับ NPC เพื่อข้ามเซิร์ฟเวอร์..." >&2
  echo "/entity near Player use"
  sleep 2
  echo "/entity near Player use"

  echo "[WORLD] กำลังโหลดข้ามห้องเข้า Survival (15 วินาที)..." >&2
  sleep 15
  echo "/home home"
  
  # ✅ เข้าสู่โลกและยืนประจำจุดสำเร็จแล้ว
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 ประจำจุดและเข้าสู่โหมด AFK เรียบร้อย!" >&2

  # 🛑 วนลูปให้อยู่ในเซิร์ฟเวอร์ตลอดเวลา ป้องกัน subshell หลุด
  while true; do
    sleep 30
    echo ""
  done
) | ./MinecraftClient K666 - play.amorycraft.com

EXIT_CODE=$?
echo "offline" > "$READY_FILE"
echo "[ERROR] MCC หยุดทำงาน (Exit Code: $EXIT_CODE) สั่ง PM2 รีสตาร์ต..." >&2
sleep 5
exit 1