import time
from javascript import require

# ดึงโมดูลการหน่วงเวลาและใช้งานฟังก์ชัน Asynchronous ของ Python
def sleep(ms):
    time.sleep(ms / 1000.0)

def setup_amory_login(bot_instance):
    """
    ฟังก์ชันจัดการระบบออโต้ล็อกอิน ฝ่าด่านสมุดหนังสือ และเข้าเซิร์ฟเวอร์ย่อย AmoryCraft (เวอร์ชัน Python)
    """
    # ดึงชื่อแบบปลอดภัย ถ้ายังไม่มาให้ขึ้นคำว่า 'Bot' แทนชั่วคราว
    username = bot_instance.username or (bot_instance.options and bot_instance.options.username) or 'Bot'
    
    # ตัวแปรล็อกระบบ (ใช้ list เพื่อให้ฟังก์ชันภายในรังสี Packet เข้าถึงและแก้ไขค่าได้)
    state = {"is_book_processed": False}

    if not bot_instance._client:
        return

    # 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเกจเครือข่ายดิบ ทะลวงด่าน Book UI
    @bot_instance._client.on('packet')
    def handle_packet(data, metadata):
        if metadata.name == 'open_book' or 'book' in metadata.name:
            if state["is_book_processed"]:
                return
            state["is_book_processed"] = True

            print(f"\n🚨 [{username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...")
            
            # หน่วงเวลา 500ms แล้วส่งรหัสผ่านสวนกลับเข้าช่องแชท
            sleep(500)
            if bot_instance:
                bot_instance.chat('/login 112233')
                print(f"✍️ [{username}]: ยิงรหัสผ่าน [/login 112233] เรียบร้อย")

            # หน่วงเวลา 1200ms บังคับส่งสัญญาณกดปิดหน้าหนังสือทิ้งทันทีไม่ให้จอค้าง
            sleep(1200)
            if bot_instance and bot_instance._client:
                try:
                    bot_instance.closeWindow(0)
                    print(f"✅ [{username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!")
                except Exception:
                    pass

    # 🛰️ [เรดาร์ชั้นที่ 2]: กลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกมหลัก
    @bot_instance.once('spawn')
    def handle_spawn(*args):
        # หน่วงเวลา 6 วินาทีให้รหัสผ่านซิงค์ผ่านด่านสมุดก่อน แล้วค่อยคว้าเข็มทิศฟ้า
        sleep(6000)
        if not bot_instance or not bot_instance.inventory:
            return
            
        # ค้นหาเข็มทิศฟื้นฟู (Recovery Compass) ในกระเป๋า
        blue_compass = next((i for i in bot_instance.inventory.items() if i.name == 'recovery_compass'), None)
        if blue_compass:
            try:
                bot_instance.equip(blue_compass, 'hand')
                sleep(800)
                bot_instance.activateItem()
            except Exception:
                pass

    # 🚨 [เรดาร์ชั้นที่ 3]: หน้าต่างเมนูปกติ (สล็อตเลือกเซิร์ฟย่อยหญ้าไอดี 10)
    @bot_instance.on('windowOpen')
    def handle_window_open(window):
        # ดีเลย์ 1.5 วินาที แล้วจิ้มบล็อกหญ้าหลักเพื่อเข้าเซิร์ฟย่อย (สล็อตไอดี 10)
        sleep(1500)
        target_slot_id = 10
        
        try:
            bot_instance.clickWindow(target_slot_id, 0, 0)
            
            # พอก้าวเข้าสู่ Spawn ย่อยเสร็จ สั่งยิงคำสั่งกลับพิกัดบ้านหลักทันที
            sleep(2500)
            if bot_instance:
                bot_instance.chat('/home home')
                current_name = bot_instance.username or username
                print(f"🏠 [{current_name}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!")
        except Exception:
            pass