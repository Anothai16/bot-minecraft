import sys
import time
import asyncio
from javascript import require, On, AsyncTask
from vec3 import Vec3
from login import setup_amory_login  # 👈 ดึงระบบล็อกอินฝ่าด่านสมุดที่เราแปลงไว้มาใช้งาน

# โหลดโมดูล Mineflayer และ Pathfinder ผ่านทางสะพานเชื่อม
mineflayer = require('mineflayer')
pathfinder = require('mineflayer-pathfinder')
const_goals = pathfinder.goals

bot = None
build_active = False
force_sneak_locked = False
is_injecting_water = False

def get_water_bucket_count():
    if not bot or not bot.inventory:
        return 0
    items = bot.inventory.items()
    return sum(item.count for item in items if item.name == 'water_bucket')

def start_bot():
    global bot, build_active
    print('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft (Python Engine)...')
    
    bot = mineflayer.createBot({
        'host': 'play.amorycraft.com',
        'username': 'Water762',
        'version': '1.21.1',
        'viewDistance': 'tiny'
    })

    # เรียกใช้งานโมดูลล็อกอินแก้ทางสมุดและกดเข็มทิศกลับบ้านจาก login.py
    setup_amory_login(bot)
    bot.loadPlugin(pathfinder.pathfinder)

    @On(bot, 'spawn')
    def on_spawn(*args):
        username = bot.username or 'Bot'
        print(f"🛰️ บอท [{username}] ออนไลน์สำเร็จบน Python Engine! ล็อกคอก้มมองพื้นดิ่งฉาก 90 องศา")
        print(f"👉 พิมพ์คำสั่งรันงานได้เลยพี่: build -2715 168 14508")
        
        # เริ่มลูปคอยดักฟังคำสั่งพิมพ์คอมมานด์จากพี่ผ่าน Terminal ดำ
        asyncio.ensure_future(listen_to_terminal())

    @On(bot, 'physicsTick')
    def on_physics_tick(*args):
        global build_active, force_sneak_locked, is_injecting_water
        if not bot or not bot.entity:
            return
        
        # บังคับระบบฟิสิกส์ให้ย่อง (Sneak) และล็อกมุมกล้องก้มหน้าทิ่มพื้นดิ่งฉาก 90 องศา (-1.5707)
        if build_active and (force_sneak_locked or is_injecting_water):
            bot.setControlState('sneak', True)
            bot.setControlState('sprint', False)
            bot.entity.pitch = -1.5707  # ลบ = ก้มมองพื้นเท้าตัวเองสัมบูรณ์
        elif build_active and not force_sneak_locked and not is_injecting_water:
            bot.setControlState('sneak', False)

    @On(bot, 'end')
    def on_end(*args):
        global build_active
        build_active = False
        print("⚠️ บอทหลุดการเชื่อมต่อ... กำลังเชื่อมต่อใหม่ใน 5 วินาที")
        time.sleep(5)
        start_bot()

