const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3').Vec3;

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const MC_VERSION = '1.20.1';
const WEB_PORT = 3010;

const sharedData = minecraftData(MC_VERSION);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(name, msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.log(`[${time}] [${name}] ${msg}`);
}

function logError(name, msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.error(`[${time}] [${name}] ${msg}`);
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
        try { return extractText(JSON.parse(raw)); } catch { return raw; }
    }
    return extractText(raw);
}

function isCrateWindow(title) {
    if (!title) return false;
    const t = title.toLowerCase();
    return t.includes('confirm') || t.includes('reroll') || t.includes('ᴄᴏɴғɪʀᴍ') || t.includes('ʀᴇʀᴏʟʟ');
}

function getContainerSlotCount(window) {
    if (!window) return 27;
    if (window.type === 'minecraft:generic_9x6') return 54;
    if (window.type === 'minecraft:generic_9x5') return 45;
    if (window.type === 'minecraft:generic_9x4') return 36;
    if (window.type === 'minecraft:generic_9x3') return 27;
    if (window.type === 'minecraft:generic_9x2') return 18;
    if (window.type === 'minecraft:generic_9x1') return 9;
    return Math.max(0, window.slots.length - 36);
}

// -------------------------------------------------------------
// คลาสตัวจัดการบอทแต่ละตัว
// -------------------------------------------------------------
class CrateBotWorker {
    constructor(username, password, targetPos, facingDirection = null) {
        this.username = username;
        this.password = password;
        this.targetPos = targetPos;
        this.facingDirection = facingDirection; // เช่น 'north'

        this.bot = null;
        this.currentWindow = null;
        this.isAutoRolling = false;
        this.isClearing = false;
        this.currentRollCount = 0;
        this.totalSpawnersCount = 0;
        this.rareKeyCount = '-';

        this.status = {
            name: username,
            status: 'Stopped',
            step: 'รอสั่งเปิดจากหน้าเว็บ...',
            lastError: '-',
            lastUpdate: new Date().toLocaleTimeString('th-TH', { hour12: false }),
            enabled: false
        };

        this.guiState = {
            isOpen: false,
            title: 'ยังไม่ได้เปิด GUI',
            type: 'crate',
            totalSlots: 27,
            slots: Array(54).fill(null),
            spawnerFound: false,
            rollCount: 0
        };

        this.inventoryState = Array(36).fill(null);
    }

