const mineflayer = require('mineflayer');

const HOST = 'play.amorycraft.com';
const PORT = 25565;
const VERSION = '1.21.11';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function setupAmoryLogin(botInstance) {
    const username = botInstance.username || (botInstance.options && botInstance.options.username) || 'Bot';
    let isBookProcessed = false; 

    if (!botInstance._client) return;

    // 🎯 [เรดาร์ชั้นที่ 1]: ดักฟังแพ็คเก็ตดิบเพื่อแก้ด่านสมุด
    botInstance._client.on('packet', (data, metadata) => {
        if (!metadata || !metadata.name) return;

        if (metadata.name === 'open_book' || metadata.name.includes('book')) {
            if (isBookProcessed) return; 
            isBookProcessed = true; 

            console.log(`\n🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);
            
            // 1. ยิงรหัสผ่านรอบแรกทันทีที่เจอสมุด
            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 1 [/login 112233]`);
                }
            }, 600);

            // 2. ปิดหน้าต่างสมุดเพื่อปลดล็อก UI
            setTimeout(() => {
                if (botInstance && botInstance._client && !botInstance._client.ended) {
                    try {
                        botInstance.closeWindow(0); 
                        console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);
                    } catch (e) {}
                }
            }, 1200);

            // 3. ยิงรหัสผ่านรอบที่ 2 ซ้ำ
            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 2 ซ้ำเพื่อความชัวร์`);
                }
            }, 1800);
        }
    });

    // 🛰️ [เรดาร์ชั้นที่ 2]: ถือเข็มทิศและ "คลิกขวา" (Use Item)
    botInstance.once('spawn', () => {
        setTimeout(async () => {
            if (!botInstance || !botInstance.inventory || botInstance._client.ended) return;
            
            // ค้นหา Recovery Compass ในช่องเก็บของ
            const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
            if (blueCompass) {
                try {
                    // ถือเข็มทิศบนมือ
                    await botInstance.equip(blueCompass, 'hand');
                    await sleep(800); 
                    
                    // คลิกขวาใช้งานเข็มทิศ
                    await botInstance.activateItem();
                    console.log(`🧭 [${username}]: คลิกขวาใช้งานเข็มทิศฟ้าเรียบร้อย`);
                } catch (equipErr) {
                    console.log(`[!] [${username}] เกิดข้อผิดพลาดขณะถือ/คลิกขวาเข็มทิศ:`, equipErr.message);
                }
            } else {
                console.log(`⚠️ [${username}]: ไม่พบเข็มทิศในกระเป๋า พยายามยิง /server survival แทน...`);
                botInstance.chat('/server survival');
            }
        }, 7000); // รอ 7 วินาทีให้แน่ใจว่าล็อกอินผ่านเรียบร้อย
    });

    // 🚨 [เรดาร์ชั้นที่ 3]: เมื่อหน้าต่างเมนูเปิดขึ้นมา "คลิกซ้าย" (Left Click) บล็อกหญ้าในสล็อต 10
    botInstance.on('windowOpen', async (window) => {
        await sleep(1500);
        if (!botInstance || botInstance._client.ended) return;

        const targetSlotID = 10; // ช่องสล็อตบล็อกหญ้า
        try {
            // clickWindow(slot, mouseButton, mode)
            // mouseButton = 0 หมายถึง Left Click (คลิกซ้าย)
            await botInstance.clickWindow(targetSlotID, 0, 0);
            console.log(`🟩 [${username}]: คลิกซ้ายเลือกเมนูบล็อกหญ้า (Slot ${targetSlotID}) เรียบร้อย`);
            
            setTimeout(() => {
                if (botInstance && !botInstance._client.ended) {
                    botInstance.chat('/home home');
                    console.log(`🏠 [${username}]: เข้าสู่บ้านเรียบร้อยครับ!`);
                }
            }, 3000);
        } catch (clickErr) {
            console.log(`[!] [${username}] เกิดข้อผิดพลาดขณะคลิกเมนู:`, clickErr.message);
        }
    });
}

// รายชื่อบอทที่ต้องการเปิด
const botNames = ['K666']; 

function startBot(accountName, delay = 0) {
    setTimeout(() => {
        console.log(`[SYS] กำลังเชื่อมต่อบอท: ${accountName}...`);

        const bot = mineflayer.createBot({
            host: HOST,
            port: PORT,
            username: accountName,
            version: VERSION,

            // ⚡ 1. ปิดฟิสิกส์และการคำนวณตำแหน่ง
            physicsEnabled: false,
            checkTimeoutInterval: 120000,

            // ⚡ 2. ปิดเฉพาะ Plugin ที่ไม่จำเป็น (เปิด Window/Inventory ไว้สำหรับการคลิก)
            plugins: {
                chest: false,
                furnace: false,
                dispenser: false,
                enchantment_table: false,
                brewing_stand: false,
                villager: false,
                trade: false,
                book: false,
                anvil: false,
                pathfinder: false,
                'relative-nodes': false,
                raycast: false
            }
        });

        // ⚡ 3. ดักทิ้งเฉพาะ Packet โลกและ Entity เพื่อไม่ให้รก RAM (ปล่อย Packet Window / Inventory ไว้)
        bot._client.on('packet', (data, metadata) => {
            if (
                metadata.name === 'map_chunk' || 
                metadata.name === 'unload_chunk' || 
                metadata.name === 'spawn_entity' ||
                metadata.name === 'light_update' ||
                metadata.name === 'block_change'
            ) {
                return;
            }
        });

        // ผูกฟังก์ชันล็อกอิน
        setupAmoryLogin(bot);

        // ระบบขยับตัวเบาๆ ป้องกัน AFK Kick ทุก 2 นาที
        bot.on('spawn', () => {
            setInterval(() => {
                if (bot._client && !bot._client.ended) {
                    bot._client.write('look', {
                        yaw: 0,
                        pitch: 0,
                        onGround: true
                    });
                }
            }, 120000);
        });

        bot.on('end', () => {
            console.log(`[!] [${accountName}] หลุดการเชื่อมต่อ... รอต่อใหม่ใน 20 วินาที`);
            setTimeout(() => startBot(accountName, 0), 20000);
        });

        bot.on('error', (err) => {
            console.log(`[ERR] [${accountName}] เกิดข้อผิดพลาด:`, err.message);
        });

    }, delay);
}

// เรียกทำงาน
botNames.forEach((name, index) => {
    startBot(name, index * 5000);
});