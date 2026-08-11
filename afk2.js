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

// ฟังก์ชันช่วยสำหรับการ Delay (Sleep)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ฟังก์ชันช่วยสำหรับ "รอให้มี Window/GUI ประเภทที่ต้องการเปิดขึ้นมาจริง"
function waitForWindow(bot, windowType, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            bot.removeListener('windowOpen', handler);
            reject(new Error(`รอหน้าต่าง ${windowType} นานเกินไป (Timeout)`));
        }, timeoutMs);

        const handler = (window) => {
            if (!windowType || window.type === windowType) {
                clearTimeout(timer);
                bot.removeListener('windowOpen', handler);
                resolve(window);
            }
        };

        bot.on('windowOpen', handler);
    });
}

function createBotInstance(username, delayMs) {
    setTimeout(async () => {
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

        // 📌 ระบบคุมการทำงานแบบเรียงลำดับขั้นตอนทีละ Step (Sequential Workflow)
        async function runAuthenticationProcess() {
            try {
                // STEP 1: รอเปิด GUI หน้าแรกสุด -> สั่งคลิกสมุด (Slot 1)
                await waitForWindow(bot, 'minecraft:generic_9x3');
                console.log(`[1/5] [${username}] เปิดหน้าต่างล็อกอินหลักสำเร็จ -> กดสมุด (Slot 1)`);
                await sleep(1000);
                await bot.clickWindow(1, 0, 0);

                // STEP 2: รอเปิด Anvil -> พิมพ์รหัสผ่าน 112233
                await waitForWindow(bot, 'minecraft:anvil');
                console.log(`[2/5] [${username}] เปิดหน้าต่าง Anvil สำเร็จ -> กำลังพิมพ์รหัสผ่าน...`);
                await sleep(1000);
                bot._client.write('name_item', { name: BOT_PASSWORD });
                await sleep(800);
                await bot.clickWindow(2, 0, 0);

                // STEP 3: รอเปิด GUI ยืนยันรหัสผ่าน -> สั่งกดปุ่มยืนยัน (Slot 2)
                await waitForWindow(bot, 'minecraft:generic_9x3');
                console.log(`[3/5] [${username}] กลับมาหน้าต่างยืนยัน -> กดปุ่มยืนยัน (Slot 2)`);
                await sleep(1000);
                await bot.clickWindow(2, 0, 0);
                console.log(`[✓] [${username}] กรอกรหัสผ่านผ่านแล้ว! (รอ 6 วินาทีเพื่อวาร์ปเข้าห้องโถง)`);

                // STEP 4: เว้นระยะ 6 วินาทีให้ตัวละครวาร์ปเข้าห้องโถงนิ่งๆ แล้วค่อยเปิดเข็มทิศ
                await sleep(6000);
                console.log(`[4/5] [${username}] คลิกขวาใช้เข็มทิศ...`);
                
                // สั่งคลิกขวาเข็มทิศ แล้วตั้ง "รอให้หน้าต่างเมนูเข็มทิศเปิดขึ้นมาจริงๆ"
                const compassPromise = waitForWindow(bot, 'minecraft:generic_9x3');
                bot.activateItem();
                await compassPromise;

                // STEP 5: เมนูเข็มทิศเปิดเรียบร้อย -> สั่งกดโหมด Survival (Slot 10)
                console.log(`[5/5] [${username}] เปิดเมนูเข็มทิศสำเร็จ -> คลิกเลือก Survival (Slot 10)`);
                await sleep(1200);
                await bot.clickWindow(10, 0, 0);

                // จบกระบวนการ: รอวาร์ปเข้าโลก Survival 8 วินาที แล้วพิมพ์ /afk
                await sleep(8000);
                bot.chat('/afk');
                console.log(`[✓] [✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);

            } catch (err) {
                console.error(`[-] [${username}] ขั้นตอนขัดข้อง: ${err.message}`);
            }
        }

        bot.once('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ เริ่มต้นกระบวนการล็อกอิน...`);
            runAuthenticationProcess();
        });

        bot.on('error', () => {});

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason}) -> จะต่อใหม่ใน 15 วินาที...`);
            createBotInstance(username, 15000);
        });

    }, delayMs);
}

console.log('==================================================');
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (ปล่อยตัวละ 10 วินาที)`);
console.log('==================================================');

// ⚡ ปรับเป็น index * 10000 (เข้าห่างกันตัวละ 10 วินาที)
BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 10000);
});