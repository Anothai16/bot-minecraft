from javascript import On, Once, setTimeout

def setup_amory_login(bot_instance):
    username = getattr(bot_instance, 'username', 'Bot')
    is_book_processed = [False]

    if not hasattr(bot_instance, '_client') or not bot_instance._client:
        return

    # 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเก็ตเครือข่ายดิบ ทะลวงด่าน Book UI
    @On(bot_instance._client, 'packet')
    def handle_packet(this, data, metadata, *args):
        packet_name = str(metadata.name) if hasattr(metadata, 'name') else ''
        
        if packet_name == 'open_book' or 'book' in packet_name:
            if is_book_processed[0]:
                return
            is_book_processed[0] = True

            print(f"\n🚨 [{username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...")

            # 1. ยิงรหัสผ่านสวนแชทหลังผ่านไป 500ms
            def send_pass():
                bot_instance.chat('/login 112233')
                print(f"✍️ [{username}]: ยิงรหัสผ่าน [/login 112233] เรียบร้อย")

            # 2. บังคับปิดหน้าต่างสมุดหลังผ่านไป 1200ms
            def close_book():
                try:
                    bot_instance.closeWindow(0)
                    print(f"✅ [{username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!")
                except Exception:
                    pass

            setTimeout(send_pass, 500)
            setTimeout(close_book, 1200)

    # 🛰️ [เรดาร์ชั้นที่ 2]: กลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกมหลัก
    @Once(bot_instance, 'spawn')
    def handle_spawn(this, *args):
        def do_equip():
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
                    setTimeout(do_activate, 800)
            except Exception:
                pass

        def do_activate():
            try:
                bot_instance.activateItem()
                print(f"🧭 [{username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย!")
            except Exception:
                pass

        # หน่วงเวลา 6000ms (6 วินาที) แล้วสลับถือเข็มทิศ
        setTimeout(do_equip, 6000)

    # 🚨 [เรดาร์ชั้นที่ 3]: หน้าต่างเมนูปกติ (สล็อตเลือกเซิร์ฟย่อยหญ้าไอดี 10)
    @On(bot_instance, 'windowOpen')
    def handle_window_open(this, window, *args):
        def do_click():
            target_slot_id = 10
            try:
                # จิ้มสล็อตไอดี 10 (บล็อกหญ้า)
                bot_instance.clickWindow(target_slot_id, 0, 0)
                setTimeout(go_home, 2500)
            except Exception:
                pass

        def go_home():
            try:
                bot_instance.chat('/home home')
                print(f"🏠 [{username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!")
            except Exception:
                pass

        # หน่วงเวลา 1500ms แล้วจิ้มสล็อต 10
        setTimeout(do_click, 1500)