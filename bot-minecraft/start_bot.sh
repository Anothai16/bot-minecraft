#!/bin/bash
cd "$(dirname "$0")"
chmod +x ./MinecraftClient

LOG_FILE="$(dirname "$0")/server_restart_chat_logs.txt"
PIPE="/tmp/mcc_pipe_lever_$$"
LOCK_FILE="/tmp/mcc_lever_paused_$$"

rm -f "$PIPE" "$LOCK_FILE"
mkfifo "$PIPE"

# ==========================================
# 👂 1. Background Reader: ดักฟังแชท + บันทึกลง .txt
# ==========================================
./MinecraftClient Lervy_Lever - play.amorycraft.com < "$PIPE" | while IFS= read -r LINE; do
    echo "$LINE"

    # กรองตรวจจับเฉพาะข้อความระบบ/ประกาศ (ไม่เอาแชทผู้เล่นทั่วไป)
    if ! echo "$LINE" | grep -qE "^<.*>|^\[.*\] [a-zA-Z0-9_]+:"; then
        
        # ตรวจสอบคีย์เวิร์ด: ("รี" และ "สตาร์ท") หรือ ("ประจำวัน") หรือ ("Restart")
        if { echo "$LINE" | grep -q "รี" && echo "$LINE" | grep -q "สตาร์ท"; } || \
           echo "$LINE" | grep -q "ประจำวัน" || \
           echo "$LINE" | grep -iq "restart"; then
           
            FULL_TIME=$(date '+%Y-%m-%d %H:%M:%S')
            NOW=$(date '+%H:%M:%S')

            # 📝 บันทึกประโยคเต็ม + เวลาเครื่องจริง ลงไฟล์ .txt
            echo "[$FULL_TIME] $LINE" >> "$LOG_FILE"

            echo "==================================================" >&2
            echo "🚨 [ALERT $NOW] ตรวจพบประกาศรีสตาร์ตเซิร์ฟเวอร์!" >&2
            echo "📝 บันทึกข้อความลงไฟล์: $LOG_FILE เรียบร้อย" >&2
            echo "🛑 สั่งระงับการสับคันโยกทันที และรอเซิร์ฟเวอร์รีสตาร์ต..." >&2
            echo "==================================================" >&2
            
            # สร้าง Lock File เพื่อสั่งเบรก Cron Loop
            touch "$LOCK_FILE"
        fi
    fi
done &

MCC_PID=$!
exec 3>"$PIPE"

# ==========================================
# 🔑 2. กระบวนการล็อกอิน & ประจำจุด
# ==========================================
sleep 10
echo "/dialog input pass 112233" >&3
sleep 3
echo "/dialog click 1" >&3
sleep 10
echo "/useitem mainhand" >&3
sleep 1
echo "/inventory container click 10 Left" >&3
sleep 8
echo "/home home" >&3
echo "[READY] Lervy_Lever ประจำการที่จุดคันโยกเรียบร้อย!" >&2

# ==========================================
# ⏰ 3. Cron Loop สำหรับสับคันโยก (มีตัวเช็กสถานะรีสตาร์ต)
# ==========================================
LAST_TRIGGER_MIN=-1

while true; do
    # ตรวจสอบว่าโปรเซส MCC ยังมีชีวิตอยู่หรือไม่
    if ! kill -0 $MCC_PID 2>/dev/null; then
        echo "[INFO] MCC หลุดการเชื่อมต่อ จบสคริปต์เพื่อให้ PM2 ต่อใหม่..." >&2
        break
    fi

    # 🛑 หากตรวจพบประกาศรีสตาร์ต ให้หยุดทำงานการสับคันโยกทั้งหมด
    if [ -f "$LOCK_FILE" ]; then
        sleep 2
        continue
    fi

    HOUR=$(date +%-H)
    MIN=$(date +%-M)

    # ⏸️ ช่วงพักระบบเดิม (05:50 - 07:30 น.)
    if { [ "$HOUR" -eq 5 ] && [ "$MIN" -ge 50 ]; } || [ "$HOUR" -eq 6 ] || { [ "$HOUR" -eq 7 ] && [ "$MIN" -le 30 ]; }; then
        sleep 5
        continue
    fi

    # 🎯 เช็กรอบสับคันโยก (MIN % 6 == 3)
    if [ $(( MIN % 6 )) -eq 3 ] && [ "$MIN" -ne "$LAST_TRIGGER_MIN" ]; then
        LAST_TRIGGER_MIN=$MIN
        NOW_TIME=$(date '+%H:%M:%S')

        echo "==================================================" >&2
        echo "⏰ [CRON $NOW_TIME] ถึงรอบทำงาน! สั่งสับปิดคันโยก (OFF)..." >&2
        echo "/useblock 10383 64.00 -5064.51" >&3
        
        echo "⏱️ [CRON $NOW_TIME] รอ 5 วินาที..." >&2
        sleep 5
        
        NOW_TIME=$(date '+%H:%M:%S')
        echo "🟢 [CRON $NOW_TIME] จบเวลาทำงาน: สั่งสับเปิดระบบ (ON)..." >&2
        echo "/useblock 10383 64.00 -5064.51" >&3
        echo "✅ [CRON $NOW_TIME] ไซเคิลรอบนี้เสร็จสมบูรณ์!" >&2
        echo "==================================================" >&2
    fi

    sleep 1
done

# ==========================================
# 🧹 เคลียร์ท่อและคืนค่าให้ PM2 ทำงานต่อ
# ==========================================
kill $MCC_PID 2>/dev/null
exec 3>&-
rm -f "$PIPE" "$LOCK_FILE"
exit 1