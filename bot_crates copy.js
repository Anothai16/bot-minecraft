const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3').Vec3;

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_USERNAME = 'Kureeman';
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3010;

const TARGET_POS = new Vec3(280, 88, 322);
const sharedData = minecraftData(MC_VERSION);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.log(`[${time}] ${msg}`);
}

function logError(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.error(`[${time}] ${msg}`);
}

let activeBot = null;
let currentWindow = null;
let isAutoRolling = false;
let isClearing = false;
let currentRollCount = 0;

let botStatus = {
    name: BOT_USERNAME,
    status: 'Stopped',
    step: 'รอสั่งเปิดจากหน้าเว็บ...',
    lastError: '-',
    lastUpdate: new Date().toLocaleTimeString('th-TH', { hour12: false }),
    enabled: false
};

let guiState = {
    isOpen: false,
    title: 'ยังไม่ได้เปิด GUI',
    slots: Array(27).fill(null),
    spawnerFound: false,
    rollCount: 0
};

let inventoryState = Array(36).fill(null);

function updateStatus(status, step, errorReason = null) {
    botStatus.status = status;
    if (step) botStatus.step = step;
    if (errorReason) botStatus.lastError = errorReason;
    botStatus.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function extractText(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    let text = obj.text || '';
    if (obj.extra && Array.isArray(obj.extra)) {
        text += obj.extra.map(extractText).join('');
    }
    return text;
}

function parseItemText(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') {
        try {
            return extractText(JSON.parse(raw));
        } catch {
            return raw;
        }
    }
    return extractText(raw);
}

function isCrateWindow(title) {
    if (!title) return false;
    const t = title.toLowerCase();
    return t.includes('confirm') || t.includes('reroll') || t.includes('ᴄᴏɴғɪʀᴍ') || t.includes('ʀᴇʀᴏʟʟ');
}

function syncWindowSlots(window) {
    if (!window) return;
    for (let i = 0; i < 27; i++) {
        const item = window.slots[i];
        if (item) {
            guiState.slots[i] = {
                name: item.name,
                count: item.count,
                displayName: parseItemText(item.customName || item.displayName || item.name)
            };
        } else {
            guiState.slots[i] = null;
        }
    }
}

function syncInventorySlots(bot) {
    if (!bot || !bot.inventory || !bot.inventory.slots) {
        inventoryState = Array(36).fill(null);
        return;
    }

    for (let i = 0; i < 36; i++) {
        const item = bot.inventory.slots[9 + i];
        if (item) {
            const rawName = item.name ? item.name.toLowerCase() : '';
            const displayName = parseItemText(item.customName || item.displayName || '').toLowerCase();
            const isSpawner = rawName.includes('spawner') || displayName.includes('spawner') || displayName.includes('กรง');

            inventoryState[i] = {
                type: isSpawner ? 'spawner' : 'filled',
                name: item.name,
                count: item.count,
                displayName: parseItemText(item.customName || item.displayName || item.name)
            };
        } else {
            inventoryState[i] = { type: 'empty' };
        }
    }
}

function isInventoryFull(bot) {
    if (!bot || !bot.inventory || !bot.inventory.slots) return false;
    const emptySlots = bot.inventory.slots.slice(9, 45).filter(item => item === null);
    return emptySlots.length === 0;
}

function stopBot() {
    isAutoRolling = false;
    isClearing = false;
    currentWindow = null;
    guiState.isOpen = false;
    inventoryState = Array(36).fill(null);
    if (activeBot) {
        if (activeBot.compassTimer) clearTimeout(activeBot.compassTimer);
        if (activeBot.anvilCheckTimer) clearTimeout(activeBot.anvilCheckTimer);
        try { activeBot.quit(); } catch (e) {}
        activeBot = null;
    }
}

