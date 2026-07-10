const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

const { GoalBlock } = goals;

let accountList = [
    'tutipong',
];

const bots = {}; 
const botDisplayStatus = {}; 
const isFishingActive = {};

// ตัวแปรเก็บประวัติตัวทุ่นและสถานะการเหวี่ยง
let currentBobberId = null;
let isWaitingForBite = false;
let canCatchNow = false; // ตัวแปรล็อก: ตัวเปิด/ปิด ระบบดักจับปลา
let logTrackerInterval = null; 

accountList.forEach(name => {
    botDisplayStatus[name] = "OFFLINE";
    isFishingActive[name] = false;
});

process.on('uncaughtException', (err) => {
    if (!err) return;
    try {
        const errString = err.toString() || '';
        if (
            errString.includes('PartialReadError') || 
            errString.includes('particles') || 
            errString.includes('protodef') ||
            errString.includes('fishing') ||
            errString.includes('type')
        ) {
            return; 
        }
    } catch (e) { return; }
    console.error('⚠️ [System Uncaught Error]:', err);
});

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function reportBotStatusToGui(username) {
    console.log(`BIT_DATA:${JSON.stringify({
        username: username,
        status: botDisplayStatus[username] || "OFFLINE",
        bits: 0 
    })}`);
}

function pushToQueueEnd(username) {
    const index = accountList.indexOf(username);
    if (index !== -1) {
        accountList.splice(index, 1);
        accountList.push(username);
    }
}

// 🎣 [ฟังก์ชันส่งแรงเหวี่ยงเบ็ด]
async function castLine(botInstance) {
    const name = botInstance.username;
    if (!isFishingActive[name]) return;

    try {
        const fishingRod = botInstance.inventory.items().find(item => item.name === 'fishing_rod');
        if (!fishingRod) {
            console.log(`❌ [Fishing Core -> ${name}]: หาเบ็ดตกปลาไม่เจอ! ปิดระบบ...`);
            isFishingActive[name] = false;
            return;
        }

        if (fishingRod.durabilityUsed !== undefined) {
            const maxDurability = 64; 
            const currentDurability = maxDurability - fishingRod.durabilityUsed;
            if (currentDurability <= 5) { 
                console.log(`⚠️ [Durability Warning -> ${name}]: เบ็ดใกล้พังแล้ว! หยุดตกปลาเซฟของครับพี่!`);
                isFishingActive[name] = false;
                return;
            }
        }

        await botInstance.equip(fishingRod, 'hand');
        await sleep(400);

        const targetYawDeg = -89.1;
        const targetPitchDeg = -3.3;
        await botInstance.look(targetYawDeg * (Math.PI / 180), targetPitchDeg * (Math.PI / 180), true); 
        await sleep(600);

        // รีเซ็ตสถานะ
        currentBobberId = null;
        isWaitingForBite = true;
        canCatchNow = false; // ล็อกระบบไว้ก่อนกันกระตุกกลางอากาศ

        // สั่งกดคลิกขวาเหวี่ยงเบ็ดออกไป
        botInstance.activateItem();
        console.log(`🎣 [Fishing Core -> ${name}]: เหวี่ยงทุ่นเบ็ดออกไปแล้ว... รอทุ่นตกถึงผิวน้ำนิ่งสนิท...`);

        // หน่วงเวลาให้ทุ่นตกลงน้ำนิ่งสนิทก่อน ถึงจะเปิดเรดาร์ตรวจจับ
        setTimeout(() => {
            if (isWaitingForBite) {
                canCatchNow = true;
                console.log(`(ผิวน้ำนิ่งแล้ว ปลดล็อกระบบดักจับความสูง Y ของทุ่นแล้วครับพี่)`);
            }
        }, 2500);

    } catch (err) {}
}

