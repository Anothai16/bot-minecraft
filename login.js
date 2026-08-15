const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * ฟังก์ชันจัดการระบบออโต้ล็อกอิน ฝ่าด่านสมุด และเข้าเซิร์ฟเวอร์ย่อย AmoryCraft
 */
function setupAmoryLogin(botInstance, onComplete) {
    const username = botInstance.username || 'Bot';
    let isBookProcessed = false;
    let isTransferred = false;

    if (!botInstance._client) return;
    botInstance._client.setMaxListeners(0); // 🟢 ปิด Warning Memory Leak

    // 🎯 [ด่านที่ 1]: ตรวจจับ Book UI และแก้ด่านสมุด
    botInstance._client.on('packet', (data, metadata) => {
        if (!metadata || !metadata.name) return;

        if (metadata.name === 'open_book' || metadata.name.includes('book')) {
            if (isBookProcessed) return;
            isBookProcessed = true;

            console.log(`\n🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);

            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 1 [/login 112233]`);
                }
            }, 1000);

            setTimeout(() => {
                if (botInstance && botInstance._client && !botInstance._client.ended) {
                    try {
                        botInstance.closeWindow(0);
                        console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);
                    } catch (e) {}
                }
            }, 2500);

            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 2 ซ้ำเพื่อความชัวร์`);
                }
            }, 12000);
        }
    });

    // 🛰️ [ด่านที่ 2]: กดเข็มทิศหลังล็อกอิน
    botInstance.once('spawn', () => {
        setTimeout(async () => {
            if (!botInstance || !botInstance.inventory || botInstance._client.ended) return;

            const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
            if (blueCompass) {
                try {
                    await botInstance.equip(blueCompass, 'hand');
                    await sleep(1500);
                    await botInstance.activateItem();
                    console.log(`🧭 [${username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย`);
                } catch (equipErr) {}
            } else {
                botInstance.chat('/server survival');
            }
        }, 24000);
    });

    // 🚨 [ด่านที่ 3]: จิ้มเมนูเข้า Survival
    botInstance.on('windowOpen', async (window) => {
        await sleep(3000);
        if (!botInstance || botInstance._client.ended) return;

        const targetSlotID = 10;
        try {
            await botInstance.clickWindow(targetSlotID, 0, 0);
            console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);
            isTransferred = true;
        } catch (clickErr) {}
    });

    // 🏠 [ด่านที่ 4]: เมื่อบอท Respawn/สปอว์นเข้าสู่ห้อง Survival จริง ค่อยสั่งวาร์ปกลับบ้าน
    botInstance.on('spawn', () => {
        if (!isTransferred) return; // ข้ามตอนสปอว์นครั้งแรกใน Lobby

        setTimeout(() => {
            if (botInstance && !botInstance._client.ended) {
                botInstance.chat('/home home');
                console.log(`🏠 [${username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);

                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        }, 4000); // รอฉาก Survival โหลดนิ่ง 4 วิแล้ววาร์ปเข้าบ้านทันที
    });
}

module.exports = { setupAmoryLogin };