// -------------------------------------------------------------
// ระบบทิ้งของทั้งหมด ยกเว้นกรงสปาว แล้ววาร์ปกลับจุดเดิม
// -------------------------------------------------------------
async function executeClearInventory(bot) {
    if (!bot || !bot.entity || isClearing) return;
    isClearing = true;

    if (currentWindow) {
        try { bot.closeWindow(currentWindow); } catch (e) {}
        currentWindow = null;
        guiState.isOpen = false;
    }

    log(`[🏠] กระเป๋าเต็ม! กำลังพิมพ์คำสั่ง /home home เพื่อไปทิ้งของ...`);
    updateStatus('Clearing Items', 'พิมพ์ /home home (รอ 10s)');
    bot.chat('/home home');

    await wait(10000);
    log(`[📍] วาร์ปถึง /home เรียบร้อย -> กำลังสแกนทิ้งไอเทมยกเว้นกรงสปาว...`);
    updateStatus('Clearing Items', 'กำลังโยนไอเทมออกจากตัว...');

    syncInventorySlots(bot);

    const items = bot.inventory.items();
    let tossedCount = 0;

    for (const item of items) {
        const rawName = item.name ? item.name.toLowerCase() : '';
        const displayName = parseItemText(item.customName || item.displayName || '').toLowerCase();
        const isSpawner = rawName.includes('spawner') || displayName.includes('spawner') || displayName.includes('กรง');

        if (!isSpawner) {
            try {
                log(`[🗑️] โยนทิ้ง: ${item.name} x${item.count}`);
                await bot.tossStack(item);
                tossedCount++;
                await wait(120); // เร่งความเร็วการโยนทิ้ง
            } catch (err) {
                logError(`[-] โยนไอเทม ${item.name} ไม่สำเร็จ: ${err.message}`);
            }
        } else {
            log(`[💎] เก็บไว้ (ไม่ทิ้ง): ${item.name} x${item.count}`);
        }
    }

    syncInventorySlots(bot);
    log(`[✓] โยนของทิ้งเสร็จสิ้น (${tossedCount} กอง) -> เตรียมวาร์ปกลับจุดสุ่ม...`);
    updateStatus('Returning', 'พิมพ์ /warp crates (รอ 10s)');

    bot.chat('/warp crates');
    await wait(10000);

    log(`[🚶] วาร์ปมา Crates สำเร็จ -> กำลังเดินกลับไปหน้า Shulker Box (${TARGET_POS.x}, ${TARGET_POS.y}, ${TARGET_POS.z})...`);
    updateStatus('Returning', `เดินกลับพิกัด (${TARGET_POS.x}, ${TARGET_POS.y}, ${TARGET_POS.z})`);

    const defaultMove = new Movements(bot, sharedData);
    defaultMove.canDig = false;
    bot.pathfinder.setMovements(defaultMove);

    try {
        await bot.pathfinder.goto(new GoalBlock(TARGET_POS.x, TARGET_POS.y, TARGET_POS.z));
        log(`[📍] กลับถึงหน้า Shulker Box เรียบร้อย! ตัวโล่งพร้อมสุ่มต่อ`);
        updateStatus('Online', 'พร้อมสุ่มต่อ (เคลียร์ของเสร็จสิ้น)');
    } catch (err) {
        logError(`[-] Pathfinder เดินกลับพลาด: ${err.message}`);
        updateStatus('Online', 'กลับมาถึงแล้ว (พร้อมทำงาน)');
    }

    isClearing = false;
}

