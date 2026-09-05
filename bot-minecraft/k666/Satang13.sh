#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

PIPE="/tmp/mcc_pipe_satang_cmd"
CONSOLE_LOG="$(pwd)/satang_console.log"

# ล้างของเก่าทิ้ง
rm -f "$PIPE" "$CONSOLE_LOG"
mkfifo "$PIPE"

# สำคัญมาก: เปิด FD 3 ค้างไว้เพื่อไม่ให้ Pipe ปิดตัวเวลาส่งคำสั่งเสร็จ
exec 3<>"$PIPE"

cleanup() {
  echo "🛑 ปิดโปรเซส Satang13..." >&2
  exec 3>&-
  pkill -9 -f "MinecraftClient.*Satang13" 2>/dev/null
  rm -f "$PIPE"
  exit 0
}
trap cleanup SIGTERM SIGINT EXIT

# สคริปต์ Background สำหรับยิงลำดับการล็อกอินเข้าท่อ
(
  echo "[LOGIN] กำลังรอหน้า Dialog โหลด..." >&2
  sleep 8
  echo "/dialog input pass 112233" >&3
  sleep 3
  echo "/dialog click 1" >&3
  echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2

  echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn..." >&2
  sleep 8
  echo "/useitem mainhand" >&3
  sleep 2
  echo "/inventory container click 10 Left" >&3
  echo "[LOBBY] เลือก Survival เรียบร้อย..." >&2

  # ลูป Keep-alive ส่งว่างๆ ป้องกันหลุด
  while true; do
    sleep 30
    echo "" >&3
  done
) &

# รัน MinecraftClient เป็น Foreground หลัก (จะไม่มีทางโดน trigger cleanup)
# และใช้ tee ให้เห็น log ออกทั้ง pm2 และเขียนลง satang_console.log
./MinecraftClient Satang13 - play.amorycraft.com < "$PIPE" 2>&1 | tee "$CONSOLE_LOG"