(
  echo "[LOGIN] กำลังรอโหลดหน้า Lobby (12 วินาที)..." >&2
  sleep 12

  echo "[LOBBY] กำลังเดินไปหาแท่นหน้า NPC Survival..." >&2
  echo "/move 102 4 -632 -f"
  
  # ให้เวลาระบบ Pathfinding ก้าวเดิน 8 วินาทีจนตัวหยุดนิ่งหน้าแท่น
  sleep 8

  echo "[LOBBY] หันหน้ามองตรงไปที่ตัว NPC..." >&2
  echo "/look 102.5 5 -630.5"
  sleep 2

  echo "[LOBBY] สลับไปมือเปล่า (ป้องกันมือกดโดนเข็มทิศ)..." >&2
  echo "/changeSlot 8"
  sleep 2

  echo "[LOBBY] ส่งคำสั่งคลิกคุยกับ NPC..." >&2
  echo "/entity near Player use"

  echo "[WORLD] รอโหลดสลับโลกเข้า Survival (15 วินาที)..." >&2
  sleep 15
  echo "/home home"
  
  echo "online" > "$READY_FILE"
  echo "[READY] บอท K666 เข้า Survival และวาร์ปเรียบร้อย!" >&2

  while true; do
    sleep 30
    echo ""
  done
) | ./MinecraftClient K666 - play.amorycraft.com