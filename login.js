const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * ฟังก์ชันจัดการระบบออโต้ล็อกอิน ฝ่าด่านสมุดหนังสือ และเข้าเซิร์ฟเวอร์ย่อย AmoryCraft
 * @param {import('mineflayer').Bot} botInstance ตัวแปร bot ของ Mineflayer
 */
function setupAmoryLogin(botInstance) {
    const username = botInstance.username || (botInstance.options && botInstance.options.username) || 'Bot';
    let isBookProcessed = false; 

    if (!botInstance._client) return;

    // 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเก็ตเครือข่ายดิบ ทะลวงด่าน Book UI
    botInstance._client.on('packet', (data, metadata) => {
        if (!metadata || !metadata.name) return;

        if (metadata.name === 'open_book' || metadata.name.includes('book')) {
            if (isBookProcessed) return; 
            isBookProcessed = true; 

            console.log(`\n🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);
            
            // 1. ยิงรหัสผ่านรอบแรกทันทีที่เจอสมุด
            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 1 [/login 112233]`);
                }
            }, 600);

            // 2. ปิดหน้าต่างสมุดเพื่อปลดล็อก UI
            setTimeout(() => {
                if (botInstance && botInstance._client && !botInstance._client.ended) {
                    try {
                        botInstance.closeWindow(0); 
                        console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);
                    } catch (e) {}
                }
            }, 1200);

            // 3. ยิงรหัสผ่านรอบที่ 2 (กันพลาด กรณีรอบแรกติด UI Lock)
            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 2 ซ้ำเพื่อความชัวร์`);
                }
            }, 1800);
        }
    });

    // 🛰️ [เรดาร์ชั้นที่ 2]: กลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกมหลัก
    botInstance.once('spawn', () => {
        setTimeout(async () => {
            if (!botInstance || !botInstance.inventory || botInstance._client.ended) return;
            
            const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
            if (blueCompass) {
                try {
                    await botInstance.equip(blueCompass, 'hand');
                    await sleep(800); 
                    await botInstance.activateItem();
                    console.log(`🧭 [${username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย`);
                } catch (equipErr) {}
            } else {
                // ถ้าไม่เจอเข็มทิศ พยายามยิงคำสั่งย้ายเซิร์ฟเวอร์โดยตรง
                botInstance.chat('/server survival');
            }
        }, 7000); // ขยับเป็น 7 วินาที เพื่อให้แน่ใจว่ารหัสผ่านล็อกอินผ่านเรียบร้อยแล้ว
    });

    // 🚨 [เรดาร์ชั้นที่ 3]: หน้าต่างเมนูปกติ (สล็อตเลือกเซิร์ฟย่อยหญ้าไอดี 10)
    botInstance.on('windowOpen', async (window) => {
        await sleep(1500);
        if (!botInstance || botInstance._client.ended) return;

        const targetSlotID = 10; 
        try {
            await botInstance.clickWindow(targetSlotID, 0, 0);
            console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);
            
            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/home home');
                    console.log(`🏠 [${botInstance.username || username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);
                }
            }, 3000);
        } catch (clickErr) {}
    });
}

module.exports = { setupAmoryLogin };