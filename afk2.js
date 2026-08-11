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

        // 0: หน้าหลัก, 1: กำลังรอกรอก Anvil, 2: รอกดยืนยันเข้าสู่ระบบ (Slot 2), 3: รอใช้เข็มทิศ, 4: สำเร็จ
        bot.authStage = 0;

        bot.on('windowOpen', async (window) => {
            
            // STAGE 0: หน้า GUI ล็อกอินหลักเปิดขึ้นมา -> สั่งคลิก Slot 1 (สมุด)
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                console.log(`[1/5] [${username}] พบ GUI ล็อกอินหลัก (ID: ${window.id}) -> กำลังคลิก Slot 1...`);

                setTimeout(async () => {
                    try {
                        // ใช้ simpleClick หรือ clickWindow แบบระบุ mode 0
                        await bot.clickWindow(1, 0, 0);
                        console.log(`[>] [${username}] ส่ง Packet คลิก Slot 1 เรียบร้อย`);
                    } catch (err) {
                        console.error(`[-] [${username}] คลิก Slot 1 พลาด: ${err.message}`);
                    }
                }, 1800);
            }

            // STAGE 1: หน้าต่าง Anvil เด้งขึ้นมาจริง -> พิมพ์รหัสผ่าน 112233
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                console.log(`[2/5] [${username}] Anvil เปิดสำเร็จ! -> กำลังพิมพ์รหัสผ่าน ${BOT_PASSWORD}...`);

                setTimeout(() => {
                    try {
                        // ส่ง Packet พิมพ์ชื่อไอเทมใน Anvil
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        
                        setTimeout(async () => {
                            // คลิก Slot 2 (ไอเทมผลลัพธ์ขวาสุดของ Anvil)
                            await bot.clickWindow(2, 0, 0);
                            console.log(`[>] [${username}] ยืนยันรหัสผ่านใน Anvil เรียบร้อย`);
                        }, 1000);
                    } catch (e) {
                        console.error(`[-] [${username}] พิมพ์ Anvil พลาด: ${e.message}`);
                    }
                }, 1500);
            }

            // STAGE 2: กลับมาจาก Anvil เจอ GUI ล็อกอินหลัก -> กด Slot 2 (ปุ่มเข้าสู่ระบบ)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                console.log(`[3/5] [${username}] กลับมาหน้า GUI ยืนยัน -> กำลังกดปุ่มเข้าสู่ระบบ (Slot 2)...`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        console.log(`[✓] [${username}] เข้าสู่ระบบเรียบร้อย! (รอ 7 วินาทีเข้าห้องโถง...)`);

                        // รอ 7 วินาทีวาร์ปเข้าห้องโถง แล้วใช้เข็มทิศ
                        setTimeout(() => {
                            console.log(`[4/5] [${username}] กำลังคลิกขวาใช้เข็มทิศ...`);
                            try { bot.activateItem(); } catch (e) {}
                        }, 7000);

                    } catch (e) {}
                }, 1500);
            }

            // STAGE 3: เมนูเข็มทิศเปิดขึ้นมา -> กดเลือก Survival (Slot 10)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4;
                console.log(`[5/5] [${username}] เมนูเข็มทิศเปิดแล้ว -> กำลังกดเลือก Survival (Slot 10)...`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] เลือกโหมด Survival เรียบร้อย!`);

                        // รอวาร์ปเข้าโลกหลัก 10 วินาที แล้วพิมพ์ /afk
                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                        }, 10000);

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
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Single-Click Anvil Control)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 20000);
});