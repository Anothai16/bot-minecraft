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
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ (โหมด Chunk Loader 48 บล็อก)...');
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K555',
        version: '1.21.11',
        // 🎯 viewDistance = 3 (3 Chunks = 48 บล็อครอบตัว ในทุกระดับความสูง Y)
        viewDistance: 3,
        checkTimeoutInterval: 60000,
        noResetWorld: true
    });

    if (bot._client) {
        // ⚡ [CPU OPTIMIZATION]: ดักตัดเฉพาะ Packet ที่ไม่เกี่ยวกับฟาร์มทิ้งตั้งแต่ระดับ Socket
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;

            // ตัดการประมวลผล Particle, เสียง, และการขยับของสิ่งมีชีวิตอื่นเพื่อเซฟ CPU
            const ignoredPackets = [
                'world_particles', 'packet_world_particles',
                'named_sound_effect', 'sound_effect', 'entity_destroy',
                'rel_entity_move', 'entity_move_look', 'entity_teleport',
                'entity_head_rotation', 'animation'
            ];

            if (ignoredPackets.includes(metadata.name)) {
                metadata.size = 0;
            }
        });
    }

    // เรียกระบบล็อกอินเดิม (ไม่แตะลอจิก)
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('🛰️ บอท [K555] เข้าสู่โลกสำเร็จ! เริ่มโหลดพื้นที่ 48 บล็อครอบตัว (เต็มความสูง Y)...');

        // ⚡ [CPU OPTIMIZATION]: ปิด Physics Engine การเดิน/ตก/ชน ของตัวบอท
        bot.physicsEnabled = false;
        if (bot.physics) {
            bot.physics.stopped = true;
        }

        // ⚡ [CPU OPTIMIZATION]: ปิดการจำตำแหน่ง Entity รอบตัวเพื่อคืน CPU ให้ Event Loop
        if (bot.entities) {
            bot.removeAllListeners('entityMoved');
            bot.removeAllListeners('entitySpawn');
        }

        // ⚡ เคลียร์ Memory ถอดโครงสร้างแคชขยะออก ไม่ให้ค้างจน RAM/CPU พุ่ง
        setInterval(() => {
            if (bot && bot.world && bot.world.columns) {
                const keys = Object.keys(bot.world.columns);
                // ถ้าแคชเกิน 49 Chunks (รัศมี 3 Chunks รอบตัว) ให้ล้างข้อมูลขยะทิ้ง
                if (keys.length > 49) {
                    bot.world.columns = {};
                }
            }
        }, 30000); // ทำความสะอาดทุกๆ 30 วินาที
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨🚨🚨 [⚠️ DETECTED KICK]: บอทโดนเตะออก!!`);
    });

    bot.on('error', (err) => {
        console.log(`\n❌❌❌ [💥 SYSTEM ERROR]: หลุดการเชื่อมต่อ!`);
    });

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