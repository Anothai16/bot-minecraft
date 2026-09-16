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
  echo "[LOGIN] เข้าเซิร์ฟเวอร์แล้ว กำลังรอโหลดแมป/หน้าล็อบบี้ (10 วินาที)..." >&2
  sleep 10

  echo "[LOBBY] กำลังเดินไปหา NPC Survival..." >&2
  echo "/move 102 4 -632 -f"
  
  # รอให้บอทเดินถึงพิกัดเป้าหมาย
  sleep 4
  echo "[LOBBY] คุยกับ NPC เพื่อย้ายเข้าห้อง Survival..." >&2
  echo "/entity 9 use"

  echo "[WORLD] กำลังโหลดข้ามโลกเข้า Survival (10 วินาที)..." >&2
  sleep 10
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
exit 1