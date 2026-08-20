const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { setupAmoryLogin } = require('./login');

let bot;
let buildActive = false;
let progressFilePath = '';

function log(msg) {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    console.log(`[${timestamp}] ${msg}`);
}

function saveProgress(layer, startX, startY, startZ, currentX, currentZ, endX) {
    if (!progressFilePath) return;
    try {
        const data = `${layer},${startX},${startY},${startZ},${currentX},${currentZ},${endX}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [layer, startX, startY, startZ, currentX, currentZ, endX] = data.split(',');
        return {
            layer: parseInt(layer),
            startX: parseInt(startX),
            startY: parseInt(startY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
            currentZ: parseInt(currentZ),
            endX: parseInt(endX)
        };
    } catch (e) { return null; }
}

function clearProgress() {
    try { if (progressFilePath && fs.existsSync(progressFilePath)) fs.unlinkSync(progressFilePath); } catch (e) {}
}

function getTotalScaffoldingCount() {
    if (!bot || !bot.inventory) return 0;
    const total = bot.inventory.items()
        .filter(item => item.name === 'scaffolding')
        .reduce((sum, item) => sum + item.count, 0);
    const held = bot.heldItem;
    const heldCount = (held && held.name === 'scaffolding') ? held.count : 0;
    return total + heldCount;
}

async function autoRefillScaffolding() {
    if (!bot || !bot.inventory) return false;

    let hasInHotbar = false;
    for (let slot = 0; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && item.name === 'scaffolding' && item.count > 0) {
            hasInHotbar = true;
            break;
        }
    }

    if (!hasInHotbar) {
        const backup = bot.inventory.items().find(item => item.name === 'scaffolding' && item.slot >= 9 && item.slot <= 35);
        if (backup) {
            bot.clearControlStates();
            try {
                await bot.moveSlotItem(backup.slot, 36); 
                await new Promise(res => setTimeout(res, 100));
                log(`📦 [REFILL] เติม Scaffolding ลง Hotbar เรียบร้อย`);
                return true;
            } catch (err) {}
        }
    }
    return hasInHotbar;
}

async function equipScaffolding() {
    if (bot.heldItem && bot.heldItem.name === 'scaffolding') return true;
    await autoRefillScaffolding();

    for (let slot = 0; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && item.name === 'scaffolding' && item.count > 0) {
            bot.setQuickBarSlot(slot);
            return true;
        }
    }
    return false;
}

function startBot() {
    log('🔌 กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com',
        username: 'Kelp_Kub_Umm',
        version: '1.21.11',
        viewDistance: 'tiny'
    });

    setupAmoryLogin(bot);
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        progressFilePath = path.join(__dirname, `progress_scaffold_${bot.username}.txt`);
        log(`🛰️ บอท [${bot.username}] ออนไลน์สำเร็จ พร้อมรับคำสั่ง!`);
    });

    bot.on('death', () => {
        buildActive = false;
        log('💀 บอทตาย! กำลังรอเกิดใหม่...');
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('kicked', () => { buildActive = false; });
    bot.on('error', (err) => { buildActive = false; });
    bot.on('end', () => { 
        buildActive = false; 
        setTimeout(startBot, 10000); 
    });
}

// 🚶 เดินเข้าใกล้พิกัด
async function walkToPositionSync(targetPos) {
    if (!bot || !bot.entity) return false;

    const destination = new Vec3(targetPos.x + 0.5, targetPos.y, targetPos.z + 0.5);
    let attempts = 0;

    while (buildActive && bot && bot.entity && attempts < 30) {
        const currentPos = bot.entity.position;
        const dx = destination.x - currentPos.x;
        const dz = destination.z - currentPos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        if (dist2D <= 0.6) {
            bot.clearControlStates();
            return true;
        }

        bot.lookAt(new Vec3(destination.x, currentPos.y + 1.6, destination.z), true);
        bot.setControlState('forward', true);
        bot.setControlState('sprint', true);

        await new Promise(res => setTimeout(res, 40));
        attempts++;
    }

    bot.clearControlStates();
    return false;
}

// 🧱 ฟังก์ชันวางบล็อก Scaffolding เดี่ยว
async function placeScaffoldBlock(targetPos) {
    if (!buildActive || getTotalScaffoldingCount() <= 0) return false;

    const currentBlock = bot.blockAt(targetPos, false);
    if (currentBlock && currentBlock.name === 'scaffolding') return true;

    await equipScaffolding();

    // เช็กบล็อกใต้เป้าหมาย
    const underPos = targetPos.offset(0, -1, 0);
    const underBlock = bot.blockAt(underPos, false);

    if (underBlock && underBlock.name !== 'air') {
        try {
            await bot.lookAt(underPos.offset(0.5, 1.0, 0.5), true);
            await bot.placeBlock(underBlock, new Vec3(0, 1, 0));
            await new Promise(res => setTimeout(res, 40));
            return true;
        } catch (e) {}
    }
    return false;
}

// 🚀 ระบบสร้างแบบ Layer-by-Layer
async function startLayerBuilder(startX, startY, startZ, targetEndX = 10341) {
    buildActive = true;
    const stepX = startX <= targetEndX ? 1 : -1;

    log(`\n🏗️ ================= [ เริ่มต้นระบบปู Scaffolding ทีละชั้น ] =================`);
    log(`🎯 พิกัด X: ${startX} -> ${targetEndX} | Y เริ่มต้น: ${startY} (สร้าง 4 ชั้น) | Z แกนกลาง: ${startZ}`);

    // ==========================================
    // 🧱 ขั้นที่ 1: ปูเสากลางชั้นที่ 1 ถึง 3 (Y+0, Y+1, Y+2)
    // ==========================================
    for (let layer = 0; layer < 3; layer++) {
        const currentY = startY + layer;
        const walkY = currentY; // บอทเดินบนชั้นเดิมที่เพิ่งวาง
        const isForward = (layer % 2 === 0);
        const fromX = isForward ? startX : targetEndX;
        const toX = isForward ? targetEndX : startX;
        const layerStepX = fromX <= toX ? 1 : -1;

        log(`\n🧱 [LAYER ${layer + 1}/4] ปูแนวเสากลางที่ความสูง Y:${currentY} (จาก X:${fromX} ไป X:${toX})`);

        let currentX = fromX;
        while (buildActive && bot && bot.entity) {
            if (getTotalScaffoldingCount() <= 0) {
                log('❌ Scaffolding หมดกระเป๋า! หยุดการทำงาน');
                clearProgress();
                buildActive = false;
                return;
            }

            // บอทยืนเยื้องด้านข้างแกน Z เล็กน้อยเพื่อเดินวางสะดวก
            const standPos = new Vec3(currentX, walkY, startZ + 1.1);
            await walkToPositionSync(standPos);

            const targetPos = new Vec3(currentX, currentY, startZ);
            await placeScaffoldBlock(targetPos);

            if (currentX === toX) break;
            currentX += layerStepX;
        }
    }

    // ==========================================
    // 🪽 ขั้นที่ 2: ปูชั้นบนสุด (ชั้นที่ 4: Y+3) แบบกางปีกเต็มแผ่น
    // Z: startZ - 6 (เหนือ) ถึง startZ + 6 (ใต้)
    // ==========================================
    const topY = startY + 3;
    const minZ = startZ - 6;
    const maxZ = startZ + 6;

    log(`\n🪽 [LAYER 4/4 - WINGS] ปูแผ่นกางปีกชั้นบนสุด Y:${topY} (Z จาก ${minZ} ถึง ${maxZ})`);

    let currentX = startX;
    while (buildActive && bot && bot.entity) {
        if (getTotalScaffoldingCount() <= 0) {
            log('❌ Scaffolding หมดกระเป๋า! หยุดการทำงาน');
            clearProgress();
            buildActive = false;
            return;
        }

        const xIndex = Math.abs(currentX - startX);
        const isNorthToSouth = (xIndex % 2 === 0);
        const fromZ = isNorthToSouth ? minZ : maxZ;
        const toZ = isNorthToSouth ? maxZ : minZ;
        const stepZ = fromZ <= toZ ? 1 : -1;

        let currentZ = fromZ;
        while (buildActive && bot && bot.entity) {
            const standPos = new Vec3(currentX, topY, currentZ + (stepZ * 0.8));
            await walkToPositionSync(standPos);

            const targetPos = new Vec3(currentX, topY, currentZ);
            await placeScaffoldBlock(targetPos);

            if (currentZ === toZ) break;
            currentZ += stepZ;
        }

        if (currentX === targetEndX) break;
        currentX += stepX;
    }

    log(`\n🎉 [ALL COMPLETED] ปู Scaffolding ครบทั้ง 4 ชั้นเรียบร้อย! กำลังเดินกลับจุดเริ่มต้น...`);
    clearProgress();
    await walkToPositionSync(new Vec3(startX, startY, startZ + 1.1));
    log(`🏁 กลับถึงจุดเริ่มต้นเรียบร้อย!`);

    if (bot) bot.clearControlStates();
    buildActive = false;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();

    if (input === 'tpa') {
        if (bot && bot.entity) {
            bot.chat('/tpa JaiyenKub');
            log('⚡ ยิงคำสั่ง: /tpa JaiyenKub สำเร็จ');
        }
        return;
    }

    if (input === 'stop' || input === 'c') {
        buildActive = false;
        if (bot) bot.clearControlStates();
        log('🛑 สั่งหยุดการทำงานทันที');
        return;
    }

    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1] || 10422);
        const startY = parseInt(args[2] || 211);
        const startZ = parseInt(args[3] || -5074);
        const endX = parseInt(args[4] || 10341);

        startLayerBuilder(startX, startY, startZ, endX);
    }
});

startBot();