const mineflayer = require('mineflayer');

// 🎯 เหลือแค่ไอดี tutipong ตัวเดียวเน้นๆ ตามสั่งพี่ครับ
const username = 'tutipong';
let bot;
let botStatus = "OFFLINE";

process.on('uncaughtException', (err) => {
    if (!err) return;
    try {
        const errString = err.toString() || '';
        if (errString.includes('PartialReadError') || errString.includes('particles') || errString.includes('protodef')) {
            return; 
        }
    } catch (e) { return; }
});

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// ฟังก์ชันรายงานสถานะกลับขึ้นหน้าต่างบอร์ด Python GUI
function printStatus(status) {
    console.log(`AFK_BOT_DATA:${JSON.stringify({ username: username, status: status })}`);
}

function createBotInstance() {
    printStatus("🟡 LOADING...");
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: username,
        version: '1.21.11'
    });

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles') {
                metadata.size = 0;
                return false; 
            }
        });
    }

    bot.once('spawn', () => {
        console.log(`🛰️ บอท [${username}] ออนไลน์สำเร็จ! กำลังทำออโต้ล็อกอิน...`);
        printStatus("🟢 ONLINE");

        // พิมพ์รหัสผ่านในแชทเมื่อเวลาผ่านไป 1.5 วินาที
        setTimeout(() => {
            if (bot) {
                bot.chat('/login 112233');
            }
        }, 1500);

        // คว้าเข็มทิศทวนสัญญาณหลังจากนั้น 5 วินาที
        setTimeout(async () => {
            if (!bot) return;
            triggerCompassSelectorMacro(bot);
        }, 5000);
    });

    bot.on('death', () => {
        printStatus("🟡 LOADING...");
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    // ดักจับกลไกเปิดหน้าต่าง GUI เพื่อจิ้มบล็อกหญ้าสล็อต 10 และพิมพ์ /home home
    bot.on('windowOpen', async (window) => {
        let windowTitle = 'ไม่ระบุชื่อเมนู';
        try {
            if (window.title) {
                if (typeof window.title === 'string') {
                    windowTitle = window.title.includes('{') ? JSON.parse(window.title).text || window.title : window.title;
                } else if (typeof window.title === 'object') {
                    windowTitle = window.title.text || (window.title.value && window.title.value.text && window.title.value.text.value) || JSON.stringify(window.title);
                }
            }
        } catch (e) { windowTitle = ''; }

        const titleClean = windowTitle.toLowerCase();

        if (titleClean.includes('login') || titleClean.includes('password') || titleClean.includes('กรอกรหัส') || titleClean.includes('รหัสผ่าน')) {
            const pinCode = [1, 1, 2, 2, 3, 3];
            for (let digit of pinCode) {
                if (!bot) return;
                let targetSlot = window.slots.findIndex(slot => slot && slot.displayName && slot.displayName.includes(digit.toString()));
                if (targetSlot === -1) { targetSlot = digit; }
                try {
                    await bot.clickWindow(targetSlot, 0, 0);
                    await sleep(600);
                } catch (err) {}
            }
            let confirmSlot = window.slots.findIndex(slot => slot && (slot.name.includes('green') || slot.name.includes('emerald') || slot.displayName.includes('ยืนยัน') || slot.displayName.includes('submit')));
            if (confirmSlot === -1) confirmSlot = window.slots.length - 1 - 9;
            try { await bot.clickWindow(confirmSlot, 0, 0); } catch (err) {}
            return;
        }

        // ดีเลย์ 1.5 วินาที แล้วทำการจิ้มสล็อตบล็อกหญ้า (ไอดี 10) เพื่อเข้าสู่มิติปกติ
        await sleep(1500);
        const targetSlotID = 10; 
        try {
            await bot.clickWindow(targetSlotID, 0, 0);
            
            // พอก้าวเข้าสู่ Spawn ย่อยเสร็จ สั่งพาเดินกลับจุดวาร์ปบ้านทันที
            setTimeout(() => {
                if (bot) {
                    console.log(`🏠 [${username}]: วาร์ปกลับพิกัดบ้านหลัก -> /home home`);
                    bot.chat('/home home');
                }
            }, 2500);
        } catch (clickErr) {}
    });

    bot.on('end', () => {
        bot = null; 
        printStatus("OFFLINE");
        // วนลูปเชื่อมต่อใหม่แบบออโต้เมื่อบอทหลุด
        setTimeout(() => { createBotInstance(); }, 10000);
    });
}

async function triggerCompassSelectorMacro(botInstance) {
    if (!botInstance || !botInstance.inventory) return;
    const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
    if (blueCompass) {
        try {
            await botInstance.equip(blueCompass, 'hand');
            await sleep(800); 
            await botInstance.activateItem();
        } catch (equipErr) {}
    }
}

// เริ่มต้นเปิดระบบงานรันตัวละคร
createBotInstance();