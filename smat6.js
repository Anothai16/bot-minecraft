const mineflayer = require('mineflayer');
const express = require('express');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8082;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

let bot;
let isReconnecting = false;

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K555',
        version: '1.21.11',
        viewDistance: 'tiny' // บีบ RAM
    });

    // ⚡ [CPU Saver]: กรอง Particle ตามโค้ดเดิม
    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles') {
                metadata.size = 0;
                return false; 
            }
        });
    }

    // 🎯 [ลอจิกจาก setupAmoryLogin ใน login.js ต้นฉบับ เป๊ะ 100%]
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('🛰️ บอท [K555] ออนไลน์สำเร็จ! ยืน AFK โหมดประหยัดทรัพยากร...');
        
        // ⚡ [CPU Saver]: ปิด Physics Engine ทันทีที่เข้าโลกสำเร็จ
        bot.physicsEnabled = false;
    });

    // 🛑 ระบบ Auto Reconnect ตามโค้ดเดิม
    bot.on('kicked', (reason) => {
        console.log(`\n🚨🚨🚨 [⚠️ DETECTED KICK]: บอทโดนเซิร์ฟเวอร์เตะออก!!`);
    });

    bot.on('error', (err) => {
        console.log(`\n❌❌❌ [💥 SYSTEM ERROR]: โปรแกรมขัดข้องหลุดการเชื่อมต่อ!`);
    });

    bot.on('end', () => { 
        if (isReconnecting) return;
        isReconnecting = true;
        console.log(`🔄 หลุดการเชื่อมต่อ รอ 10 วินาทีเพื่อเชื่อมต่อใหม่...`);
        setTimeout(() => {
            isReconnecting = false;
            startBot();
        }, 10000); 
    });
}

/**
 * 🎯 ลอจิกปลดล็อกด่านสมุด + เข็มทิศ + คลิกบล็อกหญ้า (ถอดมาจาก login.js เดิม 100%)
 */
function setupAmoryLogin(botInstance) {
    const username = botInstance.username || (botInstance.options && botInstance.options.username) || 'Bot';
    let isBookProcessed = false; 

    if (!botInstance._client) return;

    // 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเก็ตเครือข่ายดิบ ทะลวงด่าน Book UI
    botInstance._client.on('packet', (data, metadata) => {
        if (metadata.name === 'open_book' || metadata.name.includes('book')) {
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
        await sleep(1500);
        const targetSlotID = 10; 
        
        try {
            await botInstance.clickWindow(targetSlotID, 0, 0);
            
            setTimeout(() => {
                if (botInstance) {
                    botInstance.chat('/home home');
                    console.log(`🏠 [${botInstance.username || username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);
                }
            }, 2500);
        } catch (clickErr) {}
    });
}

// เริ่มรันบอท
startBot();