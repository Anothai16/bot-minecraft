const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let miningActive = false;
let isRepairing = false;
let currentMode = 'fortune';

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'cobblequast', 
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

    setupAmoryLogin(bot);
    bot.loadPlugin(pathfinder);

    // 📊 ส่งค่า HP และ Food ให้ GUI เมื่อมีการเปลี่ยนแปลง
    bot.on('health', () => {
        if (bot.health !== undefined && bot.food !== undefined) {
            const hp = Math.round(bot.health);
            const food = Math.round(bot.food);
            console.log(`[STATS_UPDATE] HP:${hp}/20 | FOOD:${food}/20`);
        }
    });

    bot.on('kicked', (reason) => {
        console.log('🚨 [KICKED BY SERVER] โดนเซิร์ฟเวอร์เตะหลุด! สาเหตุ:', JSON.stringify(reason));
    });

    bot.on('death', () => {
        miningActive = false;
        isRepairing = false;

        const pos = bot.entity.position ? bot.entity.position : { x: 0, y: 0, z: 0 };
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        const z = Math.floor(pos.z);

        let cause = "ไม่ทราบสาเหตุแน่ชัด (Unspecified)";

        const blockAtFeet = bot.blockAt(pos);
        if (blockAtFeet && (blockAtFeet.name === 'lava' || blockAtFeet.name === 'fire')) {
            cause = `🔥 ตกลาวา / ไหม้ไฟ (${blockAtFeet.name})`;
        } else if (y < -64) {
            cause = "🕳️ ตก Void / ตกโลก";
        } else {
            cause = "⚔️ โดนโจมตี / แรงระเบิด / ตกจากที่สูง";
        }

        console.log(`[DEATH_REASON] ${cause}\n(พิกัด X:${x} Y:${y} Z:${z})`);
        console.log(`💀 [DEATH LOG] บอทตายแล้ว! สาเหตุ: ${cause} ที่พิกัด X:${x} Y:${y} Z:${z}`);
    });

    bot.on('error', (err) => {
        console.log('❌ [BOT ERROR]:', err);
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        const msg = message.trim().toLowerCase();
        
        if (msg === 'mine f' || msg === 'mine fortune') {
            await startStationMining('fortune');
        } else if (msg === 'mine s' || msg === 'mine silk' || msg === 'mine silktouch') {
            await startStationMining('silktouch');
        } else if (msg === 'mine') {
            await startStationMining('fortune');
        } else if (msg === 'c' || msg === 'cancel' || msg === 'stop') {
            stopMining();
        } else if (msg === 'home') {
            goHome();
        } else if (msg === 'eat') {
            await forceEatFood();
        }
    });

    bot.on('end', (reason) => { 
        console.log(`🔌 [DISCONNECTED] การเชื่อมต่อดับลง (Reason: ${reason})`);
        miningActive = false; 
        isRepairing = false;
        setTimeout(startBot, 10000); 
    });
}

function stopMining() {
    if (miningActive) {
        miningActive = false;
        isRepairing = false;
        console.log('🛑 [Cancel] สั่งยกเลิกการทำงานเรียบร้อยแล้ว!');
        if (bot && bot.pathfinder) {
            bot.pathfinder.stop();
            bot.clearControlStates();
        }
    } else {
        console.log('ℹ️ บอทไม่ได้กำลังขุดอยู่ครับ');
    }
}

function goHome() {
    stopMining();
    if (bot) {
        console.log('🏠 [Command] กำลังสั่งวาร์ปกลับบ้านด้วยคำสั่ง /home home ...');
        bot.chat('/home home');
    }
}

function setupMiningMovements(botInstance) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false; 
    movements.allowParkour = false;
    movements.canDig = true; 
    movements.allow1by1towers = false;
    movements.maxDropDown = 1; 
    botInstance.pathfinder.setMovements(movements);
}

function getPickaxeFromLockedHotbar(mode) {
    const targetInventorySlot = (mode === 'silktouch') ? 36 : 37;
    const item = bot.inventory.slots[targetInventorySlot];

    if (item && item.name.includes('pickaxe')) {
        return item;
    }
    return null;
}

