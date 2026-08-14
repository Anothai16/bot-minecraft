const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const express = require('express');
const readline = require('readline');

// 🎯 เรียกใช้งานโมดูลล็อกอิน Amory ออโต้จากไฟล์ร่วม login.js
const { setupAmoryLogin } = require('./login');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let botLever;
let isReconnectingLever = false;

let botK666;
let isReconnectingK666 = false;

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8083;
app.get('/', (req, res) => res.send('Bots are running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

// ⚡ List รายการ Packet ที่ Drop ทิ้งทั้งหมด (แทบไม่เหลือการโหลดอะไรเลย)
const DROP_PACKETS = [
    'world_particles', 'packet_world_particles',
    'named_sound_effect', 'sound_effect', 'entity_destroy',
    'rel_entity_move', 'entity_move_look', 'entity_teleport',
    'entity_head_rotation', 'animation', 'entity_metadata',
    'block_change', 'multi_block_change', 'block_action', 
    'block_entity_data', 'update_time', 'set_passengers', 'lighting',
    'map_chunk', 'world_event', 'spawn_entity', 'spawn_entity_experience_orb',
    'entity_velocity', 'entity_equipment', 'game_state_change'
];

// ⚡ ฟังก์ชันทำลาย Engine ประมวลผลภายใน เพื่อหยุดการกิน CPU 100%
function neuterBotEngine(bot) {
    bot.physicsEnabled = false;
    if (bot.physics) bot.physics.stopped = true;
    
    // เคลียร์ความจำเรื่องโลกและม็อบ
    if (bot.world) {
        bot.world.columns = {};
        bot.world.setBlockStateId = () => {};
        bot.world.getBlock = () => null;
        bot.world.getColumn = () => null;
    }
    bot.entities = {};

    // ลบ Event Listeners ภายในที่ไม่จำเป็นออก
    const keepEvents = ['kicked', 'error', 'end', 'spawn', 'windowOpen', 'messagestr'];
    bot.eventNames().forEach(eventName => {
        if (!keepEvents.includes(eventName)) bot.removeAllListeners(eventName);
    });
}

// ====================================================================
// 🔍 CHECK PLAYERS ONLINE FUNCTIONS
// ====================================================================
function checkPlayersFromLever() {
    if (!botLever || !botLever.players) {
        return { isReady: false, hasK555: false, hasK666: false };
    }
    const onlinePlayerNames = Object.keys(botLever.players);
    const hasK555 = onlinePlayerNames.includes('K555');
    const hasK666 = onlinePlayerNames.includes('K666');

    return { isReady: hasK555 && hasK666, hasK555, hasK666 };
}

function isLeverBotOnline() {
    if (!botK666 || !botK666.players) return false;
    return Object.keys(botK666.players).includes('Lervy_Lever');
}

// ====================================================================
// 🕹️ LEVER BOT (Lervy_Lever - Direct Raw Packet)
// ====================================================================
function clickLeverRaw() {
    if (!botLever || !botLever._client || botLever._client.ended) return false;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        // ยิง Raw Packet ตรงไปที่พิกัดคันโยก โดยไม่ผ่าน Mineflayer Engine (CPU 0%)
        botLever._client.write('block_place', {
            location: leverPos,
            direction: 1,
            hand: 0,
            cursorX: 0.5,
            cursorY: 0.5,
            cursorZ: 0.5,
            insideBlock: false
        });
        return true;
    } catch (err) {
        console.log(`❌ [LEVER ERROR]: เกิดข้อผิดพลาดในการส่ง Packet คันโยก: ${err.message}`);
        return false;
    }
}

async function triggerLeverCycle() {
    console.log(`🔍 [CHECK ONLINE]: กำลังตรวจสอบผู้เล่น K555 และ K666 ในเซิร์ฟเวอร์...`);
    
    while (true) {
        const check = checkPlayersFromLever();

        if (check.isReady) {
            console.log(`✅ [CHECK ONLINE]: พบผู้เล่น K555 และ K666 อยู่ในเซิร์ฟเวอร์ครบถ้วน!`);
            break;
        } else {
            console.log(`⏳ [WAIT PLAYERS]: ผู้เล่นไม่ครบ (K555: ${check.hasK555 ? 'ออนไลน์' : '❌ ไม่อยู่'}, K666: ${check.hasK666 ? 'ออนไลน์' : '❌ ไม่อยู่'})`);
            
            if (!check.hasK666 && !isReconnectingK666) {
                console.log(`🔄 [AUTO RECONNECT K666]: ไม่พบ K666 สั่งเชื่อมต่อ K666 ใหม่ให้อัตโนมัติ...`);
                if (botK666) { try { botK666.quit(); } catch (e) {} }
                startAFKBot();
            }

            console.log(`⏱️ รอ 1 นาทีเพื่อให้ผู้เล่นเข้าเซิร์ฟเวอร์ครบ แล้วจะเช็กใหม่อีกครั้ง...`);
            await sleep(60000);
        }
    }

    console.log(`\n🔴 [LEVER CYCLE]: สั่งสับปิดคันโยก (OFF)...`);
    const successOff = clickLeverRaw();
    
    if (successOff) {
        console.log(`⏱️ [LEVER CYCLE]: สับปิดเรียบร้อย รอ 30 วินาที...`);
        await sleep(30000);
        
        console.log(`🟢 [LEVER CYCLE]: สั่งสับเปิดคันโยกกลับคืน (ON)...`);
        clickLeverRaw();
        console.log(`✅ [LEVER CYCLE]: ทำงานครบไซเคิลเรียบร้อย!`);
    }
}

function initScheduler() {
    const CRON_PATTERN = '0 3,9,15,21,27,33,39,45,51,57 * * * *';

    cron.schedule(CRON_PATTERN, async () => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        if ((hour === 5 && minute >= 35) || hour === 6) {
            console.log(`⏸️ [SCHEDULER SKIP]: เวลา ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น. อยู่ในช่วงพัก (05:35 - 07:00) ข้ามการทำงานรอบนี้`);
            return;
        }

        console.log(`\n⏰ [CRON TRIGGER]: ถึงเวลาทำงานตามรอบ [${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.]`);
        await triggerLeverCycle();
    });

    console.log(`⏱️ [SCHEDULER READY]: ตั้งระบบอัตโนมัติทุกนาทีที่ 3,9,15,21,27,33,39,45,51,57 (เว้นช่วงพัก 05:35 - 07:00 น.)`);
}

