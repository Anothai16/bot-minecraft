const mineflayer = require('mineflayer');
const express = require('express');
const { setupAmoryLogin } = require('./login');

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8082;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

let bot;
let isReconnecting = false;

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ (โหมด Chunk Loader ประหยัด CPU)...');
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K555',
        version: '1.21.11',
        viewDistance: 3, // รัศมี 48 บล็อก (3 Chunks)
        checkTimeoutInterval: 60000,
        noResetWorld: true
    });

    if (bot._client) {
        // ⚡ [CPU KILLER FIX 1]: ทะลวงดักกักแพ็คเก็ต Block/Piston/Chunk ก่อนถึง Mineflayer Engine
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;

            // แพ็คเก็ตขยะเน็ตเวิร์ก ปิดการแกะข้อมูลทั้งหมด
            const heavyPackets = [
                'world_particles', 'packet_world_particles',
                'named_sound_effect', 'sound_effect', 'entity_destroy',
                'rel_entity_move', 'entity_move_look', 'entity_teleport',
                'entity_head_rotation', 'animation',
                'block_change', 'multi_block_change', 'block_action', 'block_entity_data'
            ];

            if (heavyPackets.includes(metadata.name)) {
                metadata.size = 0;
            }
        });
    }

    // เรียกระบบล็อกอินเดิม
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('🛰️ บอท [K555] ออนไลน์สำเร็จ! กำลังรันโหมดประหยัด CPU ขั้นสูงสุด...');

        // ⚡ [CPU KILLER FIX 2]: ปิดการทำงานเบื้องหลังของ Mineflayer ทั้งหมด
        bot.physicsEnabled = false;
        if (bot.physics) bot.physics.stopped = true;

        // ปิดการประมวลผล World & Entity ทั้งหมด
        if (bot.world) {
            bot.world.columns = {};
            // ปิดการอัปเดตบล็อกในหน่วยความจำ
            bot.world.setBlockStateId = () => {};
        }

        if (bot.entities) {
            bot.removeAllListeners('entityMoved');
            bot.removeAllListeners('entitySpawn');
            bot.entities = {};
        }

        // ลบ Listener ที่สะสมในระบบออก
        bot.removeAllListeners('physicsTick');
    });

    bot.on('kicked', (reason) => console.log(`\n🚨 [KICKED]: บอทโดนเตะออก!!`));
    bot.on('error', (err) => console.log(`\n❌ [ERROR]: หลุดการเชื่อมต่อ!`));

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

startBot();