    updateStatus(status, step, errorReason = null) {
        this.status.status = status;
        if (step) this.status.step = step;
        if (errorReason) this.status.lastError = errorReason;
        this.status.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour12: false });
    }

    syncWindowSlots(window) {
        if (!window) return;
        const count = getContainerSlotCount(window);
        this.guiState.totalSlots = count;
        this.guiState.slots = Array(count).fill(null);

        for (let i = 0; i < count; i++) {
            const item = window.slots[i];
            if (item) {
                this.guiState.slots[i] = {
                    name: item.name,
                    count: item.count,
                    displayName: parseItemText(item.customName || item.displayName || item.name)
                };
            } else {
                this.guiState.slots[i] = null;
            }
        }
    }

    syncInventorySlots() {
        if (!this.bot || !this.bot.inventory || !this.bot.inventory.slots) {
            this.inventoryState = Array(36).fill(null);
            this.totalSpawnersCount = 0;
            return;
        }

        let spawnerCounter = 0;
        for (let i = 0; i < 36; i++) {
            const item = this.bot.inventory.slots[9 + i];
            if (item) {
                const rawName = item.name ? item.name.toLowerCase() : '';
                const displayName = parseItemText(item.customName || item.displayName || '').toLowerCase();
                const isSpawner = rawName.includes('spawner') || displayName.includes('spawner') || displayName.includes('กรง');

                if (isSpawner) spawnerCounter += item.count;

                this.inventoryState[i] = {
                    type: isSpawner ? 'spawner' : 'filled',
                    name: item.name,
                    count: item.count,
                    displayName: parseItemText(item.customName || item.displayName || item.name)
                };
            } else {
                this.inventoryState[i] = { type: 'empty' };
            }
        }
        this.totalSpawnersCount = spawnerCounter;
    }

    isInventoryFull() {
        if (!this.bot || !this.bot.inventory || !this.bot.inventory.slots) return false;
        const emptySlots = this.bot.inventory.slots.slice(9, 45).filter(item => item === null);
        return emptySlots.length === 0;
    }

    scanCrateHologram() {
        if (!this.bot || !this.bot.entities) return;

        const nearbyEntities = Object.values(this.bot.entities).filter(e => {
            if (!e || !e.position) return false;
            return e.position.distanceTo(this.targetPos) <= 5.0;
        });

        let rareCrateEntity = null;

        for (const ent of nearbyEntities) {
            let text = '';
            if (ent.customName) text += parseItemText(ent.customName);
            if (ent.metadata && Array.isArray(ent.metadata)) {
                for (const m of ent.metadata) {
                    if (typeof m === 'string') text += ' ' + parseItemText(m);
                    else if (typeof m === 'object' && m !== null) text += ' ' + extractText(m);
                }
            }

            const clean = text.toLowerCase();
            if (clean.includes('ʀᴀʀᴇ') || (clean.includes('rare') && clean.includes('crate'))) {
                rareCrateEntity = ent;
                break;
            }
        }

        if (rareCrateEntity) {
            for (const ent of nearbyEntities) {
                const horizontalDist = Math.hypot(
                    ent.position.x - rareCrateEntity.position.x,
                    ent.position.z - rareCrateEntity.position.z
                );

                if (horizontalDist <= 0.8) {
                    let entText = '';
                    if (ent.customName) entText += parseItemText(ent.customName);
                    if (ent.metadata && Array.isArray(ent.metadata)) {
                        for (const m of ent.metadata) {
                            if (typeof m === 'string') entText += ' ' + parseItemText(m);
                            else if (typeof m === 'object' && m !== null) entText += ' ' + extractText(m);
                        }
                    }

                    if (entText.includes('กุญแจ')) {
                        const match = entText.match(/คุณมี\s*([0-9,]+)\s*กุญแจ/i) || entText.match(/([0-9,]+)/);
                        if (match && match[1]) {
                            this.rareKeyCount = match[1];
                            break;
                        }
                    }
                }
            }
        }
    }

    async openShulkerDirectly() {
        if (!this.bot || !this.bot.entity) return;

        this.scanCrateHologram();
        this.syncInventorySlots();

        if (this.isInventoryFull()) {
            log(this.username, `[🛑 FULL] ตรวจพบช่องเก็บของเต็มก่อนเปิด Shulker -> ไปทิ้งของอัตโนมัติ...`);
            await this.executeClearInventory();
            return;
        }

        log(this.username, `[🧎] กดย่อ (Sneak) และเปิด Shulker Box...`);
        this.updateStatus('Running Crate', 'กดย่อเปิด Shulker Box');

        this.bot.setControlState('sneak', true);

        // หมุนตัวไปทาง North ถ้ากำหนดไว้ (North: yaw = Math.PI)
        if (this.facingDirection === 'north') {
            await this.bot.look(Math.PI, 0, true);
        }

        await wait(200);

        const shulkerBlock = this.bot.findBlock({
            matching: block => block && block.name.includes('shulker_box'),
            maxDistance: 4
        });

        if (shulkerBlock) {
            try {
                await this.bot.activateBlock(shulkerBlock);
                log(this.username, `[🖱️] คลิกขวาที่ Shulker Box สำเร็จ!`);
            } catch (e) {
                logError(this.username, `[-] คลิกขวา Shulker ล้มเหลว: ${e.message}`);
            }
        } else {
            const frontBlock = this.bot.blockAtCursor(4);
            if (frontBlock) {
                try { await this.bot.activateBlock(frontBlock); } catch (e) {}
            }
        }

        setTimeout(() => {
            if (this.bot) this.bot.setControlState('sneak', false);
        }, 600);
    }

    async executeCrateRoutine() {
        if (!this.bot || !this.bot.entity) return;

        this.syncInventorySlots();
        if (this.isInventoryFull()) {
            log(this.username, `[🛑 FULL] ช่องเก็บของเต็ม -> ไปทิ้งของอัตโนมัติ...`);
            await this.executeClearInventory();
            return;
        }

        const currentPos = this.bot.entity.position;
        const dist = currentPos.distanceTo(this.targetPos);

        if (dist <= 1.5) {
            log(this.username, `[⚡] ยืนอยู่ที่พิกัดเป้าหมายอยู่แล้ว -> เปิด Shulker ทันที`);
            await this.openShulkerDirectly();
            return;
        }

        log(this.username, `[🎲] เริ่มเดิน/วาร์ปไปพิกัดเป้าหมาย...`);
        this.updateStatus('Running Crate', 'พิมพ์คำสั่ง /warp crates');

        this.bot.chat('/warp crates');
        await wait(10000);

        const defaultMove = new Movements(this.bot, sharedData);
        defaultMove.canDig = false;
        this.bot.pathfinder.setMovements(defaultMove);

        try {
            await this.bot.pathfinder.goto(new GoalBlock(this.targetPos.x, this.targetPos.y, this.targetPos.z));
        } catch (err) {}

        await this.openShulkerDirectly();
    }

    async executeClearInventory() {
        if (!this.bot || !this.bot.entity || this.isClearing) return;
        this.isClearing = true;

        if (this.currentWindow) {
            try { this.bot.closeWindow(this.currentWindow); } catch (e) {}
            this.currentWindow = null;
            this.guiState.isOpen = false;
        }

        log(this.username, `[🏠] กระเป๋าเต็ม! พิมพ์คำสั่ง /home home เพื่อไปทิ้งของ...`);
        this.updateStatus('Clearing Items', 'พิมพ์ /home home (รอ 10s)');
        this.bot.chat('/home home');

        await wait(10000);
        log(this.username, `[📍] วาร์ปถึง /home เรียบร้อย -> สแกนทิ้งไอเทมยกเว้นกรงสปาว...`);
        this.updateStatus('Clearing Items', 'กำลังโยนไอเทมออกจากตัว...');

        this.syncInventorySlots();
        const items = this.bot.inventory.items();
        let tossedCount = 0;

        for (const item of items) {
            const rawName = item.name ? item.name.toLowerCase() : '';
            const displayName = parseItemText(item.customName || item.displayName || '').toLowerCase();
            const isSpawner = rawName.includes('spawner') || displayName.includes('spawner') || displayName.includes('กรง');

            if (!isSpawner) {
                try {
                    await this.bot.tossStack(item);
                    tossedCount++;
                    await wait(120);
                } catch (err) {}
            }
        }

        this.syncInventorySlots();
        log(this.username, `[✓] โยนของทิ้งเสร็จสิ้น (${tossedCount} กอง) -> เตรียมวาร์ปกลับจุดสุ่ม...`);
        this.updateStatus('Returning', 'พิมพ์ /warp crates (รอ 10s)');

        this.bot.chat('/warp crates');
        await wait(10000);

        log(this.username, `[🚶] วาร์ปมา Crates สำเร็จ -> เดินกลับพิกัด (${this.targetPos.x}, ${this.targetPos.y}, ${this.targetPos.z})...`);
        this.updateStatus('Returning', `เดินกลับพิกัด (${this.targetPos.x}, ${this.targetPos.y}, ${this.targetPos.z})`);

        const defaultMove = new Movements(this.bot, sharedData);
        defaultMove.canDig = false;
        this.bot.pathfinder.setMovements(defaultMove);

        try {
            await this.bot.pathfinder.goto(new GoalBlock(this.targetPos.x, this.targetPos.y, this.targetPos.z));
            this.updateStatus('Online', 'พร้อมสุ่มต่อ (เคลียร์ของเสร็จสิ้น)');
        } catch (err) {
            this.updateStatus('Online', 'กลับมาถึงแล้ว (พร้อมทำงาน)');
        }

        this.isClearing = false;
    }

    async runAutoReroll() {
        if (!this.bot || this.isAutoRolling || this.isClearing) return;
        this.isAutoRolling = true;
        log(this.username, `[⚡] เริ่มระบบ Auto-Reroll เต็มรูปแบบ...`);

        while (this.isAutoRolling && this.bot) {
            this.scanCrateHologram();
            this.syncInventorySlots();

            if (this.isInventoryFull()) {
                log(this.username, `[🛑 AUTO CLEAR] กระเป๋าเต็ม 36 ช่อง -> รันระบบไปทิ้งของอัตโนมัติ...`);
                await this.executeClearInventory();
                await wait(500);
                continue;
            }

            if (!this.currentWindow || !this.guiState.isOpen || this.guiState.type !== 'crate') {
                this.currentRollCount = 0;
                this.guiState.rollCount = 0;
                await this.openShulkerDirectly();
                await wait(1000);
                continue;
            }

            let item13 = this.currentWindow.slots[13];
            let retry = 0;
            while (!item13 && retry < 15) {
                await wait(60);
                item13 = this.currentWindow.slots[13];
                retry++;
            }

            this.syncWindowSlots(this.currentWindow);

            if (!item13) {
                await wait(150);
                continue;
            }

            if (this.currentRollCount === 0) this.currentRollCount = 1;
            this.guiState.rollCount = this.currentRollCount;

            const rawName = item13.name ? item13.name.toLowerCase() : '';
            const displayName = parseItemText(item13.customName || item13.displayName || '');
            const fullItemDesc = `${displayName} (${item13.name} x${item13.count})`;

            log(this.username, `[🔎 รอบที่ ${this.currentRollCount}/3] Slot 13: ${fullItemDesc}`);

            const isCowSpawner = (rawName.includes('spawner') || displayName.includes('Spawner') || displayName.includes('กรง')) &&
                                 (displayName.toLowerCase().includes('cow') || displayName.includes('วัว'));

            if (isCowSpawner) {
                log(this.username, `🎉🎉 [COW SPAWNER FOUND!] เจอกรงวัวแล้ว! กด Confirm (Slot 10)...`);
                this.guiState.spawnerFound = true;

                await this.bot.clickWindow(10, 0, 0);
                await wait(400);
                try { this.bot.closeWindow(this.currentWindow); } catch (e) {}

                this.currentWindow = null;
                this.guiState.isOpen = false;
                this.currentRollCount = 0;
                this.guiState.rollCount = 0;

                this.syncInventorySlots();
                await wait(300);
                continue;
            }

            if (this.currentRollCount >= 3) {
                log(this.username, `[⚠️] สุ่มครบ 3 ครั้งแล้ว -> กด Confirm (Slot 10) รับของ...`);
                await this.bot.clickWindow(10, 0, 0);
                await wait(400);
                try { this.bot.closeWindow(this.currentWindow); } catch (e) {}

                this.currentWindow = null;
                this.guiState.isOpen = false;
                this.currentRollCount = 0;
                this.guiState.rollCount = 0;

                this.syncInventorySlots();
                await wait(300);
                continue;
            }

            try {
                await this.bot.clickWindow(15, 0, 0);
                this.currentRollCount++;
                this.guiState.rollCount = this.currentRollCount;
            } catch (err) {
                break;
            }

            await wait(350);
        }

        this.isAutoRolling = false;
    }

    openShopMenu() {
        if (!this.bot) return;
        this.isAutoRolling = false;
        log(this.username, `[🛒] พิมพ์คำสั่ง /shop...`);
        this.updateStatus('Opening Shop', 'พิมพ์ /shop (รอ GUI)');
        this.bot.chat('/shop');
    }

    start() {
        this.stop();
        this.status.enabled = true;
        this.updateStatus('Connecting', 'กำลังเชื่อมต่อ...');
        log(this.username, `[+] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...`);

        const bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: this.username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: true,
            checkTimeoutInterval: 60000
        });

        bot.loadPlugin(pathfinder);
        this.bot = bot;
        bot.authStage = 'START';

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            logError(this.username, `[🚨 KICKED] โดนเตะ: ${kickReasonStr}`);
            this.updateStatus('Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('setSlot', () => this.syncInventorySlots());

        bot.on('entityMoved', (entity) => {
            if (entity.position && entity.position.distanceTo(this.targetPos) <= 5) {
                this.scanCrateHologram();
            }
        });

        bot.on('windowOpen', async (window) => {
            this.currentWindow = window;
            const rawTitle = parseItemText(window.title);
            const count = getContainerSlotCount(window);
            log(this.username, `[🪟] GUI เปิด: "${rawTitle}" | Type: ${window.type} | Container Slots: ${count}`);

            this.guiState.isOpen = true;
            this.guiState.title = rawTitle || 'Shop / Menu';
            this.guiState.totalSlots = count;

            if (isCrateWindow(rawTitle)) {
                this.guiState.type = 'crate';
                this.syncWindowSlots(window);
                this.updateStatus('In Crate GUI', 'เปิดหน้าต่างกล่องสุ่มแล้ว');
            } else if (bot.authStage === 'SURVIVAL_DONE') {
                this.guiState.type = 'shop';
                this.syncWindowSlots(window);
                this.updateStatus('In Shop GUI', `เปิดหน้าร้านค้า: ${rawTitle}`);
            }

            window.on('updateSlot', (slot, oldItem, newItem) => {
                if (slot < this.guiState.totalSlots) {
                    if (newItem) {
                        this.guiState.slots[slot] = {
                            name: newItem.name,
                            count: newItem.count,
                            displayName: parseItemText(newItem.customName || newItem.displayName || newItem.name)
                        };
                    } else {
                        this.guiState.slots[slot] = null;
                    }
                }
            });

            // Authentication Routine
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'START') {
                bot.authStage = 'OPENING_ANVIL';
                this.updateStatus('Logging in', 'รอเปิด Anvil (Slot 1)');
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                        bot.anvilCheckTimer = setTimeout(() => {
                            if (bot.authStage === 'OPENING_ANVIL') this.triggerLobbyCompass();
                        }, 4000);
                    } catch (e) {}
                }, 3500);
            } else if (window.type === 'minecraft:anvil' && (bot.authStage === 'OPENING_ANVIL' || bot.authStage === 'START')) {
                if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
                bot.authStage = 'PASS_TYPED';
                this.updateStatus('Logging in', 'กำลังพิมพ์รหัสผ่าน');
                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: this.password });
                        setTimeout(async () => { await bot.clickWindow(2, 0, 0); }, 1500);
                    } catch (e) {}
                }, 2500);
            } else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'PASS_TYPED') {
                this.updateStatus('Logging in', 'กด Slot 2 ยืนยัน');
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        this.triggerLobbyCompass();
                    } catch (e) {}
                }, 2500);
            } else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'WAIT_COMPASS_MENU') {
                bot.authStage = 'SURVIVAL_DONE';
                this.updateStatus('Selecting Mode', 'เลือก Survival (Slot 10)');
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        this.updateStatus('Entering Survival', 'กำลังวาร์ปเข้า Survival (รอ 12s)');
                        setTimeout(() => {
                            this.updateStatus('Online', 'พร้อมทำงาน (กดปุ่มสุ่มได้)');
                            this.syncInventorySlots();
                            this.scanCrateHologram();
                        }, 12000);
                    } catch (err) {}
                }, 3000);
            }
        });

        bot.on('windowClose', () => {
            this.currentWindow = null;
            this.guiState.isOpen = false;
            this.guiState.slots = Array(54).fill(null);
            this.syncInventorySlots();
            this.scanCrateHologram();
            log(this.username, `[✖] หน้าต่าง GUI ถูกปิด`);
        });

        bot.on('spawn', () => {
            log(this.username, `[✓] โหลดฉากสำเร็จ`);
            this.syncInventorySlots();
            this.scanCrateHologram();
        });

        bot.on('error', (err) => this.updateStatus('Error', err.message, err.message));

        bot.on('end', (reason) => {
            this.stop();
            if (this.status.enabled) {
                this.updateStatus('Offline', `หลุด (${reason})`, reason);
                setTimeout(() => this.start(), 30000);
            } else {
                this.updateStatus('Stopped', 'ระงับการทำงาน');
            }
        });
    }

    triggerLobbyCompass() {
        if (this.bot.compassTimer) clearTimeout(this.bot.compassTimer);
        this.bot.authStage = 'IN_LOBBY';
        this.updateStatus('In Lobby', 'วาร์ปเข้า Lobby (รอ 13s)');
        this.bot.compassTimer = setTimeout(async () => {
            const compass = this.bot.inventory ? this.bot.inventory.items().find(i => i.name.includes('compass')) : null;
            if (compass) {
                try {
                    await this.bot.equip(compass, 'hand');
                    await wait(3000);
                } catch (e) {}
            }
            this.bot.authStage = 'WAIT_COMPASS_MENU';
            this.bot.activateItem();
        }, 13000);
    }

    stop() {
        this.isAutoRolling = false;
        this.isClearing = false;
        this.currentWindow = null;
        this.guiState.isOpen = false;
        this.inventoryState = Array(36).fill(null);
        this.totalSpawnersCount = 0;
        this.rareKeyCount = '-';
        if (this.bot) {
            if (this.bot.compassTimer) clearTimeout(this.bot.compassTimer);
            if (this.bot.anvilCheckTimer) clearTimeout(this.bot.anvilCheckTimer);
            try { this.bot.quit(); } catch (e) {}
            this.bot = null;
        }
    }
}

