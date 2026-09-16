(
  echo "[LOGIN] กำลังรอโหลดแมป Lobby (12 วินาที)..." >&2
  sleep 12

  echo "[LOBBY] กำลังเดินไปหาพิกัดหน้า NPC..." >&2
  echo "/move 102 4 -632 -f"
  sleep 6

  echo "[LOBBY] หันหน้าไปหา NPC..." >&2
  echo "/look 102.5 5 -630.5"
  sleep 2

  echo "[LOBBY] รันสคริปต์ตรวจหา Entity ID จริงแล้วคลิก..." >&2
  echo "/script click_npc.cs"

  echo "[WORLD] กำลังโหลดข้ามห้องเข้า Survival (15 วินาที)..." >&2
  sleep 15
  echo "/home home"
  
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 เข้า Survival และวาร์ปเรียบร้อย!" >&2

  while true; do
    sleep 30
    echo ""
  done
) | ./MinecraftClient K666 - play.amorycraft.com