// 🐟 [ฟังก์ชันดึงเบ็ดกลับ]
async function reelIn(botInstance, reason = "ไม่ระบุ") {
    const name = botInstance.username;
    if (!isWaitingForBite) return;
    
    isWaitingForBite = false;
    canCatchNow = false;
    currentBobberId = null; 
    console.log(`🐟 [Fishing Core -> ${name}]: ⚡ สับดึงเบ็ดกลับทันที! เหตุผล: [${reason}]`);
    
    try {
        botInstance.activateItem(); 
    } catch (e) {}

    await sleep(2000); 
    if (isFishingActive[name]) {
        castLine(botInstance); 
    }
}

// 🎯 [ระบบพ่นข้อมูลรายงานหน้างาน]
function startLogTracker(botInstance) {
    if (logTrackerInterval) clearInterval(logTrackerInterval);

    logTrackerInterval = setInterval(() => {
        if (!isWaitingForBite || !botInstance.entity) return;

        if (currentBobberId && botInstance.entities[currentBobberId]) {
            const bobberEntity = botInstance.entities[currentBobberId];
            const pos = bobberEntity.position;
            const vel = bobberEntity.velocity;
            console.log(`🔍 [ทุ่น Log Tracker]: ID: ${currentBobberId} | ความสูง Y: ${pos.y.toFixed(3)} | ความเร็วดิ่ง Y: ${vel.y.toFixed(4)} | พร้อมสับไหม: ${canCatchNow}`);
            
            // 🎯 [ขุมพลังแผนหลักใหม่ตามสั่งพี่]: ถ้าปลดล็อกระบบแล้ว แถมนอนเฝ้าเจอค่าความสูง Y จมต่ำกว่า 62.4 เมื่อไหร่ สั่งดึงเบ็ดทันที!
            if (canCatchNow && pos.y < 62.4) {
                reelIn(botInstance, `ตรวจพบระดับความสูงทุ่นจมต่ำกว่าเกณฑ์สเปกตัวเลขดิบ Y: ${pos.y.toFixed(3)}`);
            }
        }
    }, 200); // เพิ่มความถี่ในการวนเช็คเป็นทุกๆ 0.2 วินาที เพื่อให้สับเบ็ดได้ไวสะใจขึ้นครับ
}