// 🥩 ฟังก์ชันกินอาหาร (ค้นหาทั่วทั้ง Inventory ไม่จำกัดแค่ Hotbar)
async function performEatProcess() {
    if (!bot) return false;

    // ค้นหาอาหารทั้งหมดที่มีในกระเป๋า (Inventory + Hotbar)
    const foodItem = bot.inventory.items().find(i => 
        i.name === 'cooked_porkchop' || 
        i.name === 'porkchop' ||
        i.name === 'golden_carrot' || 
        i.name === 'cooked_beef' || 
        i.name === 'bread'
    );

    if (!foodItem) {
        console.log('⚠️ [Eat Warning] ไม่พบเนื้อหมู (Porkchop) หรืออาหารอื่นในกระเป๋าเลย!');
        return false;
    }

    try {
        console.log(`🍖 [Eat Process] กำลังหยิบ ${foodItem.name} จากกระเป๋ามาถือและกิน...`);
        bot.clearControlStates();
        bot._client.write('block_dig', { status: 1, location: { x: 0, y: 0, z: 0 }, face: 0 });
        await new Promise(res => setTimeout(res, 200));

        // equip จะดึงของจาก Slot ใดก็ได้ใน Inventory มาไว้ที่มือหลักอัตโนมัติ
        await bot.equip(foodItem, 'hand');
        await new Promise(res => setTimeout(res, 300));

        await bot.consume();
        console.log(`✅ [Eat Success] กิน ${foodItem.name} เรียบร้อย! หลอดอาหารปัจจุบัน: ${bot.food}/20`);
        await new Promise(res => setTimeout(res, 300));
        return true;
    } catch (err) {
        console.log(`⚠️ [Eat Error] ไม่สามารถกินอาหารได้: ${err.message}`);
        return false;
    }
}

// 🍖 ระบบกินอาหารอัตโนมัติเมื่ออาหารเหลือ <= 6 (3 ขีด)
async function handleAutoEatEngine() {
    if (bot && bot.food !== undefined && bot.food <= 6) {
        console.log(`🍖 [Auto-Eat] หลอดอาหารเหลือ 3 ขีด (${bot.food}/20) กำลังกินอาหาร...`);
        await performEatProcess();
    }
}

// 🔴 สั่งกินอาหารด้วยตัวเองแบบ Manual (ผ่านปุ่ม GUI หรือพิมพ์ eat)
async function forceEatFood() {
    console.log('🖐️ [Manual-Eat] ได้รับคำสั่งสั่งกินอาหารแบบ Manual...');
    await performEatProcess();
}

