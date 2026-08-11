const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const express = require('express');
const readline = require('readline');

// 🎯 เรียกใช้งานโมดูลล็อกอิน Amory ออโต้จากไฟล์ร่วม login.js
const { setupAmoryLogin } = require('./login');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// ====================================================================
// ⏱️ ตัวแปรตั้งเวลาสับเปิดอย่างเดียว (CRON SYNTAX: 'วินาที นาที ชั่วโมง * * *')
// ====================================================================
const CRON_ON_TIME = '0 35 5 * * *'; // ตัวอย่าง: 05:35:00 น.
// ====================================================================

let bot;
let isReconnecting = false;

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8083;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

// 🕹️ ฟังก์ชันโยกคันโยกแบบไม่คำนวณฟิสิกส์ (Zero Physics Lever Action)
async function turnLeverOn() {
    if (!bot || !bot._client || bot._client.ended) return;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        console.log(`🕹️ [LEVER ACTION]: กำลังสั่งโยกคันโยกด่วนที่พิกัด X:10428 Y:74 Z:-5054...`);
        
        // หันไปที่คันโยกโดยตรง
        await bot.lookAt(leverPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await sleep(100);

        // ดึง Block Object สั้นๆ แบบไม่โหลด Chunk
        const leverBlock = bot.blockAt(leverPos, false);

        if (leverBlock) {
            await bot.activateBlock(leverBlock);
            console.log(`🟢 [LEVER ACTION]: ส่ง Packet สับคันโยกเรียบร้อย!`);
        } else {
            // สำรอง: ยิง Packet พิกัดคันโยกตรงๆ หากมองไม่เห็น Object
            bot._client.write('block_place', {
                location: leverPos,
                direction: 1,
                hand: 0,
                cursorX: 0.5,
                cursorY: 0.5,
                cursorZ: 0.5,
                insideBlock: false
            });
            console.log(`🟢 [LEVER ACTION]: ยิง Raw Packet สับคันโยกสำรองเรียบร้อย!`);
        }

    } catch (err) {
        console.log(`❌ [LEVER ERROR]: เกิดข้อผิดพลาดในการโยกคันโยก: ${err.message}`);
    }
}

// ⏰ ฟังก์ชันตั้งคิวงานอัตโนมัติ Cron Jobs
function initScheduler() {
    cron.schedule(CRON_ON_TIME, async () => {
        console.log(`\n⏰ [CRON TRIGGER]: ถึงเวลาสับเปิดคันโยกตามกำหนดการ!`);
        await turnLeverOn();
    });

    console.log(`⏱️ [SCHEDULER READY]: ตั้งระบบสับเปิดไว้ที่ [${CRON_ON_TIME}] เรียบร้อยแล้ว`);
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Lervy_Lever',
        version: '1.21.11',
        viewDistance: 1, // บีบเหลือระยะ 1 Chunk พอให้เห็นคันโยก
        checkTimeoutInterval: 60000,
        noResetWorld: true
    });

    if (bot._client) {
        // ⚡ [CPU KILLER 1]: ตัด Packet ขยะที่ไม่ใช้ทิ้ง 100%
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;

            const dropPackets = [
                'world_particles', 'packet_world_particles',
                'named_sound_effect', 'sound_effect', 'entity_destroy',
                'rel_entity_move', 'entity_move_look', 'entity_teleport',
                'entity_head_rotation', 'animation', 'entity_metadata',
                'block_change', 'multi_block_change', 'block_action', 
                'block_entity_data', 'update_time', 'set_passengers', 'lighting',
                'map_chunk' // 👈 ตัดการโหลดและ Parse Chunk ในฉากทิ้ง
            ];

            if (dropPackets.includes(metadata.name)) {
                metadata.size = 0;
            }
        });
    }

    // เรียกระบบล็อกอิน
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [Lervy_Lever] ออนไลน์สำเร็จ! (โหมด Zero CPU)');

        // ⚡ [CPU KILLER 2]: ปิดการทำงานเอนจินภายในของ Mineflayer ทั้งหมด
        bot.physicsEnabled = false;
        if (bot.physics) bot.physics.stopped = true;

        if (bot.world) {
            bot.world.columns = {};
            bot.world.setBlockStateId = () => {};
            bot.world.getBlock = () => null;
        }

        if (bot.entities) {
            bot.entities = {};
        }

        // ⚡ ลบ Event Listener ย่อยที่คอยเช็กการขยับตัว
        const keepEvents = ['kicked', 'error', 'end', 'spawn', 'windowOpen', 'messagestr'];
        bot.eventNames().forEach(eventName => {
            if (!keepEvents.includes(eventName)) {
                bot.removeAllListeners(eventName);
            }
        });
    });

    bot.on('kicked', (reason) => console.log(`\n🚨🚨🚨 [⚠️ DETECTED KICK]: บอทโดนเตะออก!!`));
    bot.on('error', (err) => console.log(`\n❌❌❌ [💥 SYSTEM ERROR]: หลุดการเชื่อมต่อ!`));

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

// เรียกให้ระบบตั้งเวลาเริ่มทำงาน
initScheduler();

// เริ่มการทำงานของบอท
startBot();

// ⌨️ ระบบรับคำสั่งผ่าน Terminal Console
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'push') {
        await turnLeverOn();
        return;
    }

    if (input === 'tpa') {
        if (bot && bot._client && !bot._client.ended) {
            console.log('✍️ [Terminal Action] ยิงคำสั่งด่วน -> /tpa DukDikauai');
            bot.chat('/tpa DukDikauai');
        }
        return;
    }
});