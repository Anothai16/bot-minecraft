// login.js
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * ฟังก์ชันจัดการระบบออโต้ล็อกอิน ฝ่าด่านสมุดหนังสือ และเข้าเซิร์ฟเวอร์ย่อย AmoryCraft
 * @param {import('mineflayer').Bot} botInstance ตัวแปร bot ของ Mineflayer
 */
function setupAmoryLogin(botInstance) {
    // 🎯 [แก้ไขบัค TypeError]: ดึงชื่อแบบปลอดภัย 100% ถ้ายังไม่มาให้ขึ้นคำว่า 'Bot' แทนชั่วคราว
    const username = botInstance.username || (botInstance.options && botInstance.options.username) || 'Bot';
    
    // ตัวแปรล็อกระบบ (ป้องกันการประมวลผลแพ็คเก็ตสมุดซ้ำซ้อน)
    let isBookProcessed = false; 

    if (!botInstance._client) return;

    // 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเก็ตเครือข่ายดิบ ทะลวงด่าน Book UI
    botInstance._client.on('packet', (data, metadata) => {
        if (metadata.name === 'open_book' || metadata.name.includes('book')) {
            // ป้องกัน Log เบิ้ล: ถ้าด่านนี้ถูกจัดการไปแล้ว ให้ดีดตัวข้ามทันที
            if (isBookProcessed) return; 
            isBookProcessed = true; 

            console.log(`\n🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);
            
            // สั่งพิมพ์รหัสผ่านสวนแชทเข้าไปปลดล็อกระบบ
            setTimeout(() => {
                if (botInstance) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่าน [/login 112233] เรียบร้อย`);
                }
            }, 500);

            // บังคับส่งคำสั่งกดปิดหน้าหนังสือทิ้งทันทีไม่ให้จอค้าง
            setTimeout(() => {
                if (botInstance && botInstance._client) {
                    try {
                        botInstance.closeWindow(0); 
                        console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);
                    } catch (e) {}
                }
            }, 1200);
        }
    });

    // 🛰️ [เรดาร์ชั้นที่ 2]: กลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกมหลัก
    botInstance.once('spawn', () => {
        // หน่วงเวลา 6 วินาทีให้รหัสผ่านซิงค์ผ่านด่านสมุดก่อน แล้วค่อยคว้าเข็มทิศฟ้า
        setTimeout(async () => {
            if (!botInstance || !botInstance.inventory) return;
            
            const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
            if (blueCompass) {
                try {
                    await botInstance.equip(blueCompass, 'hand');
                    await sleep(800); 
                    await botInstance.activateItem();
                } catch (equipErr) {}
            }
        }, 6000);
    });

    // 🚨 [เรดาร์ชั้นที่ 3]: หน้าต่างเมนูปกติ (สล็อตเลือกเซิร์ฟย่อยหญ้าไอดี 10)
    botInstance.on('windowOpen', async (window) => {
        // ดีเลย์ 1.5 วินาที แล้วจิ้มบล็อกหญ้าหลักเพื่อเข้าเซิร์ฟย่อย (สล็อตไอดี 10)
        await sleep(1500);
        const targetSlotID = 10; 
        
        try {
            await botInstance.clickWindow(targetSlotID, 0, 0);
            
            // พอก้าวเข้าสู่ Spawn ย่อยเสร็จ สั่งยิงคำสั่งกลับพิกัดบ้านหลักทันที
            setTimeout(() => {
                if (botInstance) {
                    botInstance.chat('/home home');
                    // แสดงผลแบบกระชับตามสั่งพี่เลยครับ
                    console.log(`🏠 [${botInstance.username || username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);
                }
            }, 2500);
        } catch (clickErr) {}
    });
}

module.exports = { setupAmoryLogin };