function startLeverBot() {
    console.log('🔌 [Lervy_Lever] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    botLever = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Lervy_Lever',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 60000,
        noResetWorld: true,
        physicsEnabled: false
    });

    if (botLever._client) {
        botLever._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    let isSuccessfullyInSurvival = false;

    const loginTimeout = setTimeout(() => {
        if (!isSuccessfullyInSurvival && botLever) {
            console.log(`⚠️ [Lervy_Lever]: ติดค้างใน Lobby เกิน 30 วินาที สั่ง Reconnect ใหม่...`);
            try { botLever.quit(); } catch (e) {}
        }
    }, 30000);

    setupAmoryLogin(botLever, () => {
        isSuccessfullyInSurvival = true;
        clearTimeout(loginTimeout);
    });

    botLever.on('spawn', () => {
        setTimeout(() => {
            if (botLever && botLever.username) {
                isSuccessfullyInSurvival = true;
                clearTimeout(loginTimeout);
            }
        }, 12000);
    });

    botLever.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [Lervy_Lever] ออนไลน์สำเร็จ! (โหมด Extreme Low-CPU)');
        neuterBotEngine(botLever); // ⚡ ปิด Engine ประมวลผลในตัวทันที
    });

    botLever.on('kicked', (reason) => console.log(`\n🚨 [Lervy_Lever]: โดนเตะออก!!`));
    botLever.on('error', (err) => console.log(`\n❌ [Lervy_Lever Error]: ${err.message}`));

    botLever.on('end', () => { 
        clearTimeout(loginTimeout);
        if (isReconnectingLever) return;
        isReconnectingLever = true;
        console.log(`🔄 [Lervy_Lever] หลุดการเชื่อมต่อ รอ 10 วินาทีเพื่อเชื่อมต่อใหม่...`);
        setTimeout(() => {
            isReconnectingLever = false;
            startLeverBot();
        }, 10000); 
    });
}

