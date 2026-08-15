const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function setupAmoryLogin(bot, onComplete) {
    const username = bot.username;
    let hasCompleted = false;

    const finishLogin = () => {
        if (!hasCompleted) {
            hasCompleted = true;
            console.log(`🏠 [${username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    };

    bot.on('windowOpen', async (window) => {
        try {
            const title = window.title ? window.title.toString() : '';

            // ด่านที่ 1: ตรวจสอบด่านสมุด
            if (title.includes('Book') || title.includes('สมุด') || window.type === 'minecraft:inventory') {
                console.log(`🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);
                await sleep(2000);
                
                // ยิงรหัสผ่านรอบที่ 1
                console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 1 [/login 112233]`);
                bot.chat('/login 112233');
                console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);

                // เว้น 12 วินาทีเพื่อรอระบบโหลด
                await sleep(12000);

                // ยิงรหัสผ่านรอบที่ 2 ซ้ำ
                console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 2 ซ้ำเพื่อความชัวร์`);
                bot.chat('/login 112233');

                // เว้น 12 วินาที
                await sleep(12000);

                // กดใช้งานเข็มทิศฟ้า
                console.log(`🧭 [${username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย`);
                bot.setQuickBarSlot(0);
                bot.activateItem();
            }

            // ด่านที่ 2: เมนูเลือกเซิร์ฟเวอร์ (บล็อกหญ้า / Survival)
            if (title.includes('Server') || title.includes('เลือก') || title.includes('Menu') || window.slots.length > 0) {
                await sleep(2000);
                console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);
                // คลิกสล็อตเลือกเซิร์ฟเวอร์
                bot.clickWindow(10, 0, 0);

                // เว้น 12 วินาที รอให้โหลดเข้าสู่โลก Survival และสลับ Server ให้เรียบร้อย
                await sleep(12000);

                // ยิงคำสั่งวาร์ปกลับบ้าน
                bot.chat('/home home');

                // เว้นอีก 5 วินาทีให้ตำแหน่ง Sync เข้าที่ แล้วประกาศสำเร็จ
                await sleep(5000);
                finishLogin();
            }
        } catch (err) {
            console.log(`❌ [${username} Login Error]: ${err.message}`);
        }
    });

    // สำรองกรณีเซิร์ฟเวอร์ไม่ได้เปิด GUI แต่ใช้คำสั่งแชตปกติ
    bot.on('messagestr', (msg) => {
        if (msg.includes('เข้าสู่บ้าน') || msg.includes('ยินดีต้อนรับ') || msg.includes('Survival')) {
            finishLogin();
        }
    });
}

module.exports = { setupAmoryLogin };