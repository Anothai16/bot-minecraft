const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { setupAmoryLogin } = require('./login');

let bot;
let buildActive = false;
let progressFilePath = '';

function saveProgress(startX, targetY, startZ, currentX, currentZ, endX) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX},${currentZ},${endX}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [startX, targetY, startZ, currentX, currentZ, endX] = data.split(',');
        return {
            startX: parseInt(startX),
            targetY: parseInt(targetY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
            currentZ: parseInt(currentZ),
            endX: endX ? parseInt(endX) : null
        };
    } catch (e) { return null; }
}

function clearProgress() {
    try { if (progressFilePath && fs.existsSync(progressFilePath)) fs.unlinkSync(progressFilePath); } catch (e) {}
}

function getTotalKelpCount() {
    if (!bot || !bot.inventory) return 0;
    const kelpTotal = bot.inventory.items()
        .filter(item => item.name === 'kelp')
        .reduce((sum, item) => sum + item.count, 0);
    const held = bot.heldItem;
    const heldCount = (held && held.name === 'kelp') ? held.count : 0;
    return kelpTotal + heldCount;
}

// 🌿 เติม Kelp ลง Hotbar อัตโนมัติ (พร้อมรอ Sync แน่นอน)
async function autoRefillKelpFromInventory() {
    if (!bot || !bot.inventory) return false;

    let hasKelpInHotbar = false;
    for (let slot = 0; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && item.name === 'kelp' && item.count > 0) {
            hasKelpInHotbar = true;
            break;
        }
    }

    if (!hasKelpInHotbar) {
        const backupKelp = bot.inventory.items().find(item => item.name === 'kelp' && item.slot >= 9 && item.slot <= 35);
        if (backupKelp) {
            console.log(`📦 [REFILL] Kelp ใน Hotbar หมด! กำลังย้าย Kelp จากช่องกระเป๋าที่ ${backupKelp.slot} มาลง Hotbar...`);
            bot.clearControlStates();
            await new Promise(res => setTimeout(res, 100));

            try {
                await bot.moveSlotItem(backupKelp.slot, 36); 
                await new Promise(res => setTimeout(res, 300)); // หน่วงเวลารอเซิร์ฟเวอร์ Sync สแตกใหม่
                console.log(`✅ [REFILL SUCCESS] ย้าย Kelp สแตกใหม่ลง Hotbar เรียบร้อย!`);
                return true;
            } catch (err) {
                console.log(`⚠️ [REFILL ERROR] ย้าย Kelp ล้มเหลว: ${err.message}`);
            }
        }
    }
    return hasKelpInHotbar;
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com',
        username: 'Kelp_Kub_Umm',
        version: '1.21.11',
        viewDistance: 'tiny'
    });

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles') {
                metadata.size = 0;
                return false; 
            }
        });
    }

    setupAmoryLogin(bot);
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        progressFilePath = path.join(__dirname, `progress_kelp_${bot.username}.txt`);
        console.log(`🛰️ บอท [${bot.username}] ออนไลน์สำเร็จ!`);
        console.log(`👉 พิมพ์ 'build -2763 128 14634' หรือ 'build -2770 128 14634' ใน Terminal ได้เลยครับพี่`);
    });

    let hasRecovered = false;
    bot.on('windowOpen', async (window) => {
        if (hasRecovered) return;
        hasRecovered = true;
        setTimeout(async () => {
            if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_kelp_${bot.username}.txt`);
            const savedData = loadProgress();
            if (savedData && getTotalKelpCount() > 0) {
                console.log('🔄 [AUTO RECOVERY]: ตรวจพบประวัติค้าง รันวาง Kelp ต่ออัตโนมัติ...');
                await startKelpPlatformBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData);
            }
        }, 12000);
    });

    bot.on('death', () => {
        buildActive = false;
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('kicked', (reason) => { buildActive = false; });
    bot.on('error', (err) => { buildActive = false; });

    bot.on('end', () => { 
        buildActive = false; 
        const randomReconnectDelay = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
        setTimeout(startBot, randomReconnectDelay); 
    });
}

// 🌿 สั่งเดินจ่อเข้าพิกัดเป้าหมาย
async function walkToPositionSync(targetPos) {
    if (!bot || !bot.entity) return false;

    const destination = new Vec3(targetPos.x + 0.5, targetPos.y + 1, targetPos.z + 0.5);
    let attempts = 0;
    bot.setControlState('sprint', false);

    while (buildActive && bot && bot.entity && attempts < 35) {
        const currentPos = bot.entity.position;
        const dx = destination.x - currentPos.x;
        const dz = destination.z - currentPos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        if (dist2D <= 1.2) {
            bot.clearControlStates();
            return true;
        }

        await bot.lookAt(destination, true);
        bot.setControlState('forward', true);

        await new Promise(res => setTimeout(res, 80));
        attempts++;
    }

    bot.clearControlStates();
    return false;
}

// 🌿 ระบบควบคุมการวาง Kelp กวาด 3X แบบ Dynamic Target
async function startKelpPlatformBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;

    let endX;
    if (recoveryData && recoveryData.endX) {
        endX = recoveryData.endX;
    } else {
        endX = startX - 5;
    }

    const endZBoundary = 14545; 
    const stepX = startX <= endX ? 3 : -3;

    let currentX = recoveryData ? recoveryData.currentX : startX;

    console.log(`\n🌿 ================= [ KELP SNAKE PLACER ACTIVE (3X DYNAMIC) ] =================`);
    console.log(`🎯 เริ่มพิกัดแกนหลัก X: ${startX} -> ${endX} (กวาดกว้างทีละ 3X) | Z: ${startZ} <-> ${endZBoundary} | Y: ${targetY}`);

    while (buildActive && bot && bot.entity) {
        if (getTotalKelpCount() <= 0) {
            console.log(`❌ Kelp หมดกระเป๋า! หยุดการทำงาน`);
            clearProgress();
            buildActive = false;
            break;
        }

        const xIndex = Math.floor(Math.abs(currentX - startX) / 3);
        const isForwardZ = (xIndex % 2 === 0);

        const rowStartZ = isForwardZ ? startZ : endZBoundary;
        const rowEndZ = isForwardZ ? endZBoundary : startZ;
        const stepZ = rowStartZ <= rowEndZ ? 1 : -1;

        let currentZ = (recoveryData && recoveryData.currentX === currentX) ? recoveryData.currentZ : rowStartZ;

        console.log(`\n📍 [ลู่เดิน X: ${currentX}] เริ่มกวาด 3X บนแกน Z จาก ${currentZ} มุ่งหน้าไป ${rowEndZ}`);

        while (buildActive && bot && bot.entity) {
            saveProgress(startX, targetY, startZ, currentX, currentZ, endX);

            if (getTotalKelpCount() <= 0) break;

            const centerWalkPos = new Vec3(currentX, targetY, currentZ);

            // 1. ตรวจเช็กและเติม Kelp เข้า Hotbar ก่อนเริ่มสเต็ป
            await autoRefillKelpFromInventory();

            // 2. เดินไปประจำจุดกวาดที่แกน Z ปัจจุบัน
            await walkToPositionSync(centerWalkPos);

            // 🎯 3. กวาดวาง 3 X ไปในทิศทางเดียวกับ stepX (ไม่ย้อนกลับไปเกยลู่เก่า)
            const dir = stepX > 0 ? 1 : -1;
            const sweepOffsets = [0, 1 * dir, 2 * dir]; 

            for (const offsetX of sweepOffsets) {
                if (!buildActive || getTotalKelpCount() <= 0) break;
                const sweepPos = new Vec3(currentX + offsetX, targetY, currentZ);
                await placeKelpWithLook(sweepPos);
            }

            // ถึงปลายทาง Z ของแถวนี้แล้วหรือยัง
            if (currentZ === rowEndZ) {
                bot.clearControlStates();
                break;
            }

            currentZ += stepZ;
        }

        // เช็กว่าขยับสุดแกน X หรือยัง
        if ((stepX > 0 && currentX >= endX) || (stepX < 0 && currentX <= endX)) {
            console.log('\n🏆 [ALL COMPLETED] วาง Kelp ครบทุกแถวกวาดซิกแซกเรียบร้อยครับพี่!');
            clearProgress();
            break;
        }

        currentX += stepX;
        recoveryData = null; 
    }

    if (bot) bot.clearControlStates();
    buildActive = false;
}

// 🌿 ฟังก์ชันวาง Kelp แบบล็อกรอการเติมของ (ป้องกันการข้ามพิกัด)
async function placeKelpWithLook(targetPos) {
    if (!bot || !bot.entity) return;

    const targetPosStr = `X:${targetPos.x} Y:${targetPos.y} Z:${targetPos.z}`;

    try {
        const targetBlock = bot.blockAt(targetPos, true);
        const refBlockPos = targetPos.offset(0, -1, 0);
        const refBlock = bot.blockAt(refBlockPos, true);

        // 1. เช็กว่ามี Kelp วางอยู่แล้วไหม
        if (targetBlock && (targetBlock.name === 'kelp' || targetBlock.name === 'kelp_plant')) {
            return;
        }

        // 2. เช็กว่ามีบล็อกพื้นแข็งรองรับไหม
        if (!refBlock || refBlock.name === 'air' || refBlock.name === 'water') {
            console.log(`⚠️ [SKIP - NO BASE] ${targetPosStr} | พื้นด้านล่าง (Y-1) เป็น '${refBlock ? refBlock.name : 'null'}'`);
            return;
        }

        // 🎯 3. ตรวจเช็ก Kelp ในมือ (หากหมด ให้พยายามดึงมาเติมแล้ว Retry ห้ามข้ามพิกัด!)
        let retryCount = 0;
        while ((!bot.heldItem || bot.heldItem.name !== 'kelp') && retryCount < 3) {
            console.log(`🔄 [RETRY REFILL] ${targetPosStr} | Kelp ในมือหมดชั่วคราว รอ Sync เติมสแตกใหม่... (พยายามครั้งที่ ${retryCount + 1})`);
            
            await autoRefillKelpFromInventory();

            let kelpSlot = -1;
            for (let slot = 0; slot < 9; slot++) {
                const item = bot.inventory.slots[36 + slot];
                if (item && item.name === 'kelp' && item.count > 0) {
                    kelpSlot = slot;
                    break;
                }
            }

            if (kelpSlot !== -1) {
                bot.setQuickBarSlot(kelpSlot);
                await new Promise(res => setTimeout(res, 150));
            } else {
                await new Promise(res => setTimeout(res, 300));
            }
            retryCount++;
        }

        // ถ้าพยายามเติมแล้ว 3 รอบยังไม่มี Kelp เหลือในตัวจริงๆ ให้หยุดการทำงาน
        if (!bot.heldItem || bot.heldItem.name !== 'kelp') {
            if (getTotalKelpCount() <= 0) {
                console.log(`❌ [OUT OF KELP] Kelp ในกระเป๋าหมดเกลี้ยงแล้ว!`);
            }
            return;
        }

        const dist = bot.entity.position.distanceTo(targetPos).toFixed(2);
        console.log(`🔍 [TARGETING] กำลังเล็งวางที่ ${targetPosStr} (พื้นล่าง: ${refBlock.name} | ระยะ: ${dist}m)`);

        // 4. หันหน้าไปมองขอบบนของบล็อกรองรับ
        const lookTarget = refBlockPos.offset(0.5, 0.9, 0.5);
        await bot.lookAt(lookTarget, true);
        await new Promise(res => setTimeout(res, 50));

        // 5. สั่งวางลงบนขอบบนของบล็อกรองรับ
        await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
        console.log(`🟢 [SWEEP SUCCESS] วาง Kelp สำเร็จที่ ${targetPosStr}`);

    } catch (err) {
        console.log(`❌ [PLACE FAILED] ${targetPosStr} | สาเหตุ: ${err.message}`);
    }
}

startBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();

    if (input === 'c') {
        buildActive = false;
        if (bot) bot.clearControlStates();
        console.log('🛑 สั่งหยุดการทำงานบอทเรียบร้อยแล้ว');
        return;
    }

    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log(`✍️ [Terminal Action] ยิงคำสั่ง /tpa DukDikauai ผ่านเบื้องหลัง`);
            bot.chat('/tpa DukDikauai');
        }
        return;
    }

    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        const startZ = parseInt(args[3]);

        if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) {
            console.log('⚠️ รูปแบบไม่ถูกต้อง! ตัวอย่าง: build -2763 128 14634 หรือ build -2770 128 14634');
            return;
        }

        if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_kelp_${bot.username}.txt`);
        const savedData = loadProgress();

        if (savedData && savedData.startX === startX && savedData.targetY === startY && savedData.startZ === startZ) {
            console.log(`🔄 [SMART RESUME]: ตรวจพบประวัติเดิม ลุยต่อจาก X: ${savedData.currentX} Z: ${savedData.currentZ}`);
            await startKelpPlatformBuilder(startX, startY, startZ, savedData);
        } else {
            console.log(`🤖 เริ่มต้นภารกิจวาง Kelp กวาด 3X ที่พิกัด X:${startX} Y:${startY} Z:${startZ}`);
            clearProgress();
            await startKelpPlatformBuilder(startX, startY, startZ);
        }
    }
});