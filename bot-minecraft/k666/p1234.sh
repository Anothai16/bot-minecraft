#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

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
  echo "[READY] บอท p1234 ประจำจุด Survival เรียบร้อย!" >&2

  # 🔄 ลูป Keep-Alive ส่งสัญญาณป้องกันหลุด
  while true; do
    echo ""
    sleep 30
  done
) | ./MinecraftClient p1234 - play.amorycraft.com

EXIT_CODE=$?
echo "[DISCONNECTED] บอท p1234 หลุดจากเซิร์ฟเวอร์ (Exit Code: $EXIT_CODE) -> รอ 5 วินาทีให้รันใหม่..." >&2
sleep 5
exit 1