// ====================================================================
// 🤖 AFK BOT (K666)
// ====================================================================
function startAFKBot() {
    console.log('🔌 [K666] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    botK666 = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K666',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 60000,
        noResetWorld: true,
        physicsEnabled: false
    });

    if (botK666._client) {
        botK666._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    let isK666InSurvival = false;

    const k666LoginTimeout = setTimeout(() => {
        if (!isK666InSurvival && botK666) {
            console.log(`⚠️ [K666]: ติดค้างใน Lobby เกิน 30 วินาที สั่ง Reconnect ใหม่...`);
            try { botK666.quit(); } catch (e) {}
        }
    }, 30000);

    setupAmoryLogin(botK666, () => {
        isK666InSurvival = true;
        clearTimeout(k666LoginTimeout);
    });

    botK666.on('spawn', () => {
        setTimeout(() => {
            if (botK666 && botK666.username) {
                isK666InSurvival = true;
                clearTimeout(k666LoginTimeout);
            }
        }, 12000);
    });

    botK666.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [K666] ออนไลน์และยืน AFK สำเร็จ! (โหมด Extreme Low-CPU)');
        neuterBotEngine(botK666); // ⚡ ปิด Engine ประมวลผลในตัวทันที

        if (botK666.watchdogInterval) clearInterval(botK666.watchdogInterval);
        botK666.watchdogInterval = setInterval(() => {
            if (isK666InSurvival && !isLeverBotOnline() && !isReconnectingLever) {
                console.log(`⚠️ [K666 WATCHDOG]: ไม่พบ Lervy_Lever ในเซิร์ฟเวอร์! สั่งช่วย Reconnect Lervy_Lever ทันที...`);
                if (botLever) { try { botLever.quit(); } catch (e) {} }
                startLeverBot();
            }
        }, 120000);
    });

    botK666.on('kicked', (reason) => console.log(`\n🚨 [K666]: โดนเตะออก!!`));
    botK666.on('error', (err) => console.log(`\n❌ [K666 Error]: ${err.message}`));

    botK666.on('end', () => { 
        if (botK666 && botK666.watchdogInterval) clearInterval(botK666.watchdogInterval);
        clearTimeout(k666LoginTimeout);
        if (isReconnectingK666) return;
        isReconnectingK666 = true;
        console.log(`🔄 [K666] หลุดการเชื่อมต่อ รอ 10 วินาทีเพื่อเชื่อมต่อใหม่...`);
        setTimeout(() => {
            isReconnectingK666 = false;
            startAFKBot();
        }, 10000); 
    });
}

// ====================================================================
// 🚀 STARTUP & CONSOLE INPUT
// ====================================================================
initScheduler();
startLeverBot();

setTimeout(() => {
    startAFKBot();
}, 5000);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'push') {
        await triggerLeverCycle();
        return;
    }

    if (input === 'tpa') {
        if (botLever && botLever._client && !botLever._client.ended) {
            console.log('✍️ [Terminal Action] Lervy_Lever ยิงคำสั่ง -> /tpa DukDikauai');
            botLever.chat('/tpa DukDikauai');
        }
        if (botK666 && botK666._client && !botK666._client.ended) {
            console.log('✍️ [Terminal Action] K666 ยิงคำสั่ง -> /tpa DukDikauai');
            botK666.chat('/tpa DukDikauai');
        }
        return;
    }
});