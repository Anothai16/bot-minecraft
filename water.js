const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');

const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let buildActive = false;
let forceSneakLocked = false;
let progressFilePath = '';

// ⏳ ฟังก์ชันดีเลย์อิสระ ป้องกันปัญหา TypeError บึ้มสคริปต์
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function saveProgress(startX, targetY, startZ, currentX, currentRound, totalRounds) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX},${currentRound},${totalRounds}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [startX, targetY, startZ, currentX, currentRound, totalRounds] = data.split(',');
        return {
            startX: parseInt(startX),
            targetY: parseInt(targetY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
            currentRound: parseInt(currentRound || 1),
            totalRounds: parseInt(totalRounds || 1)
        };
    } catch (e) { return null; }
}

function clearProgress() {
    try { if (progressFilePath && fs.existsSync(progressFilePath)) fs.unlinkSync(progressFilePath); } catch (e) {}
}

function getTotalIceCount() {
    if (!bot || !bot.inventory) return 0;
    return bot.inventory.items().filter(item => item.name === 'ice').reduce((sum, item) => sum + item.count, 0);
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', username: 'Water762', version: '1.21.1', viewDistance: 'tiny'  
    });

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles') {
                metadata.size = 0; return false; 
            }
        });
    }

    setupAmoryLogin(bot); bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
        console.log(`🛰️ บอท [${bot.username}] ออนไลน์สำเร็จ! พร้อมทำงานระบบเจาะรูวางน้ำแข็ง`);
    });

    let hasRecovered = false;
    bot.on('windowOpen', async (window) => {
        if (hasRecovered) return; hasRecovered = true;
        setTimeout(async () => {
            if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
            const savedData = loadProgress();
            if (savedData) {
                if (getTotalIceCount() <= 0) {
                    clearProgress(); buildActive = false; return;
                }
                await startMultiRoundIceBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData.totalRounds, savedData);
            }
        }, 12000);
    });

    bot.on('physicsTick', () => {
        if (!bot || !bot.entity) return;
        if (buildActive && forceSneakLocked) {
            bot.setControlState('sneak', true); bot.setControlState('sprint', false);
        } else { bot.setControlState('sneak', false); }
    });

    bot.on('death', () => { buildActive = false; setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000); });
    bot.on('end', () => { 
        buildActive = false; forceSneakLocked = false;
        const randomReconnectDelay = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
        setTimeout(startBot, randomReconnectDelay); 
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        if (message.startsWith('build')) {
            const args = message.split(' ');
            const startX = parseInt(args[1]); const startY = parseInt(args[2]); const startZ = parseInt(args[3]);
            const totalRounds = args[4] ? parseInt(args[4]) : 1;
            if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(totalRounds)) return;
            clearProgress(); await startMultiRoundIceBuilder(startX, startY, startZ, totalRounds);
        }
    });
}

function setupMovements(botInstance, currentZ = null) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false; 
    movements.allowParkour = false;
    movements.canDig = false; 
    movements.allowFreeMotion = false;
    
    // ดักห้ามทแยงเหยียบสล็อตหลุมฟาร์มรอบปัจจุบัน
    if (currentZ !== null) {
        movements.exclusionAreas = [
            (block) => block.position.z === currentZ,
            (block) => block.position.z === (currentZ + 5)
        ];
    }
    botInstance.pathfinder.setMovements(movements);
}

async function compactInventoryAndRefillHotbar() {
    console.log("🔄 [COMPACTOR]: กำลังจัดสล็อตเครื่องมือลง Hotbar...");

    const currentTool = bot.inventory.slots[36]; 
    if (!currentTool || (!currentTool.name.includes('pickaxe') && !currentTool.name.includes('shovel'))) {
        const toolInInv = bot.inventory.items().find(item => item.name.includes('pickaxe') || item.name.includes('shovel'));
        if (toolInInv) {
            await bot.clickWindow(toolInInv.slot, 0, 0); await delay(50);
            await bot.clickWindow(36, 0, 0); await delay(50);
        }
    }

    // ย้ายไอเทมอื่นออกจาก Hotbar สล็อต 2-8 เพื่อเติมน้ำแข็ง
    for (let slot = 2; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && item.name !== 'ice') {
            const destSlot = bot.inventory.firstEmptyInventorySlot();
            if (destSlot !== null && destSlot < 36) {
                await bot.clickWindow(36 + slot, 0, 0); await delay(50);
                await bot.clickWindow(destSlot, 0, 0); await delay(50);
            }
        }
    }

    // เติมน้ำแข็งลง Hotbar
    for (let slot = 2; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (!item) {
            const iceInInventory = bot.inventory.items().find(item => item.name === 'ice' && item.slot < 36);
            if (iceInInventory) {
                await bot.clickWindow(iceInInventory.slot, 0, 0); await delay(50);
                await bot.clickWindow(36 + slot, 0, 0); await delay(50);
            }
        }
    }
}

