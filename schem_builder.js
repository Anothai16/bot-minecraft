const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let buildActive = false;

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Kaitom_5', 
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
        console.log(`🔌 บอท [${bot.username}] ออนไลน์สำเร็จ!`);
        console.log(`👉 พิมพ์ 'build X Y Z [จำนวนรอบ]' เพื่อปั๊มฟาร์มขนาน`);
        console.log(`👉 พิมพ์ 'tpa' ใน Terminal เพื่อส่งคำสั่งขอย้ายพิกัดไปหาไอดีพี่ได้ทันทีครับ`);
        
        // 🎯 [AUTO-TPA ON SPAWN]: บอทเกิดเสร็จยิงคำสั่งขอย้ายพิกัดไปหาพี่ออโต้รอบแรกทันที
        setTimeout(() => {
            if (bot) {
                console.log('🚀 [AUTO TPA]: ส่งคำสั่ง /tpa DukDikauai ไปหาพี่เรียบร้อยครับ กดรับด้วยนะพี่!');
                bot.chat('/tpa DukDikauai');
            }
        }, 3500); // หน่วงเวลา 3.5 วินาทีรอแชทรันระบบปลดล็อกให้เกลี้ยงก่อนส่ง
    });

    bot.on('death', () => { buildActive = false; });
    bot.on('kicked', () => { buildActive = false; });
    bot.on('error', () => { buildActive = false; });
    bot.on('end', () => { buildActive = false; setTimeout(startBot, 10000); });
}

function setupMovements(botInstance) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false;
    movements.allowParkour = true;   
    movements.canDig = true;         
    movements.allow1by1towers = true; 
    movements.maxDropDown = 4;       
    movements.allowFreeMotion = true; 
    botInstance.pathfinder.setMovements(movements);
}

function generateCustomQueue(startX, startY, startZ) {
    let queue = [];
    const notePos = new Vec3(startX, startY, startZ);
    
    // 1. วาง Note Block
    queue.push({ pos: notePos, name: 'note_block', special: 'normal', standOffset: new Vec3(-1.2, 0, 0) });
    // 2. วาง Observer ล่าง
    queue.push({ pos: notePos.offset(0, 1, 0), name: 'observer', special: 'look_down', standOffset: new Vec3(0, 0, 0) });
    // 3. ข้างบน Observer วาง Sticky Piston 1
    queue.push({ pos: notePos.offset(0, 2, 0), name: 'sticky_piston', special: 'face_east', standOffset: new Vec3(1.5, 0, 0) });
    
    // 4. วาง Obsidian
    const piston1Pos = notePos.offset(0, 2, 0);
    const obsiPos = piston1Pos.offset(-1, 0, 0);
    queue.push({ pos: obsiPos, name: 'obsidian', special: 'force_evade', standOffset: new Vec3(-1.2, 0, 1.2) });

    const northStation = new Vec3(startX + 2.0, startY, startZ - 2.4); 

    // 5. แผง Slime 7 บล็อกฝั่งเหนือ
    let slime1Start = piston1Pos.offset(1, 0, 0);
    for (let i = 0; i < 7; i++) {
        let p = slime1Start.offset(0, 0, -i);
        queue.push({ pos: p, name: 'slime_block', special: 'normal', absoluteStand: northStation });
    }

    let northSlimePositions = [];
    for (let i = 0; i < 7; i++) {
        northSlimePositions.push(slime1Start.offset(0, 0, -i));
    }

    // 6. Iron Bar ฝั่งเหนือ
    let ironIndices1 = [6, 3, 2]; 
    ironIndices1.forEach(idx => {
        if (northSlimePositions[idx]) {
            queue.push({ pos: northSlimePositions[idx].offset(0, -1, 0), name: 'iron_bars', special: 'normal', absoluteStand: northStation });
        }
    });

    // 7. Sticky Piston ตัวที่สอง
    const piston2Pos = slime1Start.offset(0, 0, 1); 
    queue.push({ pos: piston2Pos, name: 'sticky_piston', special: 'face_west', standOffset: new Vec3(-1.5, 0, 1), forceOrbitActive: true });

    const southStation = new Vec3(startX - 2.5, startY, startZ + 2.4);

    // 8. แผง Slime 5 บล็อกฝั่งใต้
    let slime2Start = piston2Pos.offset(-1, 0, 0);
    let southSlimePositions = [];
    for (let i = 0; i < 5; i++) {
        let p = slime2Start.offset(0, 0, i);
        queue.push({ pos: p, name: 'slime_block', special: 'normal', absoluteStand: southStation });
        southSlimePositions.push(p);
    }

    // 9. Iron Bar ฝั่งใต้
    let ironIndices2 = [4, 1, 0];
    ironIndices2.forEach(idx => {
        if (southSlimePositions[idx]) {
            queue.push({ pos: southSlimePositions[idx].offset(0, -1, 0), name: 'iron_bars', special: 'normal', absoluteStand: southStation });
        }
    });

    // 10. Observer ยอดเครื่องฝั่ง East
    const obsOnSlime1 = slime1Start.offset(0, 1, 0); 
    queue.push({ pos: obsOnSlime1, name: 'observer', special: 'look_north', customOrbitEast: true });

    // 11. วาง Observer ยอดเครื่องฝั่ง West
    const obsOnSlime2 = slime2Start.offset(0, 1, 0); 
    queue.push({ pos: obsOnSlime2, name: 'observer', special: 'look_south', customOrbitWest: true });

    // 12. วาง Observer บล็อกที่ 26 บนหัว Piston แผงล่าง
    const extensionObsPos = notePos.offset(0, 3, 0);
    queue.push({ pos: extensionObsPos, name: 'observer', special: 'look_east', customOrbitExtension: true });

    return queue;
}