// -------------------------------------------------------------
// สั่งเปิด Shulker Box
// -------------------------------------------------------------
async function openShulkerDirectly(bot) {
    if (!bot || !bot.entity) return;

    syncInventorySlots(bot);
    if (isInventoryFull(bot)) {
        log(`[🛑 FULL] ตรวจพบช่องเก็บของเต็มก่อนเปิด Shulker -> ไปทิ้งของอัตโนมัติ...`);
        await executeClearInventory(bot);
        return;
    }

    log(`[🧎] กดย่อ (Sneak) และเปิด Shulker Box...`);
    updateStatus('Running Crate', 'กดย่อเปิด Shulker Box');
    
    bot.setControlState('sneak', true);
    await wait(200);

    const shulkerBlock = bot.findBlock({
        matching: block => block && block.name.includes('shulker_box'),
        maxDistance: 4
    });

    if (shulkerBlock) {
        try {
            await bot.activateBlock(shulkerBlock);
            log(`[🖱️] คลิกขวาที่ Shulker Box สำเร็จ!`);
        } catch (e) {
            logError(`[-] คลิกขวา Shulker ล้มเหลว: ${e.message}`);
        }
    } else {
        const frontBlock = bot.blockAtCursor(4);
        if (frontBlock) {
            try { await bot.activateBlock(frontBlock); } catch (e) {}
        }
    }

    setTimeout(() => {
        if (activeBot) activeBot.setControlState('sneak', false);
    }, 600);
}

// -------------------------------------------------------------
// ลำดับการเดิน/วาร์ปไปเป้าหมาย
// -------------------------------------------------------------
async function executeCrateRoutine(bot) {
    if (!bot || !bot.entity) return;

    syncInventorySlots(bot);
    if (isInventoryFull(bot)) {
        log(`[🛑 FULL] ช่องเก็บของเต็ม -> ไปทิ้งของอัตโนมัติ...`);
        await executeClearInventory(bot);
        return;
    }

    const currentPos = bot.entity.position;
    const dist = currentPos.distanceTo(TARGET_POS);

    if (dist <= 1.5) {
        log(`[⚡] ตัวละครยืนอยู่ที่พิกัดเป้าหมายอยู่แล้ว -> เปิด Shulker ทันที`);
        await openShulkerDirectly(bot);
        return;
    }

    log(`[🎲] เริ่มเดิน/วาร์ปไปพิกัดเป้าหมาย...`);
    updateStatus('Running Crate', 'พิมพ์คำสั่ง /warp crates');

    bot.chat('/warp crates');
    await wait(10000);

    const defaultMove = new Movements(bot, sharedData);
    defaultMove.canDig = false;
    bot.pathfinder.setMovements(defaultMove);

    try {
        await bot.pathfinder.goto(new GoalBlock(TARGET_POS.x, TARGET_POS.y, TARGET_POS.z));
    } catch (err) {}

    await openShulkerDirectly(bot);
}

