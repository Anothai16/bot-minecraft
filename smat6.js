const mineflayer = require('mineflayer');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const CONFIG = {
    host: 'play.amorycraft.com',
    port: 25565,
    username: 'K555',
    version: '1.20.4',
    reconnectDelay: 10000 // รอ 10 วินาทีก่อนเข้าใหม่เวลาหลุด
};

let bot = null;
let isReconnecting = false;

function safeReconnect(reason) {
    if (isReconnecting) return;
    isReconnecting = true;

    console.log(`🔄 [SYSTEM]: หลุดการเชื่อมต่อ (${reason}) รอ ${CONFIG.reconnectDelay / 1000} วินาทีเพื่อเข้าใหม่...`);

    if (bot) {
        try { bot.quit(); } catch (e) {}
    }

    setTimeout(() => {
        isReconnecting = false;
        createAFKBot();
    }, CONFIG.reconnectDelay);
}

function createAFKBot() {
    console.log(`\n🔌 [NET]: กำลังเชื่อมต่อเข้าสู่ ${CONFIG.host}...`);

    bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version,
        viewDistance: 'tiny',          // โหลดแมพแคบที่สุดเพื่อประหยัด RAM
        checkTimeoutInterval: 60000    // ยืดเวลาเช็ค Timeout
    });

    let isBookProcessed = false;

    // ⚡ [CPU SAVER]: ดักกรอง Packet Particle ทิ้ง
    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (metadata && (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles')) {
                metadata.size = 0;
            }

            // 🎯 เรดาร์ชั้นที่ 1: ดักฟัง Packet สมุดเพื่อยิงรหัสผ่าน
            if (metadata && metadata.name && (metadata.name === 'open_book' || metadata.name.includes('book'))) {
                if (isBookProcessed) return;
                isBookProcessed = true;

                console.log(`🚨 [LOGIN]: ตรวจพบด่านสมุด ส่งรหัสผ่าน...`);
                setTimeout(() => {
                    if (bot && bot._client && !bot._client.ended) {
                        bot.chat('/login 112233');
                        console.log(`✍️ [LOGIN]: ยิง /login 112233 เรียบร้อย`);
                    }
                }, 500);

                setTimeout(() => {
                    if (bot && bot._client && !bot._client.ended) {
                        try { bot.closeWindow(0); } catch (e) {}
                    }
                }, 1200);
            }
        });
    }

    // 🛰️ เรดาร์ชั้นที่ 2: กดใช้งานเข็มทิศฟ้าหลัง Spawn 6 วินาที
    bot.once('spawn', () => {
        console.log(`🛰️ [SPAWN]: บอทเข้าโลกแล้ว รอซิงค์ไอเทม...`);

        setTimeout(async () => {
            if (!bot || !bot.inventory || bot._client.ended) return;

            const blueCompass = bot.inventory.items().find(i => i.name === 'recovery_compass');
            if (blueCompass) {
                try {
                    await bot.equip(blueCompass, 'hand');
                    await sleep(800);
                    await bot.activateItem();
                    console.log(`🧭 [ITEM]: กดใช้งานเข็มทิศฟ้าเรียบร้อย`);
                } catch (e) {}
            } else {
                // ถ้าไม่มีเข็มทิศ ลองยิงคำสั่งตรง
                bot.chat('/server survival');
            }
        }, 6000);
    });

    // 🚨 เรดาร์ชั้นที่ 3: จิ้มเมนูสล็อต 10 (บล็อกหญ้า) เพื่อเข้าเซิร์ฟย่อย
    bot.on('windowOpen', async (window) => {
        await sleep(1500);
        if (!bot || bot._client.ended) return;

        try {
            await bot.clickWindow(10, 0, 0);
            console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);

            setTimeout(() => {
                if (bot && !bot._client.ended) {
                    bot.chat('/home home');
                    console.log(`🏠 [HOME]: กลับบ้านสำเร็จ! เริ่มเข้าโหมด AFK ยืนเฉยๆ (ปิด Physics)`);
                    
                    // ⚡ [CPU SAVER MAX]: ปิดคำนวณ Physics Engine ทั้งหมด
                    bot.physicsEnabled = false;
                }
            }, 2500);
        } catch (e) {}
    });

    // 🛑 ระบบ Auto Reconnect เมื่อหลุด/โดนเตะ/เออร์เรอร์
    bot.on('kicked', (reason) => safeReconnect(`Kicked: ${reason}`));
    bot.on('error', (err) => safeReconnect(`Error: ${err.message}`));
    bot.on('end', (reason) => safeReconnect(`End: ${reason}`));
}

// เริ่มต้นรันบอท
createAFKBot();