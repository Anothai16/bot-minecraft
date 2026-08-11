#!/bin/bash
cd "$(dirname "$0")"

(
  # 1. รอ 5 วินาที ให้หน้า Dialog โหลดขึ้นมาจนสมบูรณ์
  sleep 5
  echo "/dialog input pass 112233"
  
  sleep 1
  echo "/dialog click 1"
  
  # 2. รอ 5 วินาที ให้เซิร์ฟเวอร์ปลดล็อกล็อกอิน และวาร์ปตัวละครเข้าจุด Spawn
  sleep 5
  echo "/useitem mainhand"
  
  # 3. รอ 3 วินาที ให้ GUI เข็มทิศเด้งขึ้นมา แล้วสั่งจิ้มเลือกสล็อต 10 (บล็อกหญ้า)
  sleep 3
  echo "/inventory container click 10 Left"
  
  # 4. รอ 3 วินาที แล้ววาร์ปกลับบ้าน
  sleep 3
  echo "/home home"
  
  cat
) | ./MinecraftClient K666 - play.amorycraft.com