// -------------------------------------------------------------
// ระบบ Auto-Reroll ความเร็วสูง (Fast Packet Loop)
// -------------------------------------------------------------
async function runAutoReroll() {
    if (!activeBot || isAutoRolling || isClearing) return;
    isAutoRolling = true;
    log(`[⚡] เริ่มระบบ Auto-Reroll ความเร็วสูง (Fast Mode)...`);

    while (isAutoRolling && activeBot) {
        syncInventorySlots(activeBot);

        if (isInventoryFull(activeBot)) {
            log(`[🛑 AUTO CLEAR] ช่องเก็บของเต็ม 36 ช่อง -> รันระบบไปทิ้งของอัตโนมัติ...`);
            await executeClearInventory(activeBot);
            await wait(500);
            continue;
        }

        if (!currentWindow || !guiState.isOpen) {
            log(`[🔄] หน้าต่าง GUI ยังไม่เปิด -> กำลังเปิด Shulker Box...`);
            currentRollCount = 0;
            guiState.rollCount = 0;
            await openShulkerDirectly(activeBot);
            await wait(1000);
            continue;
        }

        // เช็กสล็อต 13 ทุก 60ms เพื่อดึงข้อมูลไอเทมทันทีที่เซิร์ฟเวอร์ตอบกลับ
        let item13 = currentWindow.slots[13];
        let retry = 0;
        while (!item13 && retry < 15) {
            await wait(60);
            item13 = currentWindow.slots[13];
            retry++;
        }

        syncWindowSlots(currentWindow);

        if (!item13) {
            await wait(150);
            continue;
        }

        if (currentRollCount === 0) currentRollCount = 1;
        guiState.rollCount = currentRollCount;

        const rawName = item13.name ? item13.name.toLowerCase() : '';
        const displayName = parseItemText(item13.customName || item13.displayName || '');
        const fullItemDesc = `${displayName} (${item13.name} x${item13.count})`;

        log(`[🔎 รอบที่ ${currentRollCount}/3] Slot 13: ${fullItemDesc}`);

        const isCowSpawner = (rawName.includes('spawner') || displayName.includes('Spawner') || displayName.includes('กรง')) &&
                             (displayName.toLowerCase().includes('cow') || displayName.includes('วัว'));

        if (isCowSpawner) {
            log(`🎉🎉 [COW SPAWNER FOUND!] เจอกรงวัวแล้ว! กด Confirm (Slot 10)...`);
            guiState.spawnerFound = true;

            await activeBot.clickWindow(10, 0, 0);
            await wait(400);
            try { activeBot.closeWindow(currentWindow); } catch(e){}

            currentWindow = null;
            guiState.isOpen = false;
            currentRollCount = 0;
            guiState.rollCount = 0;

            syncInventorySlots(activeBot);
            log(`[🔁] สุ่มต่อรอบใหม่ทันที...`);
            await wait(300);
            continue;
        }

        if (currentRollCount >= 3) {
            log(`[⚠️] สุ่มครบ 3 ครั้งแล้ว -> กด Confirm (Slot 10) รับของ...`);
            await activeBot.clickWindow(10, 0, 0);
            await wait(400);
            try { activeBot.closeWindow(currentWindow); } catch(e){}

            currentWindow = null;
            guiState.isOpen = false;
            currentRollCount = 0;
            guiState.rollCount = 0;

            syncInventorySlots(activeBot);
            log(`[🔁] เปิด Shulker Box สุ่มรอบถัดไป...`);
            await wait(300);
            continue;
        }

        // ยิงคลิก Reroll (Slot 15) ทันที
        log(`[⏩] กด Reroll (Slot 15)...`);
        try {
            await activeBot.clickWindow(15, 0, 0);
            currentRollCount++;
            guiState.rollCount = currentRollCount;
        } catch (err) {
            logError(`[-] กด Reroll พลาด: ${err.message}`);
            break;
        }

        // หน่วงเวลา 350ms เพื่อให้เซิร์ฟเวอร์เปลี่ยนไอเทมใน Slot 13
        await wait(350);
    }

    isAutoRolling = false;
}

