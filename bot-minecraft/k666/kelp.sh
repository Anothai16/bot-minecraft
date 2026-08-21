#!/bin/bash
cd "$(dirname "$0")"

chmod +x ./MinecraftClient

(
  # ==========================================
  # 🔑 1. รอให้หน้า Dialog โหลดขึ้นมา แล้วล็อกอิน
  # ==========================================
  echo "[LOGIN] กำลังรอหน้า Dialog โหลด..." >&2
  sleep 10
  echo "/dialog input pass 112233"
  
  sleep 3
  echo "/dialog click 1"
  echo "[LOGIN] ปลดล็อกหน้าต่าง Dialog เรียบร้อย" >&2
  
  # ==========================================
  # 🧭 2. รอปลดล็อกล็อกอิน แล้วสั่งกดใช้เข็มทิศ
  # ==========================================
  echo "[LOBBY] กำลังรอวาร์ปเข้าจุด Spawn..." >&2
  sleep 10
  echo "/useitem mainhand"
  
  # ==========================================
  # 📦 3. จิ้มเลือกสล็อต 10 (Survival)
  # ==========================================
  sleep 1
  echo "/inventory container click 10 Left"
  echo "[LOBBY] เลือก Survival เรียบร้อย กำลังสลับโลก..." >&2
  

  # ==========================================
  # 🔄 5. ลูป Keep-Alive ส่งสัญญาณป้องกันหลุด
  # ==========================================
  while true; do
    echo ""
    sleep 30
  done
) | ./MinecraftClient Kelp_Kub_Umm - play.amorycraft.com