async function repairPickaxeWithExp(mode) {
    if (isRepairing) return;
    isRepairing = true;

    console.log(`🧪 [Auto-Mending Active] เริ่มซ่อมที่ขุด ${mode.toUpperCase()} (ปาขวด EXP จากมือซ้าย)...`);
    
    try {
        bot._client.write('block_dig', { status: 1, location: { x: 0, y: 0, z: 0 }, face: 0 });
        bot.clearControlStates();
        await new Promise(res => setTimeout(res, 800));

        const pickHotbarIndex = (mode === 'silktouch') ? 0 : 1;
        const targetPickSlot = (mode === 'silktouch') ? 36 : 37;
        
        bot.setQuickBarSlot(pickHotbarIndex);
        await new Promise(res => setTimeout(res, 400));

        const OFFHAND_SLOT = 45;
        let thrownCount = 0;

        const expBottle = bot.inventory.items().find(i => i.name === 'experience_bottle');
        if (!expBottle) {
            console.log('⚠️ [Out of EXP Bottles] ไม่พบขวด EXP ในกระเป๋า!');
            miningActive = false;
        } else {
            console.log('🍾 [LOG] ย้ายขวด EXP ไปไว้ที่มือซ้าย (Off-hand)...');
            await bot.moveSlotItem(expBottle.slot, OFFHAND_SLOT);
            await new Promise(res => setTimeout(res, 600));
        }

        console.log('🍾 เริ่มต้นปาขวด EXP จากมือซ้ายรัวๆ ...');

        while (miningActive && isRepairing) {
            const mainHandPick = bot.inventory.slots[targetPickSlot];
            if (!mainHandPick || !mainHandPick.name.includes('pickaxe')) {
                console.log(`🛑 ไม่พบที่ขุดใน Hotbar ช่อง ${pickHotbarIndex + 1} สำหรับซ่อม ยกเลิกกระบวนการ`);
                break;
            }

            const maxDur = 2031;
            const currentDamage = mainHandPick.durabilityUsed || 0;
            const remaining = maxDur - currentDamage;
            const durabilityPercent = Math.floor((remaining / maxDur) * 100);

            if (currentDamage <= 0 || remaining >= maxDur - 15) {
                console.log(`✅ [Repair Complete] ซ่อมที่ขุดเต็ม 100% เรียบร้อย! (ความทนทาน: ${remaining}/${maxDur} - ใช้ไปทั้งหมด ${thrownCount} ขวด)`);
                break;
            }

            const hasExpInInv = bot.inventory.items().some(item => item.name === 'experience_bottle');
            const offhandItem = bot.inventory.slots[OFFHAND_SLOT];
            
            if (!hasExpInInv && (!offhandItem || offhandItem.name !== 'experience_bottle')) {
                console.log('⚠️ [Out of EXP Bottles] ขวด EXP หมดกระเป๋าแล้ว!');
                miningActive = false;
                break;
            }

            if (!offhandItem || offhandItem.name !== 'experience_bottle') {
                const nextExp = bot.inventory.items().find(i => i.name === 'experience_bottle');
                if (nextExp) {
                    console.log('📦 [LOG] เติมขวด EXP สแตกใหม่เข้ามือซ้าย...');
                    await bot.moveSlotItem(nextExp.slot, OFFHAND_SLOT);
                    await new Promise(res => setTimeout(res, 500));
                }
            }

            bot.setQuickBarSlot(pickHotbarIndex);

            bot.activateItem(true); 
            thrownCount++;

            if (thrownCount % 10 === 0 || thrownCount === 1) {
                console.log(`🍾 [LOG] ปาขวดที่ ${thrownCount} -> Mending มือขวา: ${remaining}/${maxDur} (${durabilityPercent}%)`);
            }

            await new Promise(res => setTimeout(res, 180));
        }

        const remainingOffhand = bot.inventory.slots[OFFHAND_SLOT];
        if (remainingOffhand) {
            console.log('🧹 [LOG] เคลียร์มือซ้าย เก็บขวด EXP ที่เหลือเข้ากระเป๋า...');
            const emptyMainSlot = bot.inventory.firstEmptyContainerSlot();
            if (emptyMainSlot) {
                await bot.moveSlotItem(OFFHAND_SLOT, emptyMainSlot);
                await new Promise(res => setTimeout(res, 500));
            }
        }

    } catch (err) {
        console.error('⚠️ เกิดข้อผิดพลาดในระบบซ่อมแซม:', err.message);
    } finally {
        isRepairing = false;
    }
}

