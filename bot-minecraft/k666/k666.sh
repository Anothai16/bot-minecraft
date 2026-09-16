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

  # 1. ล้างหน้าต่าง Inventory # null ที่ระบบเปิดค้างไว้ทิ้ง
  echo "[LOBBY] ปิดหน้าต่าง GUI ที่ค้างอยู่..." >&2
  echo "/inventory close"
  sleep 2

  # 2. เดินไปแท่นหน้า NPC
  echo "[LOBBY] กำลังเดินไปหาแท่นหน้า NPC Survival..." >&2
  echo "/move 102 4 -632 -f"
  sleep 9

  # 3. หันหน้ามองเป้าหมาย
  echo "[LOBBY] หันหน้าตรงไปที่ NPC..." >&2
  echo "/look 102.5 5 -630.5"
  sleep 2

  # 4. คลิกคุยกับ NPC
  echo "[LOBBY] คลิกคุยกับ NPC เพื่อข้ามเซิร์ฟเวอร์..." >&2
  echo "/entity near Player use"

  echo "[WORLD] กำลังโหลดข้ามห้องเข้า Survival (15 วินาที)..." >&2
  sleep 15
  echo "/home home"
  
  # ✅ เข้าสู่โลกและยืนประจำจุดสำเร็จแล้ว
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 เข้า Survival และวาร์ปเรียบร้อย!" >&2

  # 🛑 วนลูปให้อยู่ในเซิร์ฟเวอร์ตลอดเวลา
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