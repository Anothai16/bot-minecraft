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
// เวลาสับเปิดคันโยก (ตัวอย่าง: 05:35:00 น.)
const CRON_ON_TIME = '0 35 5 * * *';
// ====================================================================

let bot;
let isReconnecting = false;

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8083;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

// 🕹️ ฟังก์ชันโยกคันโยกเฉพาะกรณีคันโยกปิดอยู่ เพื่อ "เปิด (ON)"
async function turnLeverOn() {
    if (!bot) return;

    const standPos = new Vec3(10429, 74, -5054);
    const leverPos = new Vec3(10428, 74, -5054);

    if (bot.entity) {
        const distance = bot.entity.position.distanceTo(standPos);
        if (distance > 1.5) {
            console.log(`🚶‍♂️ [LEVER ACTION]: กำลังเดินไปจุดยืนที่พิกัด X:10429 Y:74 Z:-5054...`);
            await bot.lookAt(standPos.offset(0.5, 0, 0.5), true);
            bot.setControlState('forward', true);
            
            while (bot.entity.position.distanceTo(standPos) > 1.0) {
                await sleep(50);
            }
            bot.setControlState('forward', false);
            await sleep(200);
        }
    }

    const leverBlock = bot.blockAt(leverPos);

    if (!leverBlock || leverBlock.name !== 'lever') {
        console.log(`❌ [LEVER ERROR]: ไม่พบคันโยกที่พิกัด X:10428 Y:74 Z:-5054`);
        return;
    }

    try {
        let props = leverBlock.getProperties ? leverBlock.getProperties() : (leverBlock._properties || {});
        let isPowered = props.powered === 'true' || props.powered === true;

        if (isPowered) {
            console.log(`ℹ️ [LEVER SCHEDULE]: คันโยกเปิด (ON) อยู่แล้ว ข้ามการโยกซ้ำ`);
            return;
        }

        await bot.lookAt(leverPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await bot.activateBlock(leverBlock);

        await sleep(300);

        const updatedBlock = bot.blockAt(leverPos);
        props = updatedBlock.getProperties ? updatedBlock.getProperties() : (updatedBlock._properties || {});
        isPowered = props.powered === 'true' || props.powered === true;
        const facing = props.facing ? props.facing.toString().toUpperCase() : 'UNKNOWN';

        console.log(`\n🕹️ ================= [ LEVER AUTOMATION ] =================`);
        console.log(`🎯 คำสั่งตั้งเวลา       : เปิดคันโยก (ON)`);
        console.log(`📍 ตำแหน่งยืนบอท     : X:10429 Y:74 Z:-5054`);
        console.log(`🟢 สถานะใหม่ (Powered)  : ${isPowered ? 'เปิด (ON)' : 'ปิด (OFF)'}`);
        console.log(`🧭 ทิศทางคันโยก (Facing) : ${facing}`);
        console.log(`========================================================\n`);

    } catch (err) {
        console.log(`❌ [LEVER ERROR]: เกิดข้อผิดพลาดในการโยกคันโยก: ${err.message}`);
    }
}

// ⏰ ฟังก์ชันตั้งคิวงานอัตโนมัติ Cron Jobs (เฉพาะเปิด)
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
        viewDistance: 2, // กำหนดระยะโหลดแมพแคบที่สุดเพียงพอต่อการกดคันโยก
        checkTimeoutInterval: 60000,
        noResetWorld: true
    });

    if (bot._client) {
        // ⚡ [CPU OPTIMIZATION]: ดรอปแพ็คเก็ตขยะภาพ/เสียงที่ไม่จำเป็นทิ้งทันที
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;

            const dropPackets = [
                'world_particles', 'packet_world_particles',
                'named_sound_effect', 'sound_effect', 'entity_destroy',
                'rel_entity_move', 'entity_move_look', 'entity_teleport',
                'entity_head_rotation', 'animation', 'entity_metadata',
                'block_change', 'multi_block_change', 'block_action', 
                'block_entity_data', 'update_time', 'set_passengers', 'lighting'
            ];

            if (dropPackets.includes(metadata.name)) {
                metadata.size = 0;
            }
        });
    }

    // เรียกระบบล็อกอิน
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [Lervy_Lever] ออนไลน์สำเร็จ! พร้อมทำงานสับคันโยก');

        // ⚡ [CPU OPTIMIZATION]: ปิดเอนจิน Physics & Ticks ถือค้างเพื่อดรอป CPU ลงเหลือน้อยที่สุด
        bot.physicsEnabled = false;
        if (bot.physics) bot.physics.stopped = true;

        if (bot.world) {
            bot.world.columns = {};
            bot.world.setBlockStateId = () => {};
            bot.world.getBlock = () => null;
        }

        if (bot.entities) {
            bot.removeAllListeners('entityMoved');
            bot.removeAllListeners('entitySpawn');
            bot.entities = {};
        }
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
        if (bot && bot.entity) {
            console.log('✍️ [Terminal Action] ยิงคำสั่งด่วน -> /tpa DukDikauai');
            bot.chat('/tpa DukDikauai');
        }
        return;
    }
});