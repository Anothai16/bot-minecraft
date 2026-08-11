from javascript import require, On
from login import setup_amory_login

mineflayer = require('mineflayer')

print("🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ play.amorycraft.com...")

bot = mineflayer.createBot({
    'host': 'play.amorycraft.com',
    'port': 25565,
    'username': 'K666',
    'version': '1.21.11'  # 👈 กำหนดเวอร์ชันให้ตรงเพื่อป้องกัน Proxy Internal Error
})

# ผูกระบบล็อกอินฝ่าด่านสมุด + เข็มทิศฟ้า + เมนูหญ้า
setup_amory_login(bot)

@On(bot, 'kicked')
def handle_kicked(this, reason, *args):
    print(f"\n🚨 [KICKED]: โดนเตะด้วยเหตุผล: {reason}\n")

@On(bot, 'end')
def handle_end(this, reason, *args):
    print(f"🔌 บอทหลุดการเชื่อมต่อ ({reason})")