// -------------------------------------------------------------
// สร้าง Instance บอททั้ง 2 ตัว
// -------------------------------------------------------------
const bots = {
    'Kureeman': new CrateBotWorker('Kureeman', '112233', new Vec3(280, 88, 322)),
    'Juummeng': new CrateBotWorker('Juummeng', '112233', new Vec3(279, 88, 324), 'north')
};

// -------------------------------------------------------------
// Web Server + Dashboard
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const path = parsedUrl.pathname;
    const botName = parsedUrl.searchParams.get('bot') || 'Kureeman';
    const targetWorker = bots[botName];

    if (path === '/api/status') {
        const responseData = {};
        for (const [name, worker] of Object.entries(bots)) {
            if (worker.bot) {
                worker.syncInventorySlots();
                worker.scanCrateHologram();
            }
            responseData[name] = {
                bot: worker.status,
                gui: worker.guiState,
                inventory: worker.inventoryState,
                spawnerCount: worker.totalSpawnersCount,
                rareKeyCount: worker.rareKeyCount,
                isAutoRolling: worker.isAutoRolling,
                isClearing: worker.isClearing,
                isInventoryFull: worker.isInventoryFull()
            };
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(responseData));
        return;
    }

    if (path === '/api/control') {
        const action = parsedUrl.searchParams.get('action');

        if (targetWorker) {
            if (action === 'start') targetWorker.start();
            else if (action === 'stop') targetWorker.stop();
            else if (action === 'spin') {
                if (targetWorker.bot && targetWorker.status.status.includes('Online')) {
                    targetWorker.executeCrateRoutine().then(() => {
                        if (!targetWorker.isAutoRolling) targetWorker.runAutoReroll();
                    });
                }
            }
            else if (action === 'confirm') {
                if (targetWorker.bot && targetWorker.currentWindow) targetWorker.bot.clickWindow(10, 0, 0);
            }
            else if (action === 'reroll') {
                if (targetWorker.bot && targetWorker.currentWindow) targetWorker.bot.clickWindow(15, 0, 0);
            }
            else if (action === 'autoroll') {
                targetWorker.runAutoReroll();
            }
            else if (action === 'stoproll') {
                targetWorker.isAutoRolling = false;
            }
            else if (action === 'clearinv') {
                if (targetWorker.bot && targetWorker.status.status.includes('Online')) targetWorker.executeClearInventory();
            }
            else if (action === 'openshop') {
                if (targetWorker.bot && targetWorker.status.status.includes('Online')) targetWorker.openShopMenu();
            }
            else if (action === 'clickslot') {
                const slotNum = parseInt(parsedUrl.searchParams.get('slot'));
                if (targetWorker.bot && targetWorker.currentWindow && !isNaN(slotNum)) {
                    targetWorker.bot.clickWindow(slotNum, 0, 0).catch(() => {});
                }
            }
            else if (action === 'closegui') {
                if (targetWorker.bot && targetWorker.currentWindow) {
                    try { targetWorker.bot.closeWindow(targetWorker.currentWindow); } catch (e) {}
                    targetWorker.currentWindow = null;
                    targetWorker.guiState.isOpen = false;
                }
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minecraft Dual-Bot Crate & Shop Controller</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .container { width: 700px; }
        .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        h2 { margin-top: 0; color: #4caf50; display: flex; justify-content: space-between; align-items: center; }
        
        .tabs { display: flex; gap: 8px; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 8px; }
        .tab-btn { background: #2a2a2a; border: 1px solid #444; color: #bbb; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .tab-btn.active { background: #1565c0; color: #fff; border-color: #42a5f5; }

        .chest-container { background: #c6c6c6; border: 4px solid #373737; border-radius: 4px; padding: 12px; margin: 15px 0; color: #373737; }
        .chest-title { font-weight: bold; margin-bottom: 8px; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }
        .chest-grid { display: grid; grid-template-columns: repeat(9, 44px); grid-gap: 4px; justify-content: center; }
        
        .slot { width: 44px; height: 44px; background: #8b8b8b; border: 2px solid #373737; border-top-color: #373737; border-left-color: #373737; border-bottom-color: #fff; border-right-color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; font-size: 11px; cursor: default; user-select: none; }
        
        .slot-shop { cursor: pointer !important; transition: transform 0.05s, filter 0.1s; }
        .slot-shop:hover { filter: brightness(1.25); border-color: #ffd54f !important; }
        .slot-shop:active { transform: scale(0.92); }

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
        .btn-warp { background: #1565c0; color: #fff; font-size: 15px; }
        .btn-shop { background: #6a1b9a; color: #fff; }
        .btn-clear { background: #795548; color: #fff; }
        .btn-auto { background: #ff9800; color: #fff; }
        .btn-stop-auto { background: #d32f2f; color: #fff; }
        .btn-close-gui { background: #455a64; color: #fff; padding: 3px 8px; font-size: 12px; border-radius: 3px; }

        .status-box { background: #2a2a2a; border-radius: 4px; padding: 12px; font-size: 13px; line-height: 1.8; }
        .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-danger { background: #d32f2f; color: #fff; }
        .badge-success { background: #388e3c; color: #fff; }
        .badge-purple { background: #8e24aa; color: #fff; box-shadow: 0 0 6px #ba68c8; }
        .badge-gold { background: #f57f17; color: #fff; box-shadow: 0 0 6px #fbc02d; font-size: 13px; }
        .badge-shop { background: #ab47bc; color: #fff; }
        @keyframes glow { from { box-shadow: 0 0 2px #ba68c8; } to { box-shadow: 0 0 8px #e1bee7; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h2>
                <span>🤖 Minecraft Multi-Bot Controller</span>
                <span id="txtStatus" style="font-size: 14px;">-</span>
            </h2>

            <div class="tabs">
                <button id="tab-Kureeman" class="tab-btn active" onclick="switchBot('Kureeman')">👤 Kureeman (280, 88, 322)</button>
                <button id="tab-Juummeng" class="tab-btn" onclick="switchBot('Juummeng')">👤 Juummeng (279, 88, 324 [North])</button>
            </div>

            <div class="btn-group">
                <button class="btn-start" onclick="sendAction('start')">▶ Start Bot</button>
                <button class="btn-stop" onclick="sendAction('stop')">⏹ Stop Bot</button>
                <button class="btn-shop" id="btnShop" onclick="sendAction('openshop')">🛒 Shop (/shop)</button>
                <button class="btn-warp" id="btnWarp" onclick="sendAction('spin')">🎲 สุ่มอัตโนมัติ</button>
                <button class="btn-clear" id="btnClearInv" onclick="sendAction('clearinv')">🗑️ ทิ้งของ (/home)</button>
            </div>

            <!-- กล่อง GUI แสดงผลสด -->
            <div class="chest-container">
                <div class="chest-title">
                    <div>
                        <span id="guiTitle">📦 รอเปิด GUI จากในเกม...</span>
                        <span id="guiBadge" class="badge" style="display:none; margin-left: 6px;">-</span>
                    </div>
                    <div>
                        <span id="rollCounter" style="color: #1565c0; font-size: 13px;"></span>
                        <button id="btnCloseGui" class="btn-close-gui" style="display:none;" onclick="sendAction('closegui')">✖ ปิดหน้าต่าง</button>
                    </div>
                </div>
                <div class="chest-grid" id="chestGrid"></div>
            </div>

            <!-- กระเป๋าตัวละคร 36 ช่อง -->
            <div class="chest-container" style="background: #b0bec5;">
                <div class="chest-title" style="color: #263238;">
                    <span>🎒 กระเป๋าตัวละคร</span>
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

            <div class="btn-group" id="crateControls">
                <button style="background: #4caf50; color: #fff;" onclick="sendAction('confirm')">✔ Confirm (เขียว)</button>
                <button style="background: #f44336; color: #fff;" onclick="sendAction('reroll')">🔁 Reroll (แดง)</button>
                <button class="btn-auto" id="btnAutoRoll" onclick="sendAction('autoroll')">⚡ Auto-Reroll วนลูปไม่หยุด</button>
            </div>

            <div class="status-box">
                <div><b>ตัวละครปัจจุบัน:</b> <b id="currentBotLabel" style="color: #42a5f5;">Kureeman</b></div>
                <div><b>ขั้นตอน:</b> <span id="txtStep">-</span></div>
                <div id="targetSlotRow"><b>เป้าหมาย Slot 13:</b> <span id="targetDetail" style="color: #ffd54f; font-weight: bold;">-</span></div>
                <div><b>กุญแจ Rare คงเหลือ:</b> <span id="keyCountBadge" class="badge badge-gold">- กุญแจ</span></div>
                <div><b>จำนวนกรงสปาวที่ได้:</b> <span id="spawnerCountBadge" class="badge badge-purple">0 กรง</span></div>
                <div><b>ช่องเก็บของ (Inventory):</b> <span id="invStatus">-</span></div>
                <div><b>Log:</b> <span id="txtError" style="color: #ff8a65;">-</span></div>
            </div>
        </div>
    </div>

    <script>
        let currentSelectedBot = 'Kureeman';

        function switchBot(name) {
            currentSelectedBot = name;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-' + name).classList.add('active');
            document.getElementById('currentBotLabel').innerText = name;
            fetchStatus();
        }

        function getItemVisual(name) {
            if (!name) return { icon: '' };
            if (name.includes('glass_pane')) return { icon: '🪟' };
            if (name.includes('spawner')) return { icon: '🔥' };
            if (name.includes('gold')) return { icon: '🟡' };
            if (name.includes('iron')) return { icon: '⚪' };
            if (name.includes('beef') || name.includes('porkchop')) return { icon: '🥩' };
            if (name.includes('diamond')) return { icon: '💎' };
            if (name.includes('emerald')) return { icon: '🟢' };
            if (name.includes('sword') || name.includes('axe')) return { icon: '⚔️' };
            if (name.includes('pickaxe') || name.includes('shovel')) return { icon: '⛏️' };
            return { icon: '📦' };
        }

        async function sendAction(action) {
            await fetch('/api/control?bot=' + currentSelectedBot + '&action=' + action);
            fetchStatus();
        }

        async function clickShopSlot(slotIndex) {
            await fetch('/api/control?bot=' + currentSelectedBot + '&action=clickslot&slot=' + slotIndex);
            fetchStatus();
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const allData = await res.json();
                const data = allData[currentSelectedBot];
                if (!data) return;

                document.getElementById('txtStatus').innerText = data.bot.status;
                document.getElementById('txtStep').innerText = data.bot.step;
                document.getElementById('txtError').innerText = data.bot.lastError;
                
                const isOnline = data.bot.status.includes('Online');
                document.getElementById('btnWarp').disabled = !isOnline || data.isClearing;
                document.getElementById('btnClearInv').disabled = !isOnline || data.isClearing;
                document.getElementById('btnShop').disabled = !isOnline || data.isClearing;
                
                document.getElementById('spawnerCountBadge').innerText = (data.spawnerCount || 0) + ' กรง';
                document.getElementById('keyCountBadge').innerText = (data.rareKeyCount !== '-' ? data.rareKeyCount : '-') + ' กุญแจ';

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
                    autoBtn.innerText = '⚡ Auto-Reroll วนลูปไม่หยุด';
                    autoBtn.className = 'btn-auto';
                    autoBtn.onclick = () => sendAction('autoroll');
                }

                const isShop = (data.gui.type === 'shop');
                const guiBadge = document.getElementById('guiBadge');
                const rollCounter = document.getElementById('rollCounter');
                const btnCloseGui = document.getElementById('btnCloseGui');
                const targetSlotRow = document.getElementById('targetSlotRow');
                const crateControls = document.getElementById('crateControls');

                if (data.gui.isOpen) {
                    btnCloseGui.style.display = 'inline-block';
                    guiBadge.style.display = 'inline-block';
                    if (isShop) {
                        guiBadge.innerText = 'SHOP (คลิกช่องเพื่อซื้อ/เลือกได้)';
                        guiBadge.className = 'badge badge-shop';
                        rollCounter.innerText = '';
                        targetSlotRow.style.display = 'none';
                        crateControls.style.display = 'none';
                    } else {
                        guiBadge.innerText = 'CRATE';
                        guiBadge.className = 'badge badge-success';
                        rollCounter.innerText = 'รอบที่: ' + data.gui.rollCount + '/3';
                        targetSlotRow.style.display = 'block';
                        crateControls.style.display = 'flex';
                    }
                } else {
                    btnCloseGui.style.display = 'none';
                    guiBadge.style.display = 'none';
                    rollCounter.innerText = '';
                    targetSlotRow.style.display = 'block';
                    crateControls.style.display = 'flex';
                }

                const grid = document.getElementById('chestGrid');
                grid.innerHTML = '';
                document.getElementById('guiTitle').innerText = data.gui.isOpen ? '📦 ' + data.gui.title : '📦 หน้าต่างปิดอยู่';

                const totalSlots = data.gui.totalSlots || 27;

                for (let i = 0; i < totalSlots; i++) {
                    const slotDiv = document.createElement('div');
                    slotDiv.className = 'slot';

                    if (isShop) {
                        slotDiv.classList.add('slot-shop');
                        slotDiv.onclick = () => clickShopSlot(i);
                    } else {
                        if (i === 13) slotDiv.classList.add('slot-target');
                        else if (i === 10 || i === 11) slotDiv.classList.add('slot-confirm');
                        else if (i === 15 || i === 16) slotDiv.classList.add('slot-reroll');
                    }

                    const item = data.gui.slots[i];
                    if (item) {
                        const visual = getItemVisual(item.name);
                        slotDiv.title = 'Slot ' + i + ': ' + item.displayName + ' (' + item.name + ')';
                        slotDiv.innerHTML = '<span class="item-icon">' + visual.icon + '</span>' + 
                                            (item.count > 1 ? '<span class="item-count">' + item.count + '</span>' : '');
                    } else {
                        slotDiv.title = 'Slot ' + i + ': ช่องว่าง';
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
                if (target && !isShop) {
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
</html>`);
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
    log('SYSTEM', '==================================================');
    log('SYSTEM', `🚀 DUAL CRATE BOT READY`);
    log('SYSTEM', ` [+] Bot 1: Kureeman -> Coords: (280, 88, 322)`);
    log('SYSTEM', ` [+] Bot 2: Juummeng -> Coords: (279, 88, 324) Facing: North`);
    log('SYSTEM', ` [🌐] Web Dashboard : http://${getLocalIP()}:${WEB_PORT}`);
    log('SYSTEM', '==================================================');
});