function createBotInstance(username) {
    if (bots[username]) return; 

    botDisplayStatus[username] = "🟡 LOADING...";
    reportBotStatusToGui(username);
    
    const bot = mineflayer.createBot({ 
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

    // จับคู่ ID ทุ่น
    bot.on('entitySpawn', (entity) => {
        if (!isFishingActive[username]) return;
        if (entity.name === 'fishing_bobber' || entity.name === 'fishing_hook') {
            if (bot.entity && entity.position.distanceTo(bot.entity.position) < 16) {
                currentBobberId = entity.id;
                console.log(`🎯 [Radar Connected]: ล็อคเป้าไอดีทุ่น -> ID: ${currentBobberId}`);
            }
        }
    });

    // 🎯 [ระบบดักจับคู่ขนานผ่านแพ็คเก็ตเคลื่อนไหว (Moved Event)]: 
    // ตรวจจับพิกัดแกน Y ดิบ หากทุ่นขยับตัวร่วงต่ำกว่า 62.4 สั่งดึงเบ็ดคู่ขนานทันทีเพื่อความชัวร์
    bot.on('entityMoved', (entity) => {
        if (!isFishingActive[username] || !isWaitingForBite || !canCatchNow || !currentBobberId) return;

        if (entity.id === currentBobberId) {
            if (entity.position && entity.position.y < 62.4) {
                reelIn(bot, `ตรวจพบทุ่นเคลื่อนไหวขยับตำแหน่งแกน Y ต่ำกว่าเกณฑ์ดิบ: ${entity.position.y.toFixed(3)}`);
            }
        }
    });

    bot.loadPlugin(pathfinder);

    bot.on('error', (err) => {
        pushToQueueEnd(username);
    });

    bot.once('spawn', () => {
        console.log(`🛰️ บอท [snakefishfish] เหยียบพื้นผิวเซิร์ฟเวอร์สำเร็จ!`);
        botDisplayStatus[username] = "🟢 ONLINE";
        reportBotStatusToGui(username);

        setTimeout(() => {
            if (bots[username]) {
                console.log(`✍️ [Auto Login]: พิมพ์รหัสผ่านทางแชทเซฟตี้ -> /login 112233`);
                bots[username].chat('/login 112233');
            }
        }, 1500);

        setTimeout(async () => {
            if (!bots[username]) return;
            console.log(`📡 [AI Watchdog]: บอทเริ่มกลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกม...`);
            triggerCompassSelectorMacro(bots[username]);
        }, 5000);
    });

    bot.on('death', () => {
        botDisplayStatus[username] = "🟡 LOADING...";
        reportBotStatusToGui(username);
        isFishingActive[username] = false; 
        isWaitingForBite = false;
        canCatchNow = false;
        if (logTrackerInterval) clearInterval(logTrackerInterval);
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

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
                if (!bots[username]) return;
                let targetSlot = window.slots.findIndex(slot => slot && slot.displayName && slot.displayName.includes(digit.toString()));
                if (targetSlot === -1) { targetSlot = digit; }
                try {
                    await bot.clickWindow(targetSlot, 0, 0);
                    await sleep(600);
                } catch (err) {}
            }
            let confirmSlot = window.slots.findIndex(slot => slot && (slot.name.includes('green') || slot.name.includes('emerald') || slot.displayName.includes('ยืนยัน') || slot.displayName.includes('submit')));
            if (confirmSlot === -1) confirmSlot = window.slots.length - 1 - 9;
            try {
                await bot.clickWindow(confirmSlot, 0, 0);
            } catch (err) {}
            return;
        }

        await sleep(1500);
        const targetSlotID = 10; 
        const targetItem = window.slots[targetSlotID];

        if (targetItem) {
            try {
                await bot.clickWindow(targetSlotID, 0, 0);
                console.log(`🚀 [Success]: ส่งคำสั่งคลิกซ้ายสล็อตบล็อกหญ้าเรียบร้อย!`);
                
                setTimeout(() => {
                    if (bots[username]) {
                        console.log(`✍️ [Auto Action]: เข้าสู่ Spawn Server สมบูรณ์! ยิงมาโครพาวาร์ป -> /home home`);
                        bots[username].chat('/home home');
                    }
                }, 2500);
            } catch (clickErr) {}
        } else {
            try {
                await bot.clickWindow(targetSlotID, 0, 0);
                setTimeout(() => {
                    if (bots[username]) {
                        bots[username].chat('/home home');
                    }
                }, 2500);
            } catch (fErr) {}
        }
    });

    bot.on('end', () => {
        bots[username] = null; 
        botDisplayStatus[username] = "OFFLINE";
        isFishingActive[username] = false;
        isWaitingForBite = false;
        canCatchNow = false;
        if (logTrackerInterval) clearInterval(logTrackerInterval);
        reportBotStatusToGui(username);
        pushToQueueEnd(username);
    });

    bots[username] = bot;
}

async function triggerCompassSelectorMacro(botInstance) {
    if (!botInstance || !botInstance.inventory) return;
    const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
    if (blueCompass) {
        try {
            await botInstance.equip(blueCompass, 'hand');
            await sleep(800); 
            await botInstance.activateItem();
            console.log(`✅ คลิกขวาเข็มทิศสำเร็จ รอกล่องเมนูตอบรับเด้งขึ้นหน้าจอ...`);
        } catch (equipErr) {}
    }
}

createBotInstance('snakefishfish');

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'fish') {
        const targetBotKey = 'snakefishfish'; 
        const targetBot = bots[targetBotKey];
        if (targetBot && botDisplayStatus[targetBotKey] === "🟢 ONLINE") {
            if (!isFishingActive[targetBotKey]) {
                isFishingActive[targetBotKey] = true;
                castLine(targetBot);
                startLogTracker(targetBot); 
            }
        }
    }
});