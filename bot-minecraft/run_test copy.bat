@echo off
chcp 65001 > nul
echo กำลังเปิดบอท K666 และรันชุดคำสั่งอัตโนมัติ...

(
  timeout /t 3 /nobreak > nul
  echo /internal set chatmode commands-only
  timeout /t 1 /nobreak > nul
  echo /dialog input 1 pass 112233
  timeout /t 1 /nobreak > nul
  echo /dialog submit 1 1
  timeout /t 1 /nobreak > nul
  echo /login 112233
  timeout /t 4 /nobreak > nul
  echo /useitem mainhand
  timeout /t 2 /nobreak > nul
  echo /inventory 1 click 10
  timeout /t 3 /nobreak > nul
  echo /home home
) | MinecraftClient.exe K666 - play.amorycraft.com

pause