async function startStationMining(mode = 'fortune') {
    if (miningActive) {
        stopMining();
        return;
    }

    currentMode = mode;
    miningActive = true;
    console.log(`\n🚀 [East-Axis Mining Active] โหมดที่เลือก: ⛏️ ${currentMode.toUpperCase()}`);

    const targetStandPos = new Vec3(-2742, 69, 14524);
    console.log(`กำลังเดินทางไปตั้งหลักพิกัดสถานีขุด: X:-2742 Y:69 Z:14524 ...`);
    
    setupMiningMovements(bot);
    try {
        await bot.pathfinder.goto(new GoalBlock(targetStandPos.x, targetStandPos.y, targetStandPos.z));
    } catch (err) {}

    if (!miningActive) return;

    bot.pathfinder.stop();
    bot.clearControlStates();
    console.log(`... ประจำสถานีเรียบร้อย!`);

    await new Promise(res => setTimeout(res, 800));

    const exactLookTarget = new Vec3(-2739.5, 69.5, 14524.5); 
    await bot.lookAt(exactLookTarget, true);
    await new Promise(res => setTimeout(res, 400)); 

    console.log(`🧭 ล็อกหน้ากล้องไปทางทิศ EAST สำเร็จ! เริ่มต้นสับบล็อก...`);

    const cleanBlocksQueue = [
        new Vec3(-2740, 70, 14524),
        new Vec3(-2739, 70, 14524),
        new Vec3(-2738, 70, 14524),
        new Vec3(-2737, 70, 14524)
    ];

    while (miningActive) {
        try {
            await handleAutoEatEngine();

            if (isRepairing) {
                await new Promise(res => setTimeout(res, 500));
                continue;
            }

            let selectedPickaxe = getPickaxeFromLockedHotbar(currentMode);
            
            if (!selectedPickaxe && bot.inventory.slots[45] && bot.inventory.slots[45].name.includes('pickaxe')) {
                const targetHotbarSlot = (currentMode === 'silktouch') ? 36 : 37;
                console.log('⚠️ [RECOVERY] เจอมือซ้ายถือที่ขุดค้างไว้! กำลังย้ายกลับ Hotbar...');
                await bot.moveSlotItem(45, targetHotbarSlot);
                await new Promise(res => setTimeout(res, 600));
                selectedPickaxe = getPickaxeFromLockedHotbar(currentMode);
            }

            if (!selectedPickaxe) {
                const slotNum = (currentMode === 'silktouch') ? 1 : 2;
                console.log(`🛑 หยุดการทำงานเนื่องจากไม่พบที่ขุดใน Hotbar ช่อง ${slotNum} สำหรับโหมด ${currentMode.toUpperCase()}`);
                miningActive = false;
                break;
            }

            const pickHotbarIndex = (currentMode === 'silktouch') ? 0 : 1;
            bot.setQuickBarSlot(pickHotbarIndex);

            await bot.lookAt(exactLookTarget, true);

            for (const blockPos of cleanBlocksQueue) {
                const checkResult = await checkAndHandleDurability(selectedPickaxe);
                if (!checkResult || !miningActive || isRepairing) {
                    break;
                }

                if (bot.heldItem && bot.heldItem.name.includes('pickaxe')) {
                    bot._client.write('block_dig', { status: 0, location: blockPos, face: 1 });
                    bot.swingArm('right');

                    await new Promise(resolve => setTimeout(resolve, 140));

                    bot._client.write('block_dig', { status: 2, location: blockPos, face: 1 });
                } else {
                    console.log('⚠️ มือไม่ได้ถือที่ขุด ข้ามการขุดบล็อกนี้เพื่อความปลอดภัย');
                    break;
                }
            }

            if (!miningActive) break; 
            await new Promise(res => setTimeout(res, 20));

        } catch (err) {
            console.error('⚠️ เกิดข้อผิดพลาดในลูปควบคุม:', err.message);
            await new Promise(res => setTimeout(res, 500));
        }
    }
}

let lastLoggedDurability = -1;

async function checkAndHandleDurability(pickaxe) {
    if (!pickaxe) {
        console.log("👉 PICKAXE_NOT_FOUND");
        miningActive = false;
        return false; 
    }

    if (pickaxe.durabilityUsed !== undefined) {
        const maxDur = 2031; 
        const currentDamage = pickaxe.durabilityUsed;
        const remaining = maxDur - currentDamage;
        const durabilityPercent = Math.floor((remaining / maxDur) * 100);

        if (durabilityPercent !== lastLoggedDurability) {
            console.log(`👉 PICKAXE_DURABILITY (${currentMode.toUpperCase()}): ${durabilityPercent}% (แต้มคงเหลือ: ${remaining}/${maxDur})`);
            lastLoggedDurability = durabilityPercent;
        }

        if (remaining <= 60 || durabilityPercent <= 3) {
            if (!isRepairing) {
                console.log(`⚠️ [Durability Warning] ที่ขุด ${currentMode.toUpperCase()} เหลือแต้มขุด: ${remaining} สั่งเข้าสู่ระบบ Auto-Mending!`);
                await repairPickaxeWithExp(currentMode);
                lastLoggedDurability = -1;
            }
            if (!miningActive) return false;
        }
    }
    return true;
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim().toLowerCase();
    if (input === 'mine f' || input === 'mine fortune') {
        await startStationMining('fortune');
    } else if (input === 'mine s' || input === 'mine silk' || input === 'mine silktouch') {
        await startStationMining('silktouch');
    } else if (input === 'mine') {
        await startStationMining('fortune');
    } else if (input === 'c' || input === 'cancel' || input === 'stop') {
        stopMining();
    } else if (input === 'home') {
        goHome();
    } else if (input === 'eat') {
        await forceEatFood();
    }
});