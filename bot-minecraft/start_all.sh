#!/bin/bash
cd "$(dirname "$0")"

# 1. ตั้งค่าบีบ RAM ของ .NET Runtime ให้เหลือน้อยที่สุด
export DOTNET_gcServer=0
export DOTNET_GCHeapHardLimit=0x4000000
export DOTNET_GCConserveMemory=9

# 2. โหลด jemalloc ช่วยคืน RAM ให้ Linux (ตรวจสอบ path ไฟล์ .so ให้ตรงกับชิปเครื่องของคุณ)
if [ -f /usr/lib/aarch64-linux-gnu/libjemalloc.so.2 ]; then
    export LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libjemalloc.so.2
elif [ -f /usr/lib/x86_64-linux-gnu/libjemalloc.so.2 ]; then
    export LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
fi

# รายชื่อบอท 5 ตัว
BOTS=("obs1" "Morgan05" "Domertown" "Nattanon09" "Nanepez")

for BOT in "${BOTS[@]}"; do
    echo "--------------------------------------------------"
    echo "กำลังเปิดบอท: $BOT"
    echo "--------------------------------------------------"
    
    (
      sleep 10
      echo "/dialog input pass 112233"
      
      sleep 3
      echo "/dialog click 1"
      
      sleep 10
      echo "/useitem mainhand"
      
      sleep 1
      echo "/inventory container click 10 Left"
      
      sleep 8
      echo "/afk"
      
      cat
    ) | ./MinecraftClient "$BOT" - play.amorycraft.com > /dev/null 2>&1 &

    # หน่วงเวลา 10 วินาทีก่อนเปิดตัวถัดไป
    sleep 10
done

# ค้าง Process หลักไว้ไม่ให้ PM2 สั่งปิด
wait