// -------------------------------------------------------------
// สร้าง Instance บอท
// -------------------------------------------------------------
function startBot() {
    stopBot();
    botStatus.enabled = true;
    updateStatus('Connecting', 'กำลังเชื่อมต่อ...');
    log(`[+] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ด้วย ${BOT_USERNAME}...`);

    const bot = mineflayer.createBot({
        host: SERVER_HOST,
        port: SERVER_PORT,
        username: BOT_USERNAME,
        version: MC_VERSION,
        data: sharedData,
        physicsEnabled: true,
        checkTimeoutInterval: 60000
    });

    bot.loadPlugin(pathfinder);
    activeBot = bot;
    bot.authStage = 'START';

    bot.on('kicked', (reason) => {
        let kickReasonStr = reason;
        try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
        logError(`[🚨 KICKED] โดนเตะ: ${kickReasonStr}`);
        updateStatus('Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
    });

    bot.on('setSlot', () => {
        syncInventorySlots(bot);
    });

    bot.on('windowOpen', async (window) => {
        currentWindow = window;
        const rawTitle = parseItemText(window.title);
        log(`[🪟] GUI เปิด: "${rawTitle}" | Type: ${window.type}`);

        if (isCrateWindow(rawTitle)) {
            guiState.isOpen = true;
            guiState.title = rawTitle;

            syncWindowSlots(window);

            window.on('updateSlot', (slot, oldItem, newItem) => {
                if (slot < 27) {
                    if (newItem) {
                        guiState.slots[slot] = {
                            name: newItem.name,
                            count: newItem.count,
                            displayName: parseItemText(newItem.customName || newItem.displayName || newItem.name)
                        };
                    } else {
                        guiState.slots[slot] = null;
                    }
                }
            });

            updateStatus('In Crate GUI', 'เปิดหน้าต่างกล่องสุ่มแล้ว');
            return;
        }

        if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'START') {
            bot.authStage = 'OPENING_ANVIL';
            updateStatus('Logging in', 'รอเปิด Anvil (Slot 1)');
            setTimeout(async () => {
                try {
                    await bot.clickWindow(1, 0, 0);
                    bot.anvilCheckTimer = setTimeout(() => {
                        if (bot.authStage === 'OPENING_ANVIL') triggerLobbyCompass(bot);
                    }, 4000);
                } catch (e) {}
            }, 3500);
        } else if (window.type === 'minecraft:anvil' && (bot.authStage === 'OPENING_ANVIL' || bot.authStage === 'START')) {
            if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
            bot.authStage = 'PASS_TYPED';
            updateStatus('Logging in', 'กำลังพิมพ์รหัสผ่าน');
            setTimeout(() => {
                try {
                    bot._client.write('name_item', { name: BOT_PASSWORD });
                    setTimeout(async () => { await bot.clickWindow(2, 0, 0); }, 1500);
                } catch (e) {}
            }, 2500);
        } else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'PASS_TYPED') {
            updateStatus('Logging in', 'กด Slot 2 ยืนยัน');
            setTimeout(async () => {
                try {
                    await bot.clickWindow(2, 0, 0);
                    triggerLobbyCompass(bot);
                } catch (e) {}
            }, 2500);
        } else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'WAIT_COMPASS_MENU') {
            bot.authStage = 'SURVIVAL_DONE';
            updateStatus('Selecting Mode', 'เลือก Survival (Slot 10)');
            setTimeout(async () => {
                try {
                    await bot.clickWindow(10, 0, 0);
                    updateStatus('Entering Survival', 'กำลังวาร์ปเข้า Survival (รอ 12s)');
                    setTimeout(() => {
                        updateStatus('Online', 'พร้อมทำงาน (กดปุ่มสุ่มได้)');
                        syncInventorySlots(bot);
                    }, 12000);
                } catch (err) {}
            }, 3000);
        }
    });

    bot.on('windowClose', () => {
        currentWindow = null;
        guiState.isOpen = false;
        guiState.slots = Array(27).fill(null);
        syncInventorySlots(bot);
        log(`[✖] หน้าต่าง GUI ถูกปิด`);
    });

    bot.on('spawn', () => {
        log(`[✓] บอทโหลดฉากสำเร็จ`);
        syncInventorySlots(bot);
    });

    bot.on('error', (err) => updateStatus('Error', err.message, err.message));

    bot.on('end', (reason) => {
        stopBot();
        if (botStatus.enabled) {
            updateStatus('Offline', `หลุด (${reason})`, reason);
            setTimeout(startBot, 30000);
        } else {
            updateStatus('Stopped', 'ระงับการทำงาน');
        }
    });
}

function triggerLobbyCompass(bot) {
    if (bot.compassTimer) clearTimeout(bot.compassTimer);
    bot.authStage = 'IN_LOBBY';
    updateStatus('In Lobby', 'วาร์ปเข้า Lobby (รอ 13s)');
    bot.compassTimer = setTimeout(async () => {
        const compass = bot.inventory ? bot.inventory.items().find(i => i.name.includes('compass')) : null;
        if (compass) {
            try {
                await bot.equip(compass, 'hand');
                await wait(3000);
            } catch (e) {}
        }
        bot.authStage = 'WAIT_COMPASS_MENU';
        bot.activateItem();
    }, 13000);
}

