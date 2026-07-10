const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

// 🎯 1. เรียกใช้งานโมดูลล็อกอินและเข้าเซิร์ฟย่อย Amory จากไฟล์ login.js กลาง
const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let isFishingActive = {};
let botDisplayStatus = {};

let accountList = [
    'snakefishfish',
];

// 🎯 [จุดที่แก้ไข]: ประกาศตัวแปรออบเจกต์เก็บโปรเซสบอทให้ครบถ้วน ป้องกัน ReferenceError
const bots = {}; 

// ตัวแปรเก็บประวัติตัวทุ่นและสถานะการเหวี่ยง
let currentBobberId = null;
let isWaitingForBite = false;
let canCatchNow = false; // ตัวแปรล็อก: ตัวเปิด/ปิด ระบบดักจับปลา
let logTrackerInterval = null; 
let ghostCastCheckTimeout = null; // ตัวแปรคอยส่องเบ็ดผี

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

// 🎣 [ฟังก์ชันส่งแรงเหวี่ยงเบ็ด + ระบบดักจับเบ็ดผีออโต้]
async function castLine(botInstance) {
    const name = botInstance.username;
    if (!isFishingActive[name]) return;

    // เคลียร์ค่าหน่วงเวลาเช็คเบ็ดผีตัวเก่าก่อนเริ่มรอบใหม่
    if (ghostCastCheckTimeout) clearTimeout(ghostCastCheckTimeout);

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

        // รีเซ็ตสถานะทุ่นรอบปัจจุบันก่อนส่งคำสั่ง
        currentBobberId = null;
        isWaitingForBite = true;
        canCatchNow = false; 

        // สั่งกดคลิกขวาเหวี่ยงเบ็ดออกไปจริง
        botInstance.activateItem();
        console.log(`🎣 [Fishing Core -> ${name}]: ส่งสัญญาณแพ็คเก็ตเหวี่ยงเบ็ดออกไปแล้ว... รอสแกนหาตัวทุ่น`);

        // หน่วงเวลาให้ทุ่นตกลงน้ำนิ่งสนิทก่อน ถึงจะเปิดเรดาร์ตรวจจับแกน Y
        setTimeout(() => {
            if (isWaitingForBite && currentBobberId !== null) {
                canCatchNow = true;
                console.log(`(ผิวน้ำนิ่งแล้ว ปลดล็อกระบบดักจับความสูง Y ของทุ่นเรียบร้อยครับพี่)`);
            }
        }, 2500);

        // 🎯 [ระบบเรดาร์ล่าเบ็ดผี]: เช็คหลังจากเหวี่ยงไป 4 วินาที ถ้า Log ทุ่นไม่วิ่ง สั่งโยนใหม่ทันที
        ghostCastCheckTimeout = setTimeout(() => {
            if (isFishingActive[name] && isWaitingForBite && currentBobberId === null) {
                console.log(`🚨 [Anti-Ghost Cast Triggered -> ${name}]: ตรวจพบอาการเบ็ดผี! (Log ทุ่นไม่ขึ้นใน 4 วินาที) สั่งถอนสายเปิดการเหวี่ยงใหม่ด่วนพี่!`);
                
                try { botInstance.activateItem(); } catch (e) {}
                
                setTimeout(() => {
                    castLine(botInstance);
                }, 800);
            }
        }, 4000);

    } catch (err) {}
}

// 🐟 [ฟังก์ชันดึงเบ็ดกลับ]
async function reelIn(botInstance, reason = "ไม่ระบุ") {
    const name = botInstance.username;
    if (!isWaitingForBite) return;
    
    if (ghostCastCheckTimeout) clearTimeout(ghostCastCheckTimeout); // ตัดคิวตรวจเบ็ดผีออกเพราะได้ปลาแล้ว
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
            
            if (canCatchNow && pos.y < 62.4) {
                reelIn(botInstance, `ตรวจพบระดับความสูงทุ่นจมต่ำกว่าเกณฑ์สเปกตัวเลขดิบ Y: ${pos.y.toFixed(3)}`);
            }
        }
    }, 200); 
}

function createBotInstance(username) {
    if (bots[username]) return; 

    botDisplayStatus[username] = "🟡 LOADING...";
    reportBotStatusToGui(username);
    
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: username,
        version: '1.21.11'
    });

    // 🎯 2. เรียกใช้งานระบบออโต้ล็อกอิน ฝ่าด่านสมุด และเข้าเซิร์ฟย่อยอัตโนมัติจากไฟล์ร่วม login.js
    setupAmoryLogin(bot);

    // จับคู่ ID ทุ่นเมื่อสปอว์นเกิด
    bot.on('entitySpawn', (entity) => {
        if (!isFishingActive[username]) return;
        if (entity.name === 'fishing_bobber' || entity.name === 'fishing_hook') {
            if (bot.entity && entity.position.distanceTo(bot.entity.position) < 16) {
                currentBobberId = entity.id;
                console.log(`🎯 [Radar Connected]: ล็อคเป้าไอดีทุ่นเกิดจริงบนผิวน้ำสำเร็จ -> ID: ${currentBobberId}`);
            }
        }
    });

    // ตรวจจับพิกัดแกน Y ดิบผ่านเอนทิตีเคลื่อนไหวคู่ขนาน
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
        console.log(`🛰️ บอท [snakefishfish] เหยียบพื้นผิวเซิร์ฟเวอร์สำเร็จ! ดึงโมดูลล็อกอินกลางทำงาน...`);
        botDisplayStatus[username] = "🟢 ONLINE";
        reportBotStatusToGui(username);
    });

    bot.on('death', () => {
        botDisplayStatus[username] = "🟡 LOADING...";
        reportBotStatusToGui(username);
        isFishingActive[username] = false; 
        isWaitingForBite = false;
        canCatchNow = false;
        if (logTrackerInterval) clearInterval(logTrackerInterval);
        if (ghostCastCheckTimeout) clearTimeout(ghostCastCheckTimeout);
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('end', () => {
        bots[username] = null; 
        botDisplayStatus[username] = "OFFLINE";
        isFishingActive[username] = false;
        isWaitingForBite = false;
        canCatchNow = false;
        if (logTrackerInterval) clearInterval(logTrackerInterval);
        if (ghostCastCheckTimeout) clearTimeout(ghostCastCheckTimeout);
        reportBotStatusToGui(username);
        pushToQueueEnd(username);
    });

    bots[username] = bot;
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