const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';

console.log(`[System] กำลังเตรียมระบบ Shared Resources (${MC_VERSION})...`);
const sharedData = minecraftData(MC_VERSION);

const BOT_NAMES = [
    'obs1',
    'Morgan05',
    'Domertown',
    'Nattanon09',
    'Nanepez',
    'Iron34',
    'd456'
];

function createBotInstance(username, delayMs) {
    setTimeout(() => {
        console.log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);

        const bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 60000
        });

        // 0: หน้าหลัก, 1: รอ Anvil, 2: รอกดยืนยัน, 3: รอใช้เข็มทิศ, 4: สำเร็จ
        bot.authStage = 0;

        bot.on('windowOpen', async (window) => {
            
            // --- STAGE 0: หน้า GUI ล็อกอินหลัก -> กด Slot 1 (สมุด) ---
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                console.log(`[1/5] [${username}] พบ GUI ล็อกอิน -> กด Slot 1 (สมุด)`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                    } catch (e) {}
                }, 1500);
            }

            // --- STAGE 1: หน้า Anvil -> พิมพ์รหัส 112233 ---
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                console.log(`[2/5] [${username}] พบ Anvil -> พิมพ์รหัสผ่าน ${BOT_PASSWORD}`);

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0);
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // --- STAGE 2: กลับมากดยืนยัน (Slot 2) ---
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                console.log(`[3/5] [${username}] กรอกรหัสสำเร็จ -> กด Slot 2 ยืนยันเข้าห้องโถง`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        
                        // รอ 6 วินาทีให้วาร์ปเข้าห้องโถง แล้วค้นหาเข็มทิศมาถือเพื่อกดใช้
                        setTimeout(async () => {
                            console.log(`[4/5] [${username}] กำลังค้นหาเข็มทิศเพื่อถือและกดใช้...`);
                            
                            // ค้นหาเข็มทิศในกระเป๋า
                            const compassItem = bot.inventory.items().find(i => i.name.includes('compass'));
                            
                            if (compassItem) {
                                try {
                                    await bot.equip(compassItem, 'hand');
                                    await bot.sleep(500);
                                    bot.activateItem();
                                    console.log(`[>] [${username}] ถือเข็มทิศและสั่งกดใช้สำเร็จ`);
                                } catch (err) {
                                    bot.activateItem(); // เผื่อถืออยู่แล้ว
                                }
                            } else {
                                // ถ้าหาวิธีถือไม่เจอ สั่งกดคลิกขวาตรงๆ
                                try { bot.activateItem(); } catch (e) {}
                            }

                        }, 6000);

                    } catch (e) {}
                }, 1500);
            }

            // --- STAGE 3: หน้าต่างเมนูเข็มทิศเปิดขึ้นมา -> กดบล็อกหญ้า (บรรทัดที่ 2 ช่องที่ 2 = Slot 10) ---
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4; // เสร็จสิ้น
                console.log(`[5/5] [${username}] เมนูเข็มทิศเปิดแล้ว -> กำลังกดเลือก Survival (Slot 10)...`);

                setTimeout(async () => {
                    try {
                        // กด Slot 10 (บรรทัดที่ 2 ช่องที่ 2)
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] เลือกโหมด Survival เรียบร้อย!`);

                        // รอวาร์ปเข้าเซิร์ฟหลัก 8 วินาที แล้วพิมพ์ /afk
                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                        }, 8000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเลือก Survival พลาด: ${err.message}`);
                    }
                }, 1800);
            }
        });

        bot.on('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('error', () => {});

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason}) -> จะต่อใหม่ใน 20 วินาที...`);
            createBotInstance(username, 20000);
        });

    }, delayMs);
}

console.log('==================================================');
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Compass Equip & Slot Fix)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 20000);
});