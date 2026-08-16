@echo off
title MCC Lever Bot - Test Mode
cd /d "%~dp0"

(
  :: 1. รอหน้า Dialog โหลด 10 วิ แล้วกรอกรหัส
  timeout /t 10 /nobreak >nul
  echo /dialog input pass 112233
  
  :: 2. กดปุ่มยืนยัน
  timeout /t 3 /nobreak >nul
  echo /dialog click 1
  
  :: 3. รอเข้า Lobby แล้วกดใช้เข็มทิศ
  timeout /t 10 /nobreak >nul
  echo /useitem mainhand
  
  :: 4. เลือกสล็อต 10 (Survival)
  timeout /t 1 /nobreak >nul
  echo /inventory container click 10 Left
  
  :: 5. รอเข้าโลก แล้ววาร์ปกลับบ้าน
  timeout /t 8 /nobreak >nul
  echo /home home
  
  :: ค้าง Input ไว้ให้พิมพ์ต่อได้
  more
) | MinecraftClient.exe Lervy_Lever - play.amorycraft.com