async function startMultiRoundIceBuilder(startX, targetY, startZ, totalRounds, recoveryData = null) {
    buildActive = true; 
    let currentRound = recoveryData ? recoveryData.currentRound : 1;
    
    for (let r = currentRound; r <= totalRounds; r++) {
        if (!buildActive) break;
        let activeRoundStartZ = startZ + ((r - 1) * 13);
        let activeStartX = (recoveryData && r === currentRound) ? recoveryData.currentX : startX;

        console.log(`\n🎰 ==================== [ 🎮 ROUND ${r} / ${totalRounds} ] ==================== 🎰`);
        console.log(`📐 พิกัดฐานงานรอบนี้ -> Z เริ่มต้น: ${activeRoundStartZ}`);

        setupMovements(bot, activeRoundStartZ);
        const success = await executeSingleLineBuilder(startX, activeStartX, targetY, activeRoundStartZ, r, totalRounds);
        
        if (!success || !buildActive) break;

        console.log(`🎉 จบรอบที่ ${r} สำเร็จถล่มทลาย!`);
        
        if (r < totalRounds) {
            console.log(`🛰️ [🔀 MATRIX ROUTER]: กำลังเปิดใช้คิวเดินอ้อมหลุมสี่ทิศทางสัมบูรณ์...`);
            
            if (bot && bot.entity) {
                setupMovements(bot);
                
                let currentBotX = Math.floor(bot.entity.position.x);
                let currentBotZ = Math.floor(bot.entity.position.z);

                let safeEscapeX = currentBotX - 3;
                console.log(`🚶‍♂️ 1. [WEST] เดินเบี่ยงหลบออกจากปากรูท้ายขบวน ไปยังแกน X: ${safeEscapeX}`);
                await bot.pathfinder.goto(new GoalBlock(safeEscapeX, targetY + 1, currentBotZ));
                await delay(200);

                let outsideCorridorZ = currentBotZ + 6;
                console.log(`🚶‍♂️ 2. [SOUTH] หักศอกอ้อมออกเลนนอกแนวดิ่ง ไปยังแกน Z: ${outsideCorridorZ}`);
                await bot.pathfinder.goto(new GoalBlock(safeEscapeX, targetY + 1, outsideCorridorZ));
                await delay(200);

                let safeHeadX = startX + 3;
                console.log(`🏃‍♂️ 3. [WEST] วิ่งรางยาวเลนนอกย้อนกลับไปคลังหัวแถว ไปยังแกน X: ${safeHeadX}`);
                await bot.pathfinder.goto(new GoalBlock(safeHeadX, targetY + 1, outsideCorridorZ));
                await delay(200);

                let nextRoundStartZ = startZ + (r * 13);
                let nextRoundFirstHoleZ = nextRoundStartZ + 1;
                
                console.log(`🚶‍♂️ 4. [SOUTH] หักศอกเข้าประจำการแนวปากรูของเลนรอบใหม่ พิกัด Z: ${nextRoundFirstHoleZ}`);
                await bot.pathfinder.goto(new GoalBlock(startX, targetY + 1, nextRoundFirstHoleZ));
                await delay(300);
            }
            console.log(`🛰️ จัดรูปขานิ่งประจำหัวเลนรอบที่ ${r + 1} เรียบร้อย ไร้รอยต่อร่วงหลุมครับพี่!`);
        }
    }
    buildActive = false;
}

async function executeSingleLineBuilder(baseStartX, currentX, targetY, roundStartZ, currentRound, totalRounds) {
    const endX = -2642; 
    while (buildActive && bot && bot.entity) {
        if (getTotalIceCount() <= 0) {
            console.log(`❌ [⚡ STOP BUILDING]: น้ำแข็งหมดคลัง งดการทำงานทันที`);
            clearProgress(); buildActive = false; return false;
        }

        if (currentX >= endX) return true;
        saveProgress(baseStartX, targetY, roundStartZ - ((currentRound - 1) * 13), currentX, currentRound, totalRounds);

        const breakPos1 = new Vec3(currentX, targetY, roundStartZ);       
        const breakPos2 = new Vec3(currentX, targetY, roundStartZ + 5);   

        // 🟢 หลุมที่ 1 (ทิศเหนือ): ยืนแนวปากรู Z+1
        if (bot && bot.entity) {
            const safeGoal1 = new Vec3(currentX, targetY + 1, roundStartZ + 1);
            try { await bot.pathfinder.goto(new GoalBlock(safeGoal1.x, safeGoal1.y, safeGoal1.z)); } catch (e) {}
        }
        if (bot) bot.clearControlStates(); await delay(250); 
        if (buildActive) { await compactInventoryAndRefillHotbar(); await pureIceCrusherEngine(breakPos1, 'north'); }

        // 🔵 หลุมที่ 2 (ทิศใต้): ยืนระนาบ Z+4 จ่อปากรูพอดี
        if (buildActive && bot && bot.entity) {
            const safeGoal2 = new Vec3(currentX, targetY + 1, roundStartZ + 4);
            try { await bot.pathfinder.goto(new GoalBlock(safeGoal2.x, safeGoal2.y, safeGoal2.z)); } catch (e) {}
        }
        if (bot) bot.clearControlStates(); await delay(250); 
        if (buildActive) { await compactInventoryAndRefillHotbar(); await pureIceCrusherEngine(breakPos2, 'south'); }

        currentX += 9; if (currentX > endX) currentX = endX;
        await delay(200);
    }
    return false;
}