async function forceWalkStrictAxis(targetX, targetY, targetZ) {
    if (!bot || !bot.entity) return;
    bot.clearControlStates();
    setupMovements(bot);
    
    let currentPos = bot.entity.position;
    if (Math.abs(currentPos.x - targetX) > 0.1) {
        try { await bot.pathfinder.goto(new GoalBlock(targetX, targetY, currentPos.z)); } catch(e) {}
    }
    try { await bot.pathfinder.goto(new GoalBlock(targetX, targetY, targetZ)); } catch(e) {}
    bot.clearControlStates();
}

async function buildStructure(startX, startY, startZ) {
    buildActive = true;
    setupMovements(bot);

    const buildQueue = generateCustomQueue(startX, startY, startZ);

    for (let i = 0; i < buildQueue.length; i++) {
        if (!buildActive || !bot || !bot.entity) break;

        const task = buildQueue[i];
        let currentBlock = bot.blockAt(task.pos);
        
        let safeStandPos = new Vec3(task.pos.x - 2, startY + 1, task.pos.z);
        if (task.absoluteStand) {
            safeStandPos = new Vec3(task.absoluteStand.x, startY + 1, task.absoluteStand.z); 
        } else if (task.standOffset) {
            safeStandPos = task.pos.plus(task.standOffset);
            safeStandPos.y = startY + 1; 
        }

        const getFootPosLog = () => {
            const pos = bot.entity.position;
            return `[👟 เท้าบอทอยู่ที่: X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}]`;
        };

        if (currentBlock && currentBlock.name !== 'air' && currentBlock.name !== 'water' && currentBlock.name !== 'lava' && currentBlock.name !== task.name) {
            if (i >= 23) {
                console.log(`🛑 [PROTECT CORE]: สเต็ปช่วงท้ายเครื่อง ห้ามทุบบล็อกฐานเด็ดขาด...`);
            } else if ((currentBlock.name === 'dirt' || currentBlock.name === 'grass_block') && !currentBlock.position.equals(task.pos)) {
                console.log(`🛑 ${getFootPosLog()} -> [พื้นยืนปลอดภัย]: เจอบล็อกพื้นดิน ห้ามทุบเด็ดขาด ข้ามสเต็ป...`);
            } else {
                if (task.special !== 'look_down' && task.special !== 'force_evade' && !task.forceOrbitActive && !task.customOrbitEast && !task.customOrbitWest && !task.customOrbitExtension && !(task.name === 'sticky_piston' && task.special === 'face_east')) {
                    if (bot.entity.position.distanceTo(safeStandPos) > 1.2) {
                        try { await bot.pathfinder.goto(new GoalBlock(safeStandPos.x, safeStandPos.y, safeStandPos.z)); } catch(e) {}
                    }
                }
                let pickaxe = bot.inventory.items().find(item => item.name.endsWith('pickaxe') || item.name.endsWith('shovel'));
                if (pickaxe) await bot.equip(pickaxe, 'hand');
                try {
                    await bot.lookAt(task.pos.plus(new Vec3(0.5, 0.5, 0.5)), true);
                    await bot.dig(currentBlock);
                    await new Promise(res => setTimeout(res, 150));
                } catch (e) {}
            }
            currentBlock = bot.blockAt(task.pos);
        }

        if (currentBlock && currentBlock.name === task.name) {
            continue;
        }

        // 🚨 [STRICT Z-ONLY RUN]
        if (task.forceOrbitActive) {
            bot.clearControlStates();
            await bot.look(3.14, 0, true);
            await new Promise(res => setTimeout(res, 80));
            bot.setControlState('forward', true);

            for (let check = 0; check < 250; check++) {
                await new Promise(res => setTimeout(res, 10));
                let curZ = bot.entity.position.z;
                if (curZ < (startZ + 1.8)) {
                    bot.setControlState('forward', true);
                    bot.setControlState('left', false);
                    bot.setControlState('right', false);
                    if (check % 25 === 0) {
                        bot.setControlState('jump', true);
                        await new Promise(res => setTimeout(res, 40));
                        bot.setControlState('jump', false);
                    }
                } else {
                    break;
                }
            }
            bot.clearControlStates();
            try {
                setupMovements(bot);
                await bot.pathfinder.goto(new GoalBlock(safeStandPos.x, safeStandPos.y, safeStandPos.z));
            } catch(e) {}
        }

        // 🚨 [DYNAMIC U-ORBIT SOUTH]
        if (task.customOrbitEast) {
            console.log(`🚨 [STRICT AXIS U-ORBIT SOUTH] -> กำลังอ้อมแผงใต้...`);
            await forceWalkStrictAxis(startX - 2.5, startY + 1, bot.entity.position.z);
            await forceWalkStrictAxis(startX - 2.5, startY + 1, startZ + 6);
            await forceWalkStrictAxis(startX + 1, startY + 1, startZ + 6);
            await forceWalkStrictAxis(startX + 1, startY + 1, startZ + 2);

            await bot.look(3.14, 0, true);
            await new Promise(res => setTimeout(res, 100));
            bot.setControlState('jump', true);
            await new Promise(res => setTimeout(res, 80));
            bot.setControlState('sneak', true);
        }

        // 🚨 [DYNAMIC U-ORBIT NORTH]
        if (task.customOrbitWest) {
            console.log(`🚨 [STRICT AXIS U-ORBIT NORTH] -> กำลังอ้อมแผงเหนือ...`);
            await forceWalkStrictAxis(startX + 2.5, startY + 1, bot.entity.position.z);
            await forceWalkStrictAxis(startX + 2.5, startY + 1, startZ - 7);
            await forceWalkStrictAxis(startX, startY + 1, startZ - 7);
            await forceWalkStrictAxis(startX, startY + 1, startZ - 1);

            await bot.look(0, 0, true);
            await new Promise(res => setTimeout(res, 100));
            bot.setControlState('jump', true);
            await new Promise(res => setTimeout(res, 80));
            bot.setControlState('sneak', true);
        }

        // 🚨 [DYNAMIC EXTENSION OBSIDIAN MONITOR - ID 26]
        if (task.customOrbitExtension) {
            console.log(`🚨 [EXTENSION ORBIT] -> เคลื่อนพลวางบล็อกค้ำยันพิเศษลำดับที่ 26...`);
            await forceWalkStrictAxis(startX - 2.0, startY + 1, bot.entity.position.z);
            await forceWalkStrictAxis(startX - 2.0, startY + 1, startZ - 1.0);

            await bot.look(-1.57, 0, true);
            await new Promise(res => setTimeout(res, 100));
            bot.setControlState('jump', true);
            await new Promise(res => setTimeout(res, 80));
            bot.setControlState('sneak', true);
        }

        console.log(`🧱 [ACTION BUILD]: วาง: ${task.name} ที่ X:${task.pos.x} Y:${task.pos.y} Z:${task.pos.z} ${getFootPosLog()}`);

        let itemSlot = bot.inventory.items().find(item => item.name === task.name);
        if (!itemSlot) {
            console.log(`⚠️ ขาดไอเทม: [${task.name}] ระบบลูปหยุดทำงาน รอเติมของก่อนครับพี่`);
            buildActive = false;
            return false; 
        }

        if (itemSlot.slot < 36 || itemSlot.slot > 44) {
            try {
                await bot.moveSlotItem(itemSlot.slot, 36);
                await new Promise(res => setTimeout(res, 150));
                itemSlot = bot.inventory.slots[36];
            } catch (err) {}
        }

        bot.setQuickBarSlot(itemSlot.slot - 36);

        if (task.special === 'force_evade') {
            bot.clearControlStates();
            bot.setControlState('back', true);
            bot.setControlState('left', true);
            await new Promise(res => setTimeout(res, 220)); 
            bot.clearControlStates();
            bot.setControlState('jump', true);
            await new Promise(res => setTimeout(res, 60));
            bot.setControlState('jump', false);
            await new Promise(res => setTimeout(res, 150));
        } 
        else if (task.name === 'sticky_piston' && task.special === 'face_east') {
            bot.clearControlStates();
            try {
                setupMovements(bot);
                await bot.pathfinder.goto(new GoalBlock(safeStandPos.x, safeStandPos.y, startZ)); 
            } catch (e) {}
        }
        else if (!task.forceOrbitActive && !task.customOrbitEast && !task.customOrbitWest && !task.customOrbitExtension) {
            if (bot.entity.position.distanceTo(safeStandPos) > 1.0) {
                try { 
                    setupMovements(bot);
                    await bot.pathfinder.goto(new GoalBlock(safeStandPos.x, safeStandPos.y, safeStandPos.z)); 
                } catch (e) {}
            }
        } else if (task.special === 'look_down') {
            const standOnBase = task.pos.offset(0, -1, 0);
            if (bot.entity.position.distanceTo(standOnBase.offset(0.5, 2, 0.5)) > 0.2) {
                try { await bot.pathfinder.goto(new GoalBlock(standOnBase.x, standOnBase.y + 2, startZ)); } catch (e) {}
            }
        }
        bot.clearControlStates();

        let referenceBlock = null;
        let placeFace = null;
        const directions = [
            { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },   
            { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },   
            { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) }, 
            { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },
            { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },
            { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) }    
        ];

        for (const dir of directions) {
            const neighbor = bot.blockAt(task.pos.plus(dir.offset));
            if (neighbor && neighbor.name !== 'air' && neighbor.name !== 'water' && neighbor.name !== 'lava') {
                referenceBlock = neighbor;
                placeFace = dir.face;
                break;
            }
        }
        if (!referenceBlock) {
            referenceBlock = bot.blockAt(task.pos.offset(0, -1, 0));
            placeFace = new Vec3(0, 1, 0);
        }

        if (referenceBlock && referenceBlock.name !== 'air') {
            try {
                bot.setControlState('sneak', true);

                if (task.special === 'look_down') {
                    await bot.look(bot.entity.yaw, -1.57, true);
                    await new Promise(res => setTimeout(res, 60)); 
                    bot.setControlState('sneak', true);
                    bot.setControlState('jump', true);
                    const initHeight = bot.entity.position.y;
                    for (let check = 0; check < 40; check++) {
                        await new Promise(res => setTimeout(res, 10));
                        bot.setControlState('sneak', true);
                        if (bot.entity.position.y >= initHeight + 0.85) break;
                    }
                    bot.setControlState('jump', false);
                    referenceBlock = bot.blockAt(task.pos.offset(0, -1, 0)); 
                    placeFace = new Vec3(0, 1, 0); 
                    await bot.placeBlock(referenceBlock, placeFace);
                } 
                else if (task.special === 'look_north') { await bot.look(3.14, 0, true); } 
                else if (task.special === 'look_south') { await bot.look(0, 0, true); }
                else if (task.special === 'look_east') { await bot.look(-1.57, 0, true); }
                else if (task.special === 'face_east') { await bot.look(1.57, 0, true); } 
                else if (task.special === 'face_west') { await bot.look(1.57, 0, true); } 
                else { await bot.lookAt(task.pos.plus(new Vec3(0.5, 0.5, 0.5)), true); }

                await bot.placeBlock(referenceBlock, placeFace);
                
                bot.setControlState('sneak', false);
                bot.setControlState('jump', false);
                await new Promise(res => setTimeout(res, 220)); 

                let checkBlockRealTime = bot.blockAt(task.pos);
                if (!checkBlockRealTime || checkBlockRealTime.name !== task.name) {
                    i--; 
                    await new Promise(res => setTimeout(res, 300));
                }

            } catch (err) {
                bot.setControlState('sneak', false);
                bot.setControlState('jump', false);
                i--; 
                await new Promise(res => setTimeout(res, 400));
            }
        }
    }
    
    bot.clearControlStates();
    return true; 
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    // 🎯 [🎯 NEW COMMAND INTERCEPTOR - MANUALLY TPA]: 
    // ยิงคำสั่งส่งแพ็คเก็ตแชทแมนนวลฉากหลังเมื่อพี่พิมพ์ tpa ในหน้าต่าง Console
    if (input === 'tpa') {
        if (bot) {
            console.log('🚀 [MANUAL TPA]: ส่งคำสั่ง /tpa DukDikauai ไปยังหน้าต่างเซิร์ฟเวอร์เรียบร้อยครับ!');
            bot.chat('/tpa DukDikauai');
        } else {
            console.log('⚠️ ตัวบอทยังไม่ได้ Spawn ออนไลน์ในเซิร์ฟครับพี่!');
        }
        return;
    }

    if (input === 'c') {
        buildActive = false;
        if (bot) { bot.clearControlStates(); bot.setControlState('sneak', false); bot.setControlState('jump', false); }
        console.log('🛑 หยุดคิวรันฟาร์มเรียบร้อยครับพี่');
        return;
    }
    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        let startZ = parseInt(args[3]);
        
        let maxLoops = args[4] ? parseInt(args[4]) : 1;

        if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(maxLoops)) {
            console.log('⚠️ รูปแบบพิกัดไม่ถูกต้องพี่! พิมพ์: build [X] [Y] [Z] [จำนวนรอบ]');
            return;
        }

        console.log(`🚀 [ENGINE START]: สั่งงานปั๊มฟาร์มออโต้ทั้งหมดจำนวน [ ${maxLoops} รอบ ]`);
        
        for (let currentLoop = 1; currentLoop <= maxLoops; currentLoop++) {
            console.log(`\n🎬 ==================== [ 📦 STARTING SLICE ROUND: ${currentLoop}/${maxLoops} ] ==================== 🎬`);
            console.log(`📍 พิกัดฐานรอบนี้: X:${startX} Y:${startY} Z:${startZ}`);
            
            let success = await buildStructure(startX, startY, startZ);
            
            if (!success) {
                console.log(`🛑 [LOOP BREAK]: หยุดการวนรอบออโต้เนื่องจากเกิดข้อผิดพลาดหน้างานครับพี่`);
                break;
            }

            console.log(`✅ [ROUND ${currentLoop} COMPLETE]: แผงพิกัด Z:${startZ} งอกสมบูรณ์แบบ 100%`);
            
            if (currentLoop < maxLoops) {
                startZ += 13;
                console.log(`🔄 [AUTO POSITION SHIFT]: ขยับสะพานไฟแกน Z+ เพิ่มขึ้น 13 บล็อกถัดไป -> พิกัด Z ใหม่: ${startZ}`);
                await new Promise(res => setTimeout(res, 1000)); 
            }
        }
        
        console.log('\n🏆 [ALL MULTI-SLICES COMPLETE]: บอบสร้างแผงฟาร์มเรียงแถวต่อกันเสร็จสิ้นสมบูรณ์ครบทุกรอบแล้วครับพี่! โหดจัด!');
        buildActive = false;
    }
});