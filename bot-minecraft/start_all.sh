#!/bin/bash
cd "$(dirname "$0")"

# ตั้งค่าบีบ Memory ของ .NET (ยังคงไว้เพื่อประหยัด RAM)
export DOTNET_gcServer=0
export DOTNET_GCHeapHardLimit=0x4000000
export DOTNET_GCConserveMemory=9

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
    ) | ./MinecraftClient "$BOT" - play.amorycraft.com &

    sleep 10
done

wait