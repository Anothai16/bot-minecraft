from javascript import On, Once, require

timers = require('timers')
set_timeout = timers.setTimeout

def setup_amory_login(bot_instance):
    is_login_sent = [False]

    def is_bot_online():
        return hasattr(bot_instance, '_client') and bot_instance._client and getattr(bot_instance._client, 'ended', False) == False

    def send_login_command(reason_label):
        if is_login_sent[0] or not is_bot_online():
            return
        is_login_sent[0] = True

        username = getattr(bot_instance, 'username', 'Bot')
        try:
            bot_instance.chat('/login 112233')
            print(f"✍️ [{username}]: ยิงรหัสผ่าน [/login 112233] เรียบร้อย ({reason_label})")
        except Exception:
            pass

    # 1. Fast Trigger: ยิงรหัสผ่านหลัง Spawn 2.5 วินาที
    @Once(bot_instance, 'spawn')
    def handle_fast_spawn(this, *args):
        def do_fast_login():
            send_login_command("Fast Trigger หลัง Spawn")

        set_timeout(do_fast_login, 2500)

    # 2. Chat Detector
    @On(bot_instance, 'message')
    def handle_chat_message(this, json_msg, *args):
        msg_str = str(json_msg).lower()
        if ('/login' in msg_str or 'login' in msg_str or 'รหัสผ่าน' in msg_str) and not is_login_sent[0]:
            send_login_command("ตรวจพบข้อความแจ้งเตือนล็อกอิน")

    # 3. Book Packet Detector
    @Once(bot_instance, 'login')
    def handle_login_ready(this, *args):
        if is_bot_online():
            @On(bot_instance._client, 'packet')
            def handle_packet(p_this, data, metadata, *a):
                p_name = str(getattr(metadata, 'name', ''))
                if 'book' in p_name:
                    send_login_command("ตรวจพบ Packet สมุด")

                    def close_book():
                        if is_bot_online():
                            try:
                                bot_instance.closeWindow(0)
                                print(f"✅ ปลดล็อกด่านตรวจสมุดสำเร็จ!")
                            except Exception:
                                pass

                    set_timeout(close_book, 1200)

    # 4. กลไกคว้าเข็มทิศฟ้าเข้าเซิร์ฟหลัก
    @Once(bot_instance, 'spawn')
    def handle_spawn(this, *args):
        def do_equip():
            if not is_bot_online() or not bot_instance.inventory:
                return
            
            try:
                items = bot_instance.inventory.items()
                blue_compass = None
                for item in items:
                    item_name = getattr(item, 'name', '')
                    if 'compass' in item_name:
                        blue_compass = item
                        break

                if blue_compass:
                    bot_instance.equip(blue_compass, 'hand')
                    set_timeout(do_activate, 800)
                else:
                    bot_instance.chat('/server survival')
            except Exception:
                pass

        def do_activate():
            if is_bot_online():
                try:
                    bot_instance.activateItem()
                    username = getattr(bot_instance, 'username', 'Bot')
                    print(f"🧭 [{username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย!")
                except Exception:
                    pass

        set_timeout(do_equip, 6000)

    # 5. หน้าต่างเมนูปกติ (สล็อตเลือกเซิร์ฟย่อยหญ้าไอดี 10)
    @On(bot_instance, 'windowOpen')
    def handle_window_open(this, window, *args):
        def do_click():
            if not is_bot_online(): return
            target_slot_id = 10
            try:
                bot_instance.clickWindow(target_slot_id, 0, 0)
                set_timeout(go_home, 2500)
            except Exception:
                pass

        def go_home():
            if not is_bot_online(): return
            try:
                bot_instance.chat('/home home')
                username = getattr(bot_instance, 'username', 'Bot')
                print(f"🏠 [{username}]: เข้าสู่บ้านเรียบร้อยครับพี่!")
            except Exception:
                pass

        set_timeout(do_click, 1500)