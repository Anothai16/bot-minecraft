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
    'Sudlorkayeejai',
    'Wood_Skel',
    'sindirt',
    'Pompamz',
    // 'quast',
    // 'Geyman',
    // 'Jolibee',
    // 'Posma2',
    // 'Rxzy3',
    'mecular',
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

        // 0: หน้าหลัก, 1: กำลังรอกรอก Anvil, 2: รอกดยืนยันเข้าสู่ระบบ (Slot 2), 3: รอวาร์ปเข้าห้องโถง, 4: อยู่ใน Survival
        bot.authStage = 0;

        bot.on('windowOpen', async (window) => {
            
            // STAGE 0: หน้าต่าง GUI ล็อกอินหลักเปิดขึ้นมา -> สั่งคลิก Slot 1 (สมุดรหัสผ่าน)
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                console.log(`[1/5] [${username}] พบ GUI ล็อกอินหลัก -> กำลังสั่งคลิกปุ่มกรอกรหัส (Slot 1)...`);

                setTimeout(async () => {
                    try {
                        // ส่งคลิกซ้าย Slot 1
                        await bot.clickWindow(1, 0, 0);
                        
                        // เผื่อเซิร์ฟเวอร์ต้องการ Right-Click ให้ลองส่งคลิกขวาตามไปถ้า Anvil ยังไม่เปิด
                        setTimeout(async () => {
                            if (bot.authStage === 1) {
                                console.log(`[i] [${username}] ลองคลิกขวา Slot 1 ซ้ำ...`);
                                await bot.clickWindow(1, 1, 0).catch(() => {});
                            }
                        }, 1200);

                    } catch (err) {
                        console.error(`[-] [${username}] คลิก Slot 1 ไม่สำเร็จ: ${err.message}`);
                    }
                }, 1500);
            }

            // STAGE 1: หน้าต่าง Anvil เปิดขึ้นมา -> พิมพ์ 112233
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2; // ย้ายไป Stage 2 (รอกดปุ่มเข้าสู่ระบบ)
                console.log(`[2/5] [${username}] พบ Anvil -> กำลังพิมพ์รหัสผ่าน ${BOT_PASSWORD}...`);

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0); // หยิบไอเทมผลลัพธ์ใน Anvil (Slot 2)
                            console.log(`[>] [${username}] พิมพ์รหัสผ่านลง Anvil เรียบร้อย`);
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // STAGE 2: กลับมาจาก Anvil เจอ GUI ล็อกอินหลักอีกครั้ง -> สั่งกด Slot 2 (ปุ่ม "เข้าสู่ระบบ")
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3; // ย้ายไป Stage 3 (รอใช้เข็มทิศ)
                console.log(`[3/5] [${username}] พบ GUI ยืนยัน -> กำลังกดปุ่ม "เข้าสู่ระบบ" (Slot 2)...`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        console.log(`[✓] [${username}] กดยืนยันเข้าสู่ระบบเรียบร้อย! (รอ 6 วินาทีเข้าห้องโถง...)`);

                        // รอ 6 วินาทีให้ตัวละครวาร์ปเข้าห้องโถง แล้วคลิกขวาเข็มทิศ
                        setTimeout(() => {
                            console.log(`[4/5] [${username}] กำลังคลิกขวาใช้เข็มทิศ...`);
                            try { bot.activateItem(); } catch (e) {}
                        }, 6000);

                    } catch (e) {}
                }, 1500);
            }

            // STAGE 3: เมนูเข็มทิศเปิดขึ้นมา -> สั่งกดเลือก Survival (Slot 10)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4; // เสร็จสิ้นกระบวนการ
                console.log(`[5/5] [${username}] พบเมนูเข็มทิศ -> กำลังกดเลือก Survival (Slot 10)...`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] เลือกโหมด Survival เรียบร้อย!`);

                        // รอวาร์ปเข้าเซิร์ฟหลัก 8 วินาที แล้วพิมพ์ /afk
                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                        }, 8000);

                    } catch (e) {}
                }, 1500);
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
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Auto Anvil & Login)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 20000);
});