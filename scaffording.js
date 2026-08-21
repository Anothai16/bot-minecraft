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

function saveProgress(layer, startX, startY, startZ, currentX, endX) {
    if (!progressFilePath) return;
    try {
        const data = `${layer},${startX},${startY},${startZ},${currentX},${endX}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [layer, startX, startY, startZ, currentX, endX] = data.split(',');
        return {
            layer: parseInt(layer),
            startX: parseInt(startX),
            startY: parseInt(startY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
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
    bot.on('error', () => { buildActive = false; });
    bot.on('end', () => { 
        buildActive = false; 
        setTimeout(startBot, 10000); 
    });
}

// 🚶 เดินเข้าใกล้พิกัดแบบแม่นยำ
async function walkToPositionSync(targetPos) {
    if (!bot || !bot.entity || !buildActive) return false;

    const destination = new Vec3(targetPos.x + 0.5, targetPos.y, targetPos.z + 0.5);
    let attempts = 0;

    while (buildActive && bot && bot.entity && attempts < 40) {
        const currentPos = bot.entity.position;
        const dx = destination.x - currentPos.x;
        const dz = destination.z - currentPos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        if (dist2D <= 0.35) {
            bot.clearControlStates();
            return true;
        }

        bot.lookAt(new Vec3(destination.x, currentPos.y + 1.6, destination.z), true);
        bot.setControlState('forward', true);

        await new Promise(res => setTimeout(res, 40));
        attempts++;
    }

    bot.clearControlStates();
    return false;
}

// 🏊 ลอยตัวขึ้นไประดับ Y
async function swimUpToHeight(targetY) {
    if (!buildActive) return;
    log(`🏊 กำลังลอยตัวขึ้นไปที่ระดับความสูง Y:${targetY}...`);
    bot.setControlState('jump', true);
    let swimAttempts = 0;

    while (buildActive && bot && bot.entity && swimAttempts < 40) {
        if (bot.entity.position.y >= targetY - 0.2) break;
        await new Promise(res => setTimeout(res, 80));
        swimAttempts++;
    }
    bot.setControlState('jump', false);
    await new Promise(res => setTimeout(res, 100));
}

// 🧱 Sneak วางบล็อกจุดเริ่มต้น
async function placeStarterBlock(pos) {
    if (!buildActive) return false;

    const checkCurrent = bot.blockAt(pos, false);
    if (checkCurrent && checkCurrent.name === 'scaffolding') {
        log(`⏩ [SKIP] จุด (${pos.x}, ${pos.y}, ${pos.z}) มี Scaffolding อยู่แล้ว`);
        return true;
    }

    await equipScaffolding();
    const underPos = pos.offset(0, -1, 0);
    const underBlock = bot.blockAt(underPos, false);

    bot.setControlState('sneak', true);
    await new Promise(res => setTimeout(res, 80));

    if (underBlock && underBlock.name !== 'air') {
        try {
            await bot.lookAt(underPos.offset(0.5, 1.0, 0.5), true);
            await bot.placeBlock(underBlock, new Vec3(0, 1, 0));
            await new Promise(res => setTimeout(res, 80));
            log(`🟢 [START] วางบล็อกเริ่มต้นที่ (${pos.x}, ${pos.y}, ${pos.z}) สำเร็จ`);
        } catch (e) {}
    }
    bot.setControlState('sneak', false);
    return true;
}

// 🌉 เดินปูสะพาน Scaffolding ทีละบล็อกตามแนวแกน X
async function bridgeAlongX(fromX, toX, targetY, targetZ) {
    const stepX = fromX <= toX ? 1 : -1;
    let currentX = fromX;

    log(`🌉 เริ่มเดินปูสะพาน Scaffolding X:${fromX} -> X:${toX} (Y:${targetY})`);

    while (buildActive && bot && bot.entity) {
        if (getTotalScaffoldingCount() <= 0) {
            log('❌ Scaffolding หมดกระเป๋า!');
            buildActive = false;
            return false;
        }

        const standPos = new Vec3(currentX, targetY, targetZ);
        await walkToPositionSync(standPos);
        if (!buildActive) return false;

        // เช็กบล็อกเป้าหมายข้างหน้า
        if (currentX !== toX) {
            const nextX = currentX + stepX;
            const nextPos = new Vec3(nextX, targetY, targetZ);
            const nextBlock = bot.blockAt(nextPos, false);

            if (!nextBlock || nextBlock.name !== 'scaffolding') {
                await equipScaffolding();
                const standBlock = bot.blockAt(standPos, false);
                if (standBlock && standBlock.name === 'scaffolding') {
                    try {
                        const lookX = currentX + (stepX * 2);
                        await bot.lookAt(new Vec3(lookX + 0.5, targetY, targetZ + 0.5), true);
                        await bot.activateBlock(standBlock, new Vec3(stepX, 0, 0));
                        await new Promise(res => setTimeout(res, 60));
                    } catch (e) {}
                }
            }
        }

        if (currentX === toX) {
            log(`✅ ปูสะพานชั้น Y:${targetY} เสร็จสิ้นสมบูรณ์`);
            break;
        }
        currentX += stepX;
    }
    return buildActive;
}

// 🪽 กางปีก 6 บล็อก (เหนือ-ใต้)
async function deployWings(baseX, topY, baseZ) {
    if (!buildActive) return;
    const standBlock = bot.blockAt(new Vec3(baseX, topY, baseZ), false);
    if (!standBlock || standBlock.name !== 'scaffolding') return;

    // 1. ปีกทิศเหนือ (Z-)
    for (let i = 1; i <= 6; i++) {
        if (!buildActive || getTotalScaffoldingCount() <= 0) break;
        const targetWingPos = new Vec3(baseX, topY, baseZ - i);
        const existingBlock = bot.blockAt(targetWingPos, false);
        if (existingBlock && existingBlock.name === 'scaffolding') continue;

        await equipScaffolding();
        try {
            await bot.lookAt(new Vec3(baseX + 0.5, topY, baseZ - 3), true);
            await bot.activateBlock(standBlock, new Vec3(0, 0, -1));
            await new Promise(res => setTimeout(res, 50));
        } catch (e) {}
    }

    // 2. ปีกทิศใต้ (Z+)
    for (let i = 1; i <= 6; i++) {
        if (!buildActive || getTotalScaffoldingCount() <= 0) break;
        const targetWingPos = new Vec3(baseX, topY, baseZ + i);
        const existingBlock = bot.blockAt(targetWingPos, false);
        if (existingBlock && existingBlock.name === 'scaffolding') continue;

        await equipScaffolding();
        try {
            await bot.lookAt(new Vec3(baseX + 0.5, topY, baseZ + 3), true);
            await bot.activateBlock(standBlock, new Vec3(0, 0, 1));
            await new Promise(res => setTimeout(res, 50));
        } catch (e) {}
    }
}

// 🚀 ระบบคุมการทำงาน Layer-by-Layer
async function startScaffoldSystem(startX, startY, startZ, targetEndX = 10341) {
    buildActive = true;

    log(`\n🚀 ================= [ เริ่มต้นระบบปู Scaffolding ทีละชั้น ] =================`);
    log(`🎯 พิกัดเริ่ม: (${startX}, ${startY}, ${startZ}) -> ปลายทาง X: ${targetEndX}`);

    // ==========================================
    // 🧱 1. ทำแนวยาวชั้นที่ 1 ถึง 3 (Y+0, Y+1, Y+2)
    // ==========================================
    for (let layer = 0; layer < 3; layer++) {
        if (!buildActive) break;

        const currentY = startY + layer;
        const isForward = (layer % 2 === 0);
        const fromX = isForward ? startX : targetEndX;
        const toX = isForward ? targetEndX : startX;

        log(`\n🧱 [LAYER ${layer + 1}/4] เริ่มทำแนวยาวชั้น Y:${currentY} (จาก X:${fromX} ไป X:${toX})`);

        await swimUpToHeight(currentY + 0.5);
        if (!buildActive) break;

        await placeStarterBlock(new Vec3(fromX, currentY, startZ));
        if (!buildActive) break;

        const success = await bridgeAlongX(fromX, toX, currentY, startZ);
        if (!success || !buildActive) {
            log(`🛑 หยุดกระบวนการสร้างที่ชั้น Y:${currentY}`);
            return;
        }
    }

    // ==========================================
    // 🪽 2. ทำชั้นที่ 4 (Y+3) พร้อมกางปีก 6 บล็อก ซ้าย-ขวา
    // ==========================================
    if (buildActive) {
        const topY = startY + 3;
        log(`\n🪽 [LAYER 4/4] ขึ้นสู่ชั้นบนสุด Y:${topY} เพื่อปูสะพานและกางปีก 6 บล็อกสองฝั่ง`);

        await swimUpToHeight(topY + 0.5);
        if (buildActive) {
            await placeStarterBlock(new Vec3(startX, topY, startZ));
            
            const stepX = startX <= targetEndX ? 1 : -1;
            let currentX = startX;

            while (buildActive && bot && bot.entity) {
                if (getTotalScaffoldingCount() <= 0) {
                    log('❌ Scaffolding หมดกระเป๋า!');
                    break;
                }

                const standPos = new Vec3(currentX, topY, startZ);
                await walkToPositionSync(standPos);
                if (!buildActive) break;

                // วางสะพานแกน X ไปข้างหน้า
                if (currentX !== targetEndX) {
                    const nextPos = new Vec3(currentX + stepX, topY, startZ);
                    const nextBlock = bot.blockAt(nextPos, false);
                    if (!nextBlock || nextBlock.name !== 'scaffolding') {
                        const standBlock = bot.blockAt(standPos, false);
                        if (standBlock && standBlock.name === 'scaffolding') {
                            try {
                                await equipScaffolding();
                                const lookX = currentX + (stepX * 2);
                                await bot.lookAt(new Vec3(lookX + 0.5, topY, startZ + 0.5), true);
                                await bot.activateBlock(standBlock, new Vec3(stepX, 0, 0));
                                await new Promise(res => setTimeout(res, 50));
                            } catch (e) {}
                        }
                    }
                }

                // กางปีกซ้าย-ขวา
                await deployWings(currentX, topY, startZ);

                if (currentX === targetEndX) break;
                currentX += stepX;
            }
        }
    }

    if (buildActive) {
        log(`\n🎉 [ALL COMPLETED] ภารกิจเสร็จสิ้นสมบูรณ์! กำลังเดินกลับจุดเริ่มต้น...`);
        clearProgress();
        await walkToPositionSync(new Vec3(startX, startY + 3, startZ));
        log(`🏁 กลับถึงจุดเริ่มต้นเรียบร้อย!`);
    }

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

        startScaffoldSystem(startX, startY, startZ, endX);
    }
});

startBot();