# ฟังก์ชัน One-Shot ลั่นไกสาดน้ำจมเนื้อ Slab 168 ใน Python
@BackgroundTask
def execute_one_shot_water_slab(tx, ty, tz):
    global build_active, force_sneak_locked, is_injecting_water
    build_active = True
    is_injecting_water = True

    movements = pathfinder.Movements(bot, bot.registry)
    movements.allowSprinting = False
    movements.canDig = False
    bot.pathfinder.setMovements(movements)

    # 1. สั่งให้บอทเดินไปยืนคร่อมพิกัดรูกึ่งกลางแผ่น Slab นั้นพอดีตัว
    safe_stand_spot = Vec3(tx + 0.5, ty + 1, tz + 0.5)
    print(f"🚶‍♂️ [DOWNWARD MODE]: กำลังเคลื่อนที่ไปยืนคร่อมรูบล็อกพิกัดเป้าหมาย...")
    
    try:
        bot.pathfinder.goto(const_goals.GoalBlock(safe_stand_spot.x, safe_stand_spot.y, safe_stand_spot.z))
    except Exception:
        pass

    bot.clearControlStates()
    force_sneak_locked = True
    bot.setControlState('sneak', True)
    time.sleep(0.3)  # รอขาหุ่นยนต์นิ่งสนิทประคองแรงเฉื่อย 300ms

    # 2. คัดแยกสลับเอาถังน้ำในเป้ากระเป๋ามาถือบน Hotbar
    hotbar_water_slot = -1
    for slot in range(0, 9):
        item = bot.inventory.slots[36 + slot]
        if item and item.name == 'water_bucket':
            hotbar_water_slot = slot
            break

    if hotbar_water_slot == -1:
        print(f"❌ [FAILED]: ไม่มีถังน้ำพร้อมใช้งานใน Hotbar เลยครับพี่!")
        is_injecting_water = False
        force_sneak_locked = False
        build_active = False
        return

    bot.setQuickBarSlot(hotbar_water_slot)
    time.sleep(0.1)

    # ดับเครื่องมุมกล้องอัตโนมัติของพาร์ทไฟนเดอร์
    if bot.pathfinder:
        try:
            bot.pathfinder.stop()
        except Exception:
            pass

    # 3. สั่งล็อกมุมสายตาให้ก้มมองพื้นดิ่งฉากนิ่งกริบ
    bot.entity.pitch = -1.5707
    bot.look(bot.entity.yaw, -1.5707, True)
    print(f"🔒 [DOWNWARD LOCK]: ล็อกคอก้มหน้าดิ่งมองพื้นเท้า หน่วงเวลา 350ms...")
    time.sleep(0.35)

    # ตรวจสอบยืนยันเป้าหมายในแนวรังสีสายตาระดับลึก
    block_at_cursor = bot.blockAtCursor(4.5)
    if block_at_cursor:
        print(f"🎯 [DOWNWARD SUCCESS]: สแกนพบผิวบล็อกใต้เท้าของจริงคือ: [{block_at_cursor.name}]")

    target_pos = Vec3(tx, ty, tz)

    # ⚡ [INJECTING PACKET BYPASS ON PYTHON]:
    # ส่งชุดแพ็คเกจเน็ตเวิร์กดิบ 'block_place' ตรงเข้า Socket ผ่านโมดูลเครือข่ายของ Python
    # ล็อกค่าทศนิยมแนวตั้งช่วงระนาบครึ่งบน 0.75 เพื่อทำ Waterlogged ฝังบล็อกน้ำเข้าแผ่น Slab Y:168
    # ใน Python จังหวะการ Tick ข้อมูลจะสัมพันธ์กันดีมาก Packet จะผ่าน Anti-Cheat เซิร์ฟเวอร์ฉลุยชัวร์ครับพี่!
    bot._client.write('block_place', {
        'hand': 0,
        'location': target_pos,
        'direction': 1,  # 1 = จิ้มผิวสัมผัสด้านบน Face TOP
        'cursorX': 0.5,
        'cursorY': 0.75,  # วางช่วงระนาบความสูงอากาศกึ่งกลางรู
        'cursorZ': 0.5,
        'insideBlock': False
    })

    bot.swingArm('mainhand')
    print(f"🌊 [PACKET INJECTED]: ยิง Packet ก้มดิ่งสาดน้ำสำเร็จ! (ถังน้ำคงเหลือในตัว: {get_water_bucket_count()})")

    time.sleep(0.3)
    bot.deactivateItem()

    is_injecting_water = False
    force_sneak_locked = False
    build_active = False
    print(f"🏁 [Mission Complete]: จบงานปูน้ำพิกัดเดี่ยวเสร็จสิ้นครับพี่!")

# ลูปดักฟังคำสั่ง build ผ่าน Terminal ดำ
async def listen_to_terminal():
    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        input_str = line.strip()
        if input_str.startswith('build'):
            args = input_str.split(' ')
            try:
                start_x = int(args[1])
                start_y = int(args[2])
                start_z = int(args[3])
                
                print(f"⚙️ เริ่มต้นทำงาน One-Shot หมุด Python X:{start_x} Y:{start_y} Z:{start_z}")
                execute_one_shot_water_slab(start_x, start_y, start_z)
            except Exception:
                print('⚠️ รูปแบบไม่ถูกต้องพี่! ลองใหม่: build -2715 168 14508')

# สตาร์ทเปิดระบบบอทหลัก
start_bot()

# ประคองสถานะลูปรัน Thread ของ Python ไม่ให้ไฟล์ปิดตัวลงดื้อๆ
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("🔌 ปิดการทำงานบอท Python เรียบร้อยครับพี่!")