// -------------------------------------------------------------
// Web Server + Dashboard
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const path = parsedUrl.pathname;

    if (path === '/api/status') {
        if (activeBot) syncInventorySlots(activeBot);
        const invFull = activeBot ? isInventoryFull(activeBot) : false;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ 
            bot: botStatus, 
            gui: guiState, 
            inventory: inventoryState,
            isAutoRolling, 
            isClearing,
            isInventoryFull: invFull 
        }));
        return;
    }

    if (path === '/api/control') {
        const action = parsedUrl.searchParams.get('action');

        if (action === 'start') startBot();
        else if (action === 'stop') stopBot();
        else if (action === 'spin') {
            if (activeBot && botStatus.status.includes('Online')) executeCrateRoutine(activeBot);
        }
        else if (action === 'confirm') {
            if (activeBot && currentWindow) activeBot.clickWindow(10, 0, 0);
        }
        else if (action === 'reroll') {
            if (activeBot && currentWindow) activeBot.clickWindow(15, 0, 0);
        }
        else if (action === 'autoroll') {
            runAutoReroll();
        }
        else if (action === 'stoproll') {
            isAutoRolling = false;
        }
        else if (action === 'clearinv') {
            if (activeBot && botStatus.status.includes('Online')) executeClearInventory(activeBot);
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minecraft Crate Live GUI</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .container { width: 680px; }
        .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        h2 { margin-top: 0; color: #4caf50; display: flex; justify-content: space-between; align-items: center; }
        
        .chest-container { background: #c6c6c6; border: 4px solid #373737; border-radius: 4px; padding: 12px; margin: 15px 0; color: #373737; }
        .chest-title { font-weight: bold; margin-bottom: 8px; font-size: 15px; display: flex; justify-content: space-between; }
        .chest-grid { display: grid; grid-template-columns: repeat(9, 44px); grid-gap: 4px; justify-content: center; }
        .slot { width: 44px; height: 44px; background: #8b8b8b; border: 2px solid #373737; border-top-color: #373737; border-left-color: #373737; border-bottom-color: #fff; border-right-color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; font-size: 11px; cursor: default; }
        
        .slot-target { background: #ffe082; border: 2px solid #ffb300; }
        .slot-confirm { background: #c8e6c9; border: 2px solid #4caf50; cursor: pointer; }
        .slot-reroll { background: #ffcdd2; border: 2px solid #f44336; cursor: pointer; }
        
        .inv-empty { background: #424242 !important; }
        .inv-filled { background: #2e7d32 !important; border: 2px solid #4caf50 !important; }
        .inv-spawner { background: #8e24aa !important; border: 2px solid #ba68c8 !important; animation: glow 1.2s infinite alternate; }
        
        .inv-divider { height: 6px; }
        .legend { display: flex; gap: 15px; font-size: 12px; margin-top: 8px; justify-content: center; color: #222; }
        .legend-box { width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px; border-radius: 2px; }

        .item-count { position: absolute; bottom: 1px; right: 3px; font-weight: bold; color: #fff; text-shadow: 1px 1px #000; font-size: 11px; }
        .item-icon { font-size: 18px; }
        
        .btn-group { display: flex; gap: 8px; margin-bottom: 12px; }
        button { flex: 1; padding: 10px; font-weight: bold; border-radius: 5px; cursor: pointer; border: none; font-size: 14px; transition: 0.2s; }
        button:hover { filter: brightness(1.1); }
        button:disabled { background: #444 !important; color: #777 !important; cursor: not-allowed; }
        
        .btn-start { background: #2e7d32; color: #fff; }
        .btn-stop { background: #c62828; color: #fff; }
        .btn-warp { background: #1565c0; color: #fff; }
        .btn-clear { background: #795548; color: #fff; }
        .btn-auto { background: #ff9800; color: #fff; }
        .btn-stop-auto { background: #d32f2f; color: #fff; }

        .status-box { background: #2a2a2a; border-radius: 4px; padding: 12px; font-size: 13px; line-height: 1.6; }
        .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-danger { background: #d32f2f; color: #fff; }
        .badge-success { background: #388e3c; color: #fff; }
        @keyframes glow { from { box-shadow: 0 0 2px #ba68c8; } to { box-shadow: 0 0 8px #e1bee7; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h2>
                <span>🎲 Kureeman Crate Live GUI</span>
                <span id="txtStatus" style="font-size: 14px;">-</span>
            </h2>

            <div class="btn-group">
                <button class="btn-start" onclick="sendAction('start')">▶ Start Bot</button>
                <button class="btn-stop" onclick="sendAction('stop')">⏹ Stop Bot</button>
                <button class="btn-warp" id="btnWarp" onclick="sendAction('spin')">🎲 เปิดกล่อง</button>
                <button class="btn-clear" id="btnClearInv" onclick="sendAction('clearinv')">🗑️ ทิ้งของ (/home)</button>
            </div>

            <div class="chest-container">
                <div class="chest-title">
                    <span id="guiTitle">📦 รอเปิด GUI จากในเกม...</span>
                    <span id="rollCounter" style="color: #1565c0;">รอบที่: 0/3</span>
                </div>
                <div class="chest-grid" id="chestGrid"></div>
            </div>

            <div class="chest-container" style="background: #b0bec5;">
                <div class="chest-title" style="color: #263238;">
                    <span>🎒 ช่องเก็บของตัวละคร (Inventory 36 ช่อง)</span>
                    <span id="invCountText">ใช้ไป: 0/36 ช่อง</span>
                </div>
                <div class="chest-grid" id="invGrid"></div>
                <div class="inv-divider"></div>
                <div class="chest-grid" id="hotbarGrid"></div>
                <div class="legend">
                    <span><span class="legend-box" style="background:#424242;"></span> ว่าง (เทา)</span>
                    <span><span class="legend-box" style="background:#2e7d32;"></span> มีของ (เขียว)</span>
                    <span><span class="legend-box" style="background:#8e24aa;"></span> กรงสปาว (ม่วง)</span>
                </div>
            </div>

            <div class="btn-group">
                <button style="background: #4caf50; color: #fff;" onclick="sendAction('confirm')">✔ Confirm (เขียว)</button>
                <button style="background: #f44336; color: #fff;" onclick="sendAction('reroll')">🔁 Reroll (แดง)</button>
                <button class="btn-auto" id="btnAutoRoll" onclick="sendAction('autoroll')">⚡ Auto-Reroll เร็วต่อเนื่อง</button>
            </div>

            <div class="status-box">
                <div><b>ขั้นตอน:</b> <span id="txtStep">-</span></div>
                <div><b>เป้าหมาย Slot 13:</b> <span id="targetDetail" style="color: #ffd54f; font-weight: bold;">-</span></div>
                <div><b>ช่องเก็บของ (Inventory):</b> <span id="invStatus">-</span></div>
                <div><b>Log:</b> <span id="txtError" style="color: #ff8a65;">-</span></div>
            </div>
        </div>
    </div>

    <script>
        function getItemVisual(name) {
            if (!name) return { icon: '' };
            if (name.includes('glass_pane')) return { icon: '🪟' };
            if (name.includes('spawner')) return { icon: '🔥' };
            if (name.includes('gold')) return { icon: '🟡' };
            if (name.includes('iron')) return { icon: '⚪' };
            if (name.includes('beef') || name.includes('porkchop')) return { icon: '🥩' };
            if (name.includes('diamond')) return { icon: '💎' };
            return { icon: '📦' };
        }

        async function sendAction(action) {
            await fetch('/api/control?action=' + action);
            fetchStatus();
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                document.getElementById('txtStatus').innerText = data.bot.status;
                document.getElementById('txtStep').innerText = data.bot.step;
                document.getElementById('txtError').innerText = data.bot.lastError;
                
                const isOnline = data.bot.status.includes('Online');
                document.getElementById('btnWarp').disabled = !isOnline || data.isClearing;
                document.getElementById('btnClearInv').disabled = !isOnline || data.isClearing;
                
                document.getElementById('rollCounter').innerText = 'รอบที่: ' + data.gui.rollCount + '/3';

                const invStatus = document.getElementById('invStatus');
                if (data.isInventoryFull) {
                    invStatus.innerHTML = '<span class="badge badge-danger">ช่องเก็บของเต็ม (36/36)</span>';
                } else {
                    invStatus.innerHTML = '<span class="badge badge-success">มีพื้นที่ว่าง</span>';
                }

                const autoBtn = document.getElementById('btnAutoRoll');
                if (data.isAutoRolling) {
                    autoBtn.innerText = '⏹ หยุด Auto-Reroll';
                    autoBtn.className = 'btn-stop-auto';
                    autoBtn.onclick = () => sendAction('stoproll');
                } else {
                    autoBtn.innerText = '⚡ Auto-Reroll เร็วต่อเนื่อง';
                    autoBtn.className = 'btn-auto';
                    autoBtn.onclick = () => sendAction('autoroll');
                }

                const grid = document.getElementById('chestGrid');
                grid.innerHTML = '';
                document.getElementById('guiTitle').innerText = data.gui.isOpen ? '📦 ' + data.gui.title : '📦 หน้าต่างปิดอยู่';

                for (let i = 0; i < 27; i++) {
                    const slotDiv = document.createElement('div');
                    slotDiv.className = 'slot';

                    if (i === 13) slotDiv.classList.add('slot-target');
                    else if (i === 10 || i === 11) slotDiv.classList.add('slot-confirm');
                    else if (i === 15 || i === 16) slotDiv.classList.add('slot-reroll');

                    const item = data.gui.slots[i];
                    if (item) {
                        const visual = getItemVisual(item.name);
                        slotDiv.title = item.displayName + ' (' + item.name + ')';
                        slotDiv.innerHTML = '<span class="item-icon">' + visual.icon + '</span>' + 
                                            (item.count > 1 ? '<span class="item-count">' + item.count + '</span>' : '');
                    }
                    grid.appendChild(slotDiv);
                }

                const invGrid = document.getElementById('invGrid');
                const hotbarGrid = document.getElementById('hotbarGrid');
                invGrid.innerHTML = '';
                hotbarGrid.innerHTML = '';

                let usedCount = 0;

                data.inventory.forEach((slot, idx) => {
                    const slotDiv = document.createElement('div');
                    slotDiv.className = 'slot';

                    if (!slot || slot.type === 'empty') {
                        slotDiv.classList.add('inv-empty');
                        slotDiv.title = 'ช่องว่าง (' + (idx + 1) + ')';
                    } else if (slot.type === 'spawner') {
                        slotDiv.classList.add('inv-spawner');
                        slotDiv.title = slot.displayName + ' (กรงสปาว x' + slot.count + ')';
                        usedCount++;
                    } else {
                        slotDiv.classList.add('inv-filled');
                        slotDiv.title = slot.displayName + ' (' + slot.name + ' x' + slot.count + ')';
                        usedCount++;
                    }

                    if (idx < 27) {
                        invGrid.appendChild(slotDiv);
                    } else {
                        hotbarGrid.appendChild(slotDiv);
                    }
                });

                document.getElementById('invCountText').innerText = 'ใช้ไป: ' + usedCount + '/36 ช่อง';

                const target = data.gui.slots[13];
                if (target) {
                    document.getElementById('targetDetail').innerText = target.displayName + ' (' + target.name + ' x' + target.count + ')';
                } else {
                    document.getElementById('targetDetail').innerText = '-';
                }

            } catch (e) {}
        }

        fetchStatus();
        setInterval(fetchStatus, 300);
    </script>
</body>
</html>
    `);
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

server.listen(WEB_PORT, () => {
    log('==================================================');
    log(`🚀 CRATE BOT LIVE GUI READY`);
    log(` [+] Bot Name       : ${BOT_USERNAME}`);
    log(` [🌐] Web Dashboard : http://${getLocalIP()}:${WEB_PORT}`);
    log('==================================================');
});