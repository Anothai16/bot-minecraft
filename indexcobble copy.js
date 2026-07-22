const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let miningActive = false;
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
        }
    });

    bot.on('end', () => { miningActive = false; setTimeout(startBot, 10000); });
}

function stopMining() {
    if (miningActive) {
        miningActive = false;
        console.log('🛑 [Cancel] สั่งยกเลิกการทำงานเรียบร้อยแล้ว!');
        if (bot && bot.pathfinder) {
            bot.pathfinder.stop();
            bot.clearControlStates();
        }
    } else {
        console.log('ℹ️ บอทไม่ได้กำลังขุดอยู่ครับ');
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

function findPickaxeByMode(mode) {
    const items = bot.inventory.items().filter(i => i.name.includes('pickaxe'));
    
    for (const item of items) {
        let enchants = [];

        if (item.nbt && item.nbt.value && item.nbt.value.Enchantments) {
            enchants = item.nbt.value.Enchantments.value.value;
        } else if (item.components) {
            const enchComp = item.components.find(c => c.type === 'enchantments' || c.name === 'enchantments');
            if (enchComp && enchComp.data && enchComp.data.levels) {
                enchants = Object.keys(enchComp.data.levels).map(id => ({ id }));
            }
        }

        const enchantStr = JSON.stringify(enchants || item.nbt || item.components || '').toLowerCase();

        if (mode === 'silktouch' && (enchantStr.includes('silk_touch') || enchantStr.includes('silk'))) {
            return item;
        }
        if (mode === 'fortune' && (enchantStr.includes('fortune') || enchantStr.includes('fort'))) {
            return item;
        }
    }

    return items[0] || null;
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

            let selectedPickaxe = findPickaxeByMode(currentMode);
            if (selectedPickaxe) {
                await bot.equip(selectedPickaxe, 'hand');
            } else {
                console.log(`⚠️ ไม่พบที่ขุดสาย ${currentMode} ในตัว!`);
            }

            await bot.lookAt(exactLookTarget, true);

            for (const blockPos of cleanBlocksQueue) {
                const pickaxeCheck = await checkAndTossPickaxe();
                if (!pickaxeCheck || !miningActive) {
                    console.log('🛑 [Safety Lock Triggered]: ดักเจอที่ขุดใกล้พัง สั่งหยุดขุดทันที!');
                    miningActive = false; 
                    bot.clearControlStates();
                    break;
                }

                bot._client.write('block_dig', { status: 0, location: blockPos, face: 1 });
                bot.swingArm('right');

                await new Promise(resolve => setTimeout(resolve, 140));

                bot._client.write('block_dig', { status: 2, location: blockPos, face: 1 });
            }

            if (!miningActive) break; 
            await new Promise(res => setTimeout(res, 20));

        } catch (err) {
            console.error('⚠️ เกิดข้อผิดพลาดในลูปควบคุม:', err.message);
            await new Promise(res => setTimeout(res, 500));
        }
    }
}

async function checkAndTossPickaxe() {
    const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
    if (!pickaxe) {
        console.log("👉 PICKAXE_BROKEN");
        console.log("👉 PICKAXE_DURABILITY: 0"); 
        miningActive = false;
        return false; 
    }

    if (pickaxe.durabilityUsed !== undefined) {
        const maxDur = 2031; 
        const currentDamage = pickaxe.durabilityUsed;
        const remaining = maxDur - currentDamage;
        
        const durabilityPercent = Math.floor((remaining / maxDur) * 100);
        console.log(`👉 PICKAXE_DURABILITY (${currentMode.toUpperCase()}): ${durabilityPercent}%`);

        // ถ้าความทนทานเหลือต่ำกว่า 40 แต้ม หรือ <= 2% ย้ายไปใส่มือซ้าย (Off-hand) แล้วสั่งหยุดขุด
        if (remaining <= 40 || durabilityPercent <= 2) {
            console.log(`⚠️ [Durability Protection] ที่ขุดเหลือแต้มขุด: ${remaining} ย้ายไปใส่มือซ้าย และหยุดขุดทันที!`);
            console.log("👉 PICKAXE_BROKEN");
            
            miningActive = false; 
            bot.clearControlStates();

            try {
                // 🎯 ย้ายที่ขุดที่ใกล้พังไปไว้ที่มือซ้าย (off-hand)
                await bot.equip(pickaxe, 'off-hand');
                console.log("✅ [Off-Hand Equip Complete] สลับที่ขุดไปไว้มือซ้ายเรียบร้อย!");
            } catch (e) {
                console.log(`⚠️ เกิดข้อผิดพลาดในการสลับไปมือซ้าย: ${e.message}`);
            }

            return false; 
        }
    } else {
        console.log("👉 PICKAXE_DURABILITY: 100%");
    }
    return true;
}

async function handleAutoEatEngine() {
    if (bot.food <= 16) {
        const carrot = bot.inventory.items().find(i => i.name === 'golden_carrot');
        if (carrot) {
            try {
                await bot.equip(carrot, 'hand');
                await bot.consume();
                await new Promise(res => setTimeout(res, 100));
            } catch (e) {}
        }
    }
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
    }
});