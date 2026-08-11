import time
import threading

def sleep_sec(secs):
    time.sleep(secs)

def setup_amory_login(bot_instance):
    # ดึงชื่อบอทแบบปลอดภัย
    username = getattr(bot_instance, 'username', 'Bot')
    
    # ตัวแปรล็อกป้องกันการประมวลผลด่านสมุดซ้ำซ้อน
    is_book_processed = [False]

    if not hasattr(bot_instance, '_client') or not bot_instance._client:
        return

    # 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเก็ตเครือข่ายดิบ ทะลวงด่าน Book UI
    def handle_packet(data, metadata, *args):
        packet_name = str(metadata.name) if hasattr(metadata, 'name') else ''
        
        if packet_name == 'open_book' or 'book' in packet_name:
            if is_book_processed[0]:
                return
            is_book_processed[0] = True

            print(f"\n🚨 [{username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...")

            # 1. ยิงรหัสผ่านสวนแชท
            def send_pass():
                time.sleep(0.5)
                bot_instance.chat('/login 112233')
                print(f"✍️ [{username}]: ยิงรหัสผ่าน [/login 112233] เรียบร้อย")

            # 2. บังคับปิดหน้าต่างสมุดไม่ให้จอค้าง
            def close_book():
                time.sleep(1.2)
                try:
                    bot_instance.closeWindow(0)
                    print(f"✅ [{username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!")
                except Exception:
                    pass

            threading.Thread(target=send_pass).start()
            threading.Thread(target=close_book).start()

    bot_instance._client.on('packet', handle_packet)

    # 🛰️ [เรดาร์ชั้นที่ 2]: กลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกมหลัก
    def handle_spawn(this, *args):
        def do_equip():
            time.sleep(6) # หน่วงเวลา 6 วินาทีให้รหัสผ่านซิงค์
            try:
                if not bot_instance.inventory:
                    return
                
                # ค้นหา recovery_compass ในช่องเก็บของ
                items = bot_instance.inventory.items()
                blue_compass = None
                for item in items:
                    if item.name == 'recovery_compass':
                        blue_compass = item
                        break

                if blue_compass:
                    bot_instance.equip(blue_compass, 'hand')
                    time.sleep(0.8)
                    bot_instance.activateItem()
                    print(f"🧭 [{username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย!")
            except Exception as e:
                pass

        threading.Thread(target=do_equip).start()

    bot_instance.once('spawn', handle_spawn)

    # 🚨 [เรดาร์ชั้นที่ 3]: หน้าต่างเมนูปกติ (สล็อตเลือกเซิร์ฟย่อยหญ้าไอดี 10)
    def handle_window_open(this, window, *args):
        def do_click():
            time.sleep(1.5)
            target_slot_id = 10
            try:
                # จิ้มสล็อตไอดี 10 (บล็อกหญ้า)
                bot_instance.clickWindow(target_slot_id, 0, 0)
                
                # พอก้าวเข้าสู่ Spawn ย่อยเสร็จ สั่งยิงกลับบ้าน
                time.sleep(2.5)
                bot_instance.chat('/home home')
                print(f"🏠 [{username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!")
            except Exception as e:
                pass

        threading.Thread(target=do_click).start()

    bot_instance.on('windowOpen', handle_window_open)