#!/bin/bash
cd "$(dirname "$0")"

# บังคับ .NET ให้คืน RAM ให้ OS ทันทีที่ว่าง และจำกัด Heap size
export DOTNET_GCHeapHardLimit=0x2800000   # จำกัด GC Heap อยู่ที่ประมาณ ~40MB
export DOTNET_GCConserveMemory=9          # ตั้งค่าการประหยัด Memory ระดับสูงสุด (1-9)
export DOTNET_GCLatencyMode=2             # ใช้ LowMemory GC Mode

BOTS=("obs1" "Morgan05" "Domertown" "Nattanon09" "Nanepez" "Sudlorkayeejai" "Wood_Skel" "sindirt")

for BOT in "${BOTS[@]}"; do
    echo "กำลังเปิดบอท: $BOT"
    
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
    ) | ./MinecraftClient "$BOT" - play.amorycraft.com &

    sleep 10
done

wait