async function pureIceCrusherEngine(targetPos, holeDirection) {
    if (!bot || !bot.entity) return;

    try {
        let block = bot.blockAt(targetPos);
        
        // 1. ตรวจสอบว่าถ้ามีน้ำ/น้ำไหลอยู่แล้ว ให้ข้ามได้เลย
        if (block && (block.name === 'water' || block.name === 'flowing_water')) {
            console.log(`✨ [SKIP]: มีน้ำสมบูรณ์อยู่แล้ว ข้ามหลุมครับ!`); 
            return;
        }

        // 2. ทุบบล็อกดิน/หญ้าออก
        if (block && (block.name.includes('dirt') || block.name.includes('grass') || block.name === 'farmland' || block.name.includes('podzol') || block.name.includes('mycelium'))) {
            console.log(`🪓 [ENGINE]: ตรวจพบบล็อกดิน [${block.name}] กำลังทุบออก...`);
            await bot.setQuickBarSlot(0); await delay(60);
            try { await bot.dig(block); await delay(150); } catch (e) { return; }
        }

        // 3. กำหนดผนังอ้างอิงสำหรับวางน้ำแข็ง
        let wallPos, faceVector;
        if (holeDirection === 'north') {
            wallPos = new Vec3(targetPos.x, targetPos.y, targetPos.z - 1);
            faceVector = new Vec3(0, 0, 1);
        } else {
            wallPos = new Vec3(targetPos.x, targetPos.y, targetPos.z + 1);
            faceVector = new Vec3(0, 0, -1);
        }

        const targetWall = bot.blockAt(wallPos);
        if (!targetWall) { console.log(`⚠️ ไม่พบผนังอ้างอิง ข้ามหลุมครับ`); return; }

        // 4. ค้นหาน้ำแข็งใน Hotbar
        let hotbarIceSlot = -1;
        for (let slot = 2; slot < 9; slot++) {
            const item = bot.inventory.slots[36 + slot];
            if (item && item.name === 'ice') { hotbarIceSlot = slot; break; }
        }
        if (hotbarIceSlot === -1) return;

        // 5. วางน้ำแข็ง
        await bot.setQuickBarSlot(hotbarIceSlot); await delay(80);
        await bot.lookAt(targetWall.position.offset(0.5, 0.5, 0.5), true); await delay(100);
        console.log(`🧊 [ENGINE]: แปะวางบล็อกน้ำแข็งที่ [X:${targetPos.x} Y:${targetPos.y} Z:${targetPos.z}]`);
        try {
            await bot.activateBlock(targetWall, faceVector, new Vec3(0.5, 0.5, 0.5));
            bot.swingArm('hand');
        } catch (e) { console.log(`วางน้ำแข็งขัดข้อง: ${e.message}`); return; }
        await delay(150);

        // 6. ทุบน้ำแข็งให้ละลายกลายเป็นน้ำ
        let placedIce = bot.blockAt(targetPos);
        if (placedIce && placedIce.name === 'ice') {
            console.log("🪓 [ENGINE]: สับ Pickaxe/Shovel ทุบน้ำแข็งละลายกลายเป็นน้ำ!");
            await bot.setQuickBarSlot(0); await delay(60); 
            try { await bot.dig(placedIce); } catch (e) { return; }
            await delay(150); 
        }

    } catch (err) { console.log(`📡 Debug บั๊กขัดข้องภายใน: ${err.message}`); }
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'c') {
        buildActive = false; clearProgress();
        if (bot && bot.pathfinder) {
            try { bot.pathfinder.stop(); } catch(e) {}
            try { bot.clearControlStates(); } catch(e) {}
        }
        return;
    }
    if (input === 'tpa') {
        if (bot && bot.entity) { bot.chat('/tpa DukDikauai'); } return;
    }
    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]); const startY = parseInt(args[2]); const startZ = parseInt(args[3]);
        const totalRounds = args[4] ? parseInt(args[4]) : 1;
        if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(totalRounds)) return;
        clearProgress(); await startMultiRoundIceBuilder(startX, startY, startZ, totalRounds);
    }
});