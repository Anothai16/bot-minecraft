import os
import sys
import math
from javascript import require, On, Once

mineflayer = require('mineflayer')
pathfinder_plugin = require('mineflayer-pathfinder')
vec3_module = require('vec3')
express = require('express')
timers = require('timers')

pathfinder = pathfinder_plugin.pathfinder
Movements = pathfinder_plugin.Movements
Vec3 = vec3_module.Vec3
set_timeout = timers.setTimeout

from login import setup_amory_login

# 🌍 Express Health Check (24/7)
app = express()
port = os.environ.get('PORT', 8082)

@On(app, 'get')
def handle_get(req, res, *args):
    res.send('Bot is running 24/7!')

app.listen(port)

bot = None
build_active = False
force_sneak_locked = False
reconnect_delay_ms = 10000
is_reconnecting = [False]  # กัน Reconnect ซ้อน

def get_max_durability(item_name):
    if item_name.startswith('netherite_'): return 2031
    if item_name.startswith('diamond_'): return 1561
    if item_name.startswith('iron_'): return 250
    if item_name.startswith('golden_'): return 32
    if item_name.startswith('stone_'): return 131
    return 59

def get_hoe_durability_percent():
    global bot
    if not bot or not bot.inventory: return 0
    hoe = None
    for i in bot.inventory.items():
        if i.name.endswith('_hoe'):
            hoe = i
            break
    if not hoe: return 0
    max_dur = get_max_durability(hoe.name)
    used_dur = getattr(hoe, 'durabilityUsed', 0) or 0
    return max(0, math.floor(((max_dur - used_dur) / max_dur) * 100))

def get_total_seed_count():
    global bot
    if not bot or not bot.inventory: return 0
    total = 0
    for item in bot.inventory.items():
        if item.name == 'pumpkin_seeds':
            total += item.count
    return total

def check_seed_count():
    total_seeds = get_total_seed_count()
    print(f"👉 SEED_COUNT: {total_seeds}")
    hoe_percent = get_hoe_durability_percent()
    print(f"👉 HOE_DURABILITY: {hoe_percent}")

def safe_reconnect(reason_str):
    global build_active, force_sneak_locked, bot
    build_active = False
    force_sneak_locked = False

    if is_reconnecting[0]:
        return
    is_reconnecting[0] = True

    print(f"🔄 บอทหลุด/โดนเตะ ({reason_str})! กำลังรอ {reconnect_delay_ms // 1000} วินาทีเพื่อเชื่อมต่อใหม่...")

    if bot:
        try:
            bot.quit()
        except Exception:
            pass

    def do_start():
        is_reconnecting[0] = False
        start_bot()

    set_timeout(do_start, reconnect_delay_ms)

def start_bot():
    global bot, build_active, force_sneak_locked
    print('\n🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...')

    # 🎯 ถอด 'version' ออก เพื่อให้ Mineflayer ทำ Auto Negotiation กับ Proxy เองแบบปลอดภัย
    bot = mineflayer.createBot({
        'host': 'play.amorycraft.com',
        'username': 'K555'
    })

    setup_amory_login(bot)
    bot.loadPlugin(pathfinder)

    @Once(bot, 'spawn')
    def handle_spawn(this, *args):
        print('🛰️ บอท [K555] ออนไลน์สำเร็จ! รอรับคำสั่งพิมพ์ farm จากพี่ครับ...')
        def delayed_check():
            check_seed_count()
            if bot and bot.inventory:
                @On(bot.inventory, 'updateSlot')
                def handle_update(u_this, *a):
                    check_seed_count()

        set_timeout(delayed_check, 8000)

    @On(bot, 'death')
    def handle_death(this, *args):
        global build_active, force_sneak_locked
        build_active = False
        force_sneak_locked = False
        if bot: bot.setControlState('sneak', False)
        def do_respawn():
            try: bot.respawn()
            except Exception: pass
        set_timeout(do_respawn, 2000)

    @On(bot, 'kicked')
    def handle_kicked(this, reason, *args):
        print(f"\n🚨🚨🚨 [⚠️ DETECTED KICK]: บอทโดนเซิร์ฟเวอร์เตะออก!! {reason}")
        safe_reconnect("Kicked")

    @On(bot, 'error')
    def handle_error(this, err, *args):
        print(f"\n❌❌❌ [💥 SYSTEM ERROR]: โปรแกรมขัดข้องหลุดการเชื่อมต่อ! {err}")
        safe_reconnect("Error")

    @On(bot, 'end')
    def handle_end(this, reason, *args):
        safe_reconnect(f"End ({reason})")

if __name__ == '__main__':
    start_bot()
    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
        except Exception:
            pass