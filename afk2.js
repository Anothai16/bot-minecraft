const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const MC_VERSION = '1.20.1';

const sharedData = minecraftData(MC_VERSION);
const BOT_NAME = 'obs1';

console.log(`[DEBUG MODE] เริ่มต้นตรวจสอบโครงสร้าง GUI สำหรับ ${BOT_NAME}`);

const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_NAME,
    version: MC_VERSION,
    data: sharedData,
    physicsEnabled: false
});

bot.on('windowOpen', async (window) => {
    console.log(`\n==================================================`);
    console.log(`[!] ตรวจพบหน้าต่าง GUI เด้งขึ้นมา!`);
    console.log(`    - ID: ${window.id}`);
    console.log(`    - Type: ${window.type}`);
    console.log(`    - Title: "${window.title || ''}"`);
    console.log(`    - รายการไอเทมทั้งหมดใน GUI:`);
    
    // วนลูปแสดงเฉพาะช่องที่มีไอเทมอยู่ข้างใน
    window.slots.forEach((item, slotIndex) => {
        if (item) {
            console.log(`      -> [Slot ${slotIndex}] Name: "${item.name}", CustomName: "${item.customName || ''}", Count: ${item.count}`);
        }
    });
    console.log(`==================================================\n`);
});

bot.on('spawn', () => {
    console.log(`[✓] [${BOT_NAME}] Spawn เข้าสู่โลกสำเร็จ`);
});

bot.on('error', (err) => console.error(`[-] Error: ${err.message}`));
bot.on('end', (reason) => console.log(`[!] หลุดการเชื่อมต่อ (${reason})`));