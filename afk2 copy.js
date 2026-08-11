const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';

console.log(`[System] กำลังเตรียมระบบ Shared Resources (${MC_VERSION})...`);
const sharedData = minecraftData(MC_VERSION);

const BOT_NAMES = [
    'obs1', 'Morgan05', 'Domertown', 'Nattanon09', 'Nanepez', 'Sudlorkayeejai', 'Wood_Skel', 'sindirt', 'Pompamz', 'Netherboy', 'quast', 'Geyman'
            , 'Jolibee','Posma2','Rxzy3','mecular', 'Iron34','d456','llMasterll','Ixcw2534','ShadowEmpress','gulnwza007','Monosox','twenty29','0zow29'
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

        // 0: หน้าล็อกอินแรก, 1: อยู่หน้าโถง (รอคลิกเข็มทิศ), 2: เสร็จสิ้น
        bot.flowState = 0;

        bot.on('windowOpen', async (window) => {
            
            // ==========================================
            // STEP 1: หน้าต่าง GUI ล็อกอินแรกสุดเปิดขึ้นมา
            // ==========================================
            if (window.type === 'minecraft:generic_9x3' && bot.flowState === 0) {
                bot.flowState = 1; // เปลี่ยน State เพื่อเตรียมไปรอถือเข็มทิศที่ห้องโถง
                console.log(`[1/3] [${username}] พบ GUI ล็อกอิน -> กำลังกดปุ่มเข้าสู่ระบบ (Slot 2)...`);

                setTimeout(async () => {
                    try {
                        // กด Slot 2 (ปุ่ม oak_button "เข้าสู่ระบบ")
                        await bot.clickWindow(2, 0, 0);
                        console.log(`[✓] [${username}] กดเข้าสู่ระบบเรียบร้อย! (กำลังวาร์ปไปห้องโถง...)`);

                        // ==========================================
                        // STEP 2: รอ 6 วินาทีให้วาร์ปมาถึงห้องโถงนิ่งๆ แล้วถือเข็มทิศคลิกขวา
                        // ==========================================
                        setTimeout(async () => {
                            console.log(`[2/3] [${username}] ถึงห้องโถงแล้ว -> กำลังสแกนถือเข็มทิศ...`);
                            
                            // หาไอเทมเข็มทิศในช่องเก็บของ
                            const compass = bot.inventory.items().find(i => i.name.includes('compass'));
                            
                            if (compass) {
                                try {
                                    await bot.equip(compass, 'hand');
                                    await bot.sleep(500);
                                    bot.activateItem();
                                    console.log(`[>] [${username}] ถือเข็มทิศและคลิกขวาเรียบร้อย!`);
                                } catch (e) {
                                    bot.activateItem();
                                }
                            } else {
                                // ถ้าไม่มีในช่องเก็บของ ลองสั่งคลิกขวาตรงๆ
                                try { bot.activateItem(); } catch (e) {}
                                console.log(`[>] [${username}] สั่งคลิกขวาใช้เข็มทิศ (Direct)`);
                            }

                        }, 6000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเข้าสู่ระบบพลาด: ${err.message}`);
                    }
                }, 1500);
            }

            // ==========================================
            // STEP 3: เมนูเข็มทิศเปิดขึ้นมา -> กด Survival (Slot 10: บรรทัด 2 ช่อง 2)
            // ==========================================
            else if (window.type === 'minecraft:generic_9x3' && bot.flowState === 1) {
                bot.flowState = 2; // ล็อก State เสร็จสมบูรณ์
                console.log(`[3/3] [${username}] GUI เข็มทิศเปิดขึ้นมาแล้ว! -> กำลังกดเลือก Survival (Slot 10)...`);

                setTimeout(async () => {
                    try {
                        // กด Slot 10 (บล็อกหญ้า Survival)
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] เลือกโหมด Survival เรียบร้อย! (กำลังวาร์ปเข้าเซิร์ฟหลัก...)`);

                        // รอวาร์ปเข้าโลก Survival 8 วินาที แล้วพิมพ์ /afk
                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk สำเร็จ! (ออนไลน์สมบูรณ์)`);
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
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (3-Step Direct Login)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 20000);
});