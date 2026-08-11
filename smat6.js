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
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K555',
        version: '1.21.11',
        viewDistance: 'tiny',  // 1. บังคับโหลดแมพแคบที่สุด
        checkTimeoutInterval: 60000
    });

    // ⚡ [CPU Extreme Optimization 1]: ดักกรอง Packet กราฟิก/เสียง ทิ้งตั้งแต่ระดับ Socket (ไม่ให้เข้ามาใน Memory)
    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;

            // ตัดการประมวลผล Particle, Sound, Lighting และ Entity Animations
            const ignoredPackets = [
                'world_particles', 'packet_world_particles',
                'named_sound_effect', 'sound_effect', 'entity_destroy',
                'rel_entity_move', 'entity_move_look', 'entity_teleport',
                'entity_head_rotation', 'animation', 'block_change', 'multi_block_change'
            ];

            if (ignoredPackets.includes(metadata.name)) {
                metadata.size = 0;
            }
        });
    }

    // เรียกระบบล็อกอินเดิม
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('🛰️ บอท [K555] ออนไลน์สำเร็จ!');

        // ⚡ [CPU Extreme Optimization 2]: สั่งปิด Physics และตัดฟังชันวนลูปของ Mineflayer
        bot.physicsEnabled = false;

        // ปิดการอัปเดตตำแหน่งจากเน็ตเวิร์กเมื่อเข้าสู่โหมด AFK
        if (bot.physics) {
            bot.physics.stopped = true;
        }

        // ปิดการประมวลผล Entity Tracking รอบตัว (ไม่ต้องเสีย CPU จำว่าตัวอะไรเดินผ่าน)
        if (bot.entities) {
            bot.removeAllListeners('entityMoved');
            bot.removeAllListeners('entitySpawn');
        }
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