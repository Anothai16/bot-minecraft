const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { SocksClient } = require('socks');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const DEFAULT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3000;

const sharedData = minecraftData(MC_VERSION);

function log(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.log(`[${time}] ${msg}`);
}

function logError(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.error(`[${time}] ${msg}`);
}

// รายชื่อบอท 80 ตัว
const BOT_CONFIGS = [
    { name: 'Skyz_Frost', pass: '112233' },
    { name: 'KuroNeko_99', pass: '112233' },
    { name: 'ChocoLatte_z', pass: '112233' },
    { name: 'KaiJiewGrob', pass: '112233' },
    { name: 'AeroStrike', pass: '112233' },
    { name: 'NongBeam2005', pass: '112233' },
    { name: 'BobaPanda', pass: '112233' },
    { name: 'KinKaoYang', pass: '112233' },
    { name: 'PixelDrift', pass: '112233' },
    { name: 'PeeSeuaNoy', pass: '112233' },
    { name: 'BasTanwa', pass: '112233' },
    { name: 'NightRaven', pass: '112233' },
    { name: 'MooKrobLover', pass: '112233' },
    { name: 'MintyChoc', pass: '112233' },
    { name: 'DekWatZa', pass: '112233' },
    { name: 'ZenithBlade', pass: '112233' },
    { name: 'FernNapatsara', pass: '112233' },
    { name: 'MaiRooReung', pass: '112233' },
    { name: 'CoffeeFirst', pass: '112233' },
    { name: 'VortexRider', pass: '112233' },
    { name: 'NongIceZa', pass: '112233' },
    { name: 'KhorThodKrub', pass: '112233' },
    { name: 'CyberPulse', pass: '112233' },
    { name: 'TaroMilkTea', pass: '112233' },
    { name: 'AraiKorDai', pass: '112233' },
    { name: 'GhostWalker', pass: '112233' },
    { name: 'ArmThanakorn', pass: '112233' },
    { name: 'PlaDookTod', pass: '112233' },
    { name: 'ShadowNova', pass: '112233' },
    { name: 'GolfSuraphol', pass: '112233' },
    { name: 'SunnyToast', pass: '112233' },
    { name: 'NuengNangNoy', pass: '112233' },
    { name: 'CloudyDay', pass: '112233' },
    { name: 'PondSupakit', pass: '112233' },
    { name: 'SabaiSabai', pass: '112233' },
    { name: 'HyperNova', pass: '112233' },
    { name: 'KlaKritin', pass: '112233' },
    { name: 'SweetMango', pass: '112233' },
    { name: 'SomTumbaPoo', pass: '112233' },
    { name: 'BlazeCore', pass: '112233' },
    { name: 'PloySasiwimon', pass: '112233' },
    { name: 'KaiTodHatYai', pass: '112233' },
    { name: 'SleepyCat99', pass: '112233' },
    { name: 'PhuPhaSiam', pass: '112233' },
    { name: 'NonStopPlayer', pass: '112233' },
    { name: 'ChocoCookie', pass: '112233' },
    { name: 'MaeKlongZa', pass: '112233' },
    { name: 'LekKrubPom', pass: '112233' },
    { name: 'MatchaLattez', pass: '112233' },
    { name: 'PixelPippiw', pass: '112233' },
    { name: 'KrapaoMooGrob', pass: '112233' },
    { name: 'ToeyPanuwat', pass: '112233' },
    { name: 'StormBreaker', pass: '112233' },
    { name: 'NongPangHom', pass: '112233' },
    { name: 'YumWoonSen', pass: '112233' },
    { name: 'MekhaSiam', pass: '112233' },
    { name: 'CrispyWaffle', pass: '112233' },
    { name: 'ChaiYoKubPom', pass: '112233' },
    { name: 'AquaSplash9', pass: '112233' },
    { name: 'ManowManaoZa', pass: '112233' },
    { name: 'KhaoNiewMamuang', pass: '112233' },
    { name: 'NongFirstZa', pass: '112233' },
    { name: 'ThunderClap', pass: '112233' },
    { name: 'TomYumGoongZa', pass: '112233' },
    { name: 'NutthaChai', pass: '112233' },
    { name: 'ShadowHunterX', pass: '112233' },
    { name: 'RotiSaiMai', pass: '112233' },
    { name: 'PhuKhaoFai', pass: '112233' },
    { name: 'FrostBite99', pass: '112233' },
    { name: 'NongPreawZa', pass: '112233' },
    { name: 'PadKrapaoPed', pass: '112233' },
    { name: 'ChaiYoSiam', pass: '112233' },
    { name: 'CosmicRider', pass: '112233' },
    { name: 'BuaLoyKaiWan', pass: '112233' },
    { name: 'TeeLekKrub', pass: '112233' },
    { name: 'SolarFlareX', pass: '112233' },
    { name: 'LookChinPing', pass: '112233' },
    { name: 'KornPattara', pass: '112233' },
    { name: 'NeonSpecter', pass: '112233' },
    { name: 'KinKaoReuYang', pass: '112233' }
];

const BOT_NAMES = BOT_CONFIGS.map(b => b.name);
const activeBots = {};

// 01-10: เน็ตตรง | 11-80: กระจายพอร์ตละ 5 ตัว (1080 - 1093)
function getProxyPortForBot(botName) {
    const index = BOT_NAMES.indexOf(botName);
    if (index >= 0 && index < 10) return null;
    const torGroupIndex = Math.floor((index - 10) / 5);
    return 1080 + torGroupIndex;
}

const botStatusMap = {};
BOT_NAMES.forEach(name => {
    botStatusMap[name] = { 
        status: 'Stopped', 
        step: 'รอสั่งเปิดจากหน้าเว็บ...', 
        lastUpdate: new Date().toLocaleTimeString('th-TH', { hour12: false }),
        lastError: '-',
        enabled: false 
    };
});

function updateStatus(name, status, step, errorReason = null) {
    if (!botStatusMap[name]) return;
    botStatusMap[name].status = status;
    if (step) botStatusMap[name].step = step;
    if (errorReason) botStatusMap[name].lastError = errorReason;
    botStatusMap[name].lastUpdate = new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function stopBotInstance(username) {
    if (activeBots[username]) {
        if (activeBots[username].compassTimer) clearTimeout(activeBots[username].compassTimer);
        if (activeBots[username].anvilCheckTimer) clearTimeout(activeBots[username].anvilCheckTimer);
        if (activeBots[username].afkInterval) clearInterval(activeBots[username].afkInterval);
        try { activeBots[username].quit(); } catch (e) {}
        delete activeBots[username];
    }
}

function triggerLobbyCompass(bot, username) {
    if (bot.compassTimer) clearTimeout(bot.compassTimer);
    bot.authStage = 'IN_LOBBY';
    log(`[🏠] [${username}] อยู่ใน Lobby แล้ว -> รอ 13s ให้ฉากโหลดสมบูรณ์ก่อนหาเข็มทิศ...`);
    updateStatus(username, 'In Lobby', 'วาร์ปเข้า Lobby (รอ 13s)');

    bot.compassTimer = setTimeout(() => {
        useCompass(bot, username);
    }, 13000);
}

// สแกนถือเข็มทิศด้วย equip() ตามโครงสร้างเดิม
async function useCompass(bot, username) {
    if (!bot || !bot.inventory) return;
    updateStatus(username, 'In Lobby', 'สแกนถือเข็มทิศ');
    log(`[🧭] [${username}] กำลังค้นหาและเตรียมถือเข็มทิศ...`);
    
    const compass = bot.inventory.items().find(i => i.name.includes('compass'));
    if (compass) {
        try {
            await bot.equip(compass, 'hand');
            log(`[🧭] [${username}] ถือเข็มทิศแล้ว -> รอ 3s ให้เซิร์ฟเวอร์ Sync ก่อนคลิกขวา...`);
            await bot.sleep(3000);
            
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
            log(`[🧭] [${username}] คลิกขวาใช้งานเข็มทิศเรียบร้อย! (รอ GUI เมนูเปิด)`);
        } catch (e) {
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
        }
    } else {
        try {
            await bot.sleep(3000);
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
        } catch (e) {}
    }
}

function createBotInstance(username, delayMs = 0) {
    const currentStatus = botStatusMap[username]?.status || 'Stopped';
    const isAlreadyRunning = activeBots[username] && (currentStatus.includes('Online') || currentStatus === 'Connecting' || currentStatus === 'Logging in' || currentStatus === 'In Lobby');

    if (isAlreadyRunning) {
        log(`[i] [${username}] กำลังทำงานอยู่แล้ว -> ข้ามการรันซ้ำ`);
        return;
    }

    if (!botStatusMap[username]?.enabled) {
        updateStatus(username, 'Stopped', 'ระงับการทำงาน (User Disabled)');
        return;
    }

    setTimeout(() => {
        if (!botStatusMap[username]?.enabled) return;

        stopBotInstance(username);

        const proxyPort = getProxyPortForBot(username);
        const routeMsg = proxyPort ? `(SOCKS5 :${proxyPort})` : `(Direct IP)`;
        log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์... ${routeMsg}`);
        updateStatus(username, 'Connecting', `กำลังเชื่อมต่อ ${routeMsg}...`);

        const botConfig = BOT_CONFIGS.find(b => b.name === username);
        const botPassword = botConfig ? botConfig.pass : DEFAULT_PASSWORD;

        const botOptions = {
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 90000
        };

        if (proxyPort) {
            botOptions.connect = (client) => {
                SocksClient.createConnection({
                    proxy: {
                        host: '127.0.0.1',
                        port: proxyPort,
                        type: 5
                    },
                    command: 'connect',
                    destination: {
                        host: SERVER_HOST,
                        port: SERVER_PORT
                    },
                    timeout: 60000
                }, (err, info) => {
                    if (err) {
                        logError(`[Proxy Error] [${username}] พอร์ต ${proxyPort} ต่อไม่ติด: ${err.message}`);
                        updateStatus(username, 'Error', 'Proxy Error', err.message);
                        return client.emit('error', err);
                    }
                    client.setSocket(info.socket);
                    client.emit('connect');
                });
            };
        }

        const bot = mineflayer.createBot(botOptions);

        activeBots[username] = bot;
        bot.authStage = 'START';

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            logError(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            updateStatus(username, 'Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('windowOpen', async (window) => {
            
            // STAGE 1: เปิดหน้าต่างหลัก -> กด Slot 1 (สมุด)
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'START') {
                bot.authStage = 'OPENING_ANVIL';
                log(`[1/4] [${username}] พบ GUI ล็อกอินหลัก -> รอ 3.5s แล้วกด Slot 1 (สมุด)...`);
                updateStatus(username, 'Logging in', 'รอเปิด Anvil (Slot 1)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);

                        bot.anvilCheckTimer = setTimeout(() => {
                            if (bot.authStage === 'OPENING_ANVIL') {
                                log(`[⚡] [${username}] ข้ามไปเข้า Lobby ทันที`);
                                triggerLobbyCompass(bot, username);
                            }
                        }, 4000);

                    } catch (e) {}
                }, 3500);
            }

            // STAGE 2: Anvil เปิด -> พิมพ์รหัส
            else if (window.type === 'minecraft:anvil' && (bot.authStage === 'OPENING_ANVIL' || bot.authStage === 'START')) {
                if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
                bot.authStage = 'PASS_TYPED';
                log(`[2/4] [${username}] Anvil เปิดสำเร็จ! -> รอพิมพ์รหัสผ่าน...`);
                updateStatus(username, 'Logging in', 'กำลังพิมพ์รหัสผ่าน');

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0);
                        }, 1500);
                    } catch (e) {}
                }, 2500);
            }

            // STAGE 3: ยืนยันรหัสผ่าน (Slot 2)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'PASS_TYPED') {
                log(`[3/4] [${username}] กำลังรอ 2.5s เพื่อกด Slot 2 (เข้าสู่ระบบ)...`);
                updateStatus(username, 'Logging in', 'กด Slot 2 ยืนยัน');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        triggerLobbyCompass(bot, username);
                    } catch (e) {}
                }, 2500);
            }

            // STAGE 4: GUI เข็มทิศเปิด -> เลือก Survival (Slot 10)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'WAIT_COMPASS_MENU') {
                bot.authStage = 'SURVIVAL_DONE';
                log(`[4/4] [${username}] GUI เข็มทิศเปิดเรียบร้อย! -> รอ 3s แล้วเลือก Survival (Slot 10)...`);
                updateStatus(username, 'Selecting Mode', 'เลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        log(`[🚀] [${username}] คลิกเลือก Survival สำเร็จ! (กำลังรอวาร์ปเข้าโลก 14 วินาที...)`);
                        updateStatus(username, 'Entering Survival', 'กำลังวาร์ปเข้า Survival (รอ 14s)');

                        setTimeout(() => {
                            bot.chat('/afk');
                            log(`[✓] [✓] [${username}] พิมพ์คำสั่ง /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                            updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ (/afk)');

                            if (bot.afkInterval) clearInterval(bot.afkInterval);
                            bot.afkInterval = setInterval(() => {
                                try {
                                    bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, true);
                                } catch (e) {}
                            }, 60000);

                        }, 14000);

                    } catch (err) {
                        logError(`[-] [${username}] กดเลือก Survival พลาด: ${err.message}`);
                    }
                }, 3000);
            }
        });

        bot.on('spawn', () => {
            log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('error', (err) => {
            logError(`[❌ Error] [${username}]: ${err.message}`);
            updateStatus(username, 'Error', err.message, err.message);
        });

        bot.on('end', (reason) => {
            if (bot.compassTimer) clearTimeout(bot.compassTimer);
            if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
            if (bot.afkInterval) clearInterval(bot.afkInterval);
            delete activeBots[username];
            log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason})`);
            
            if (botStatusMap[username]?.enabled) {
                updateStatus(username, 'Offline', `หลุด (${reason})`, botStatusMap[username]?.lastError || reason);
                log(`[i] [${username}] จะต่อใหม่ใน 35 วินาที...`);
                createBotInstance(username, 35000);
            } else {
                updateStatus(username, 'Stopped', 'ระงับการทำงาน');
            }
        });

    }, delayMs);
}

// Web Server + REST API
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const path = parsedUrl.pathname;

    if (path === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(botStatusMap));
        return;
    }

    if (path === '/api/control') {
        const action = parsedUrl.searchParams.get('action');
        const name = parsedUrl.searchParams.get('name');

        if (action === 'start-range') {
            const startVal = parseInt(parsedUrl.searchParams.get('start'));
            const endVal = parseInt(parsedUrl.searchParams.get('end'));
            
            const start = isNaN(startVal) ? 0 : startVal;
            const end = isNaN(endVal) ? BOT_NAMES.length : endVal;

            log(`[Batch Command] สั่งรันช่วง ${start + 1} ถึง ${end}`);

            const targetBots = BOT_NAMES.slice(start, end);
            let launchIndex = 0;

            targetBots.forEach((bName) => {
                const currStatus = botStatusMap[bName]?.status || 'Stopped';
                const isRunning = activeBots[bName] && (currStatus.includes('Online') || currStatus === 'Connecting' || currStatus === 'Logging in' || currStatus === 'In Lobby');

                if (!isRunning) {
                    botStatusMap[bName].enabled = true;
                    // ปล่อยบอทห่างกันตัวละ 15 วินาทีเพื่อไม่ให้ชนเพดาน Tor Handshake
                    createBotInstance(bName, launchIndex * 15000);
                    launchIndex++;
                } else {
                    log(`[i] [${bName}] ทำงานอยู่แล้วในกลุ่ม (${currStatus}) -> ไม่รันซ้ำ`);
                }
            });
        } 
        else if (action === 'start-all') {
            let launchIndex = 0;
            BOT_NAMES.forEach((bName) => {
                const currStatus = botStatusMap[bName]?.status || 'Stopped';
                const isRunning = activeBots[bName] && (currStatus.includes('Online') || currStatus === 'Connecting' || currStatus === 'Logging in' || currStatus === 'In Lobby');

                if (!isRunning) {
                    botStatusMap[bName].enabled = true;
                    createBotInstance(bName, launchIndex * 15000);
                    launchIndex++;
                }
            });
        } 
        else if (action === 'stop-all') {
            BOT_NAMES.forEach(bName => {
                botStatusMap[bName].enabled = false;
                stopBotInstance(bName);
                updateStatus(bName, 'Stopped', 'ระงับการทำงาน');
            });
        } 
        else if (name && botStatusMap[name]) {
            if (action === 'start') {
                botStatusMap[name].enabled = true;
                botStatusMap[name].lastError = '-';
                createBotInstance(name, 0);
            } else if (action === 'stop') {
                botStatusMap[name].enabled = false;
                stopBotInstance(name);
                updateStatus(name, 'Stopped', 'ระงับการทำงาน (User Disabled)');
            }
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
    <title>Minecraft Multi-Bot Dashboard (80 Bots)</title>
    <style>
        body { font-family: monospace, sans-serif; background: #121212; color: #e0e0e0; margin: 15px; }
        h2 { color: #4caf50; margin-bottom: 10px; display: inline-block; }
        .btn-group { margin-bottom: 15px; float: right; display: flex; gap: 5px; flex-wrap: wrap; }
        button { background: #333; color: #fff; border: 1px solid #555; padding: 6px 10px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 12px; }
        button:hover { background: #444; }
        .btn-start { background: #2e7d32; border-color: #4caf50; }
        .btn-batch { background: #1565c0; border-color: #42a5f5; }
        .btn-stop { background: #c62828; border-color: #ef5350; }
        .stats { margin-bottom: 15px; font-size: 14px; clear: both; }
        table { width: 100%; border-collapse: collapse; background: #1e1e1e; font-size: 13px; }
        th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
        th { background: #2a2a2a; color: #aaa; }
        .Online { color: #4caf50; font-weight: bold; }
        .Connecting, .Logging, .Selecting, .In { color: #ffeb3b; }
        .Offline, .Kicked, .Error { color: #f44336; }
        .Stopped { color: #757575; }
        .badge-proxy { font-size: 10px; padding: 2px 5px; border-radius: 3px; background: #004d40; color: #80cbc4; margin-left: 5px; border: 1px solid #00796b; }
        .badge-direct { font-size: 10px; padding: 2px 5px; border-radius: 3px; background: #263238; color: #b0bec5; margin-left: 5px; }
        .err-log { color: #ff9800; font-size: 11px; max-width: 250px; word-break: break-all; }
    </style>
</head>
<body>
    <div>
        <h2>🤖 Minecraft Multi-Bot Dashboard (80 Bots - 14 Proxies)</h2>
        <div class="btn-group">
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=0&end=10')">▶ 01-10 (Direct)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=10&end=20')">▶ 11-20 (:1080-:1081)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=20&end=40')">▶ 21-40 (:1082-:1085)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=40&end=60')">▶ 41-60 (:1086-:1089)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=60&end=80')">▶ 61-80 (:1090-:1093)</button>
            <button class="btn-start" onclick="controlBot('', 'start-all')">▶ Start All</button>
            <button class="btn-stop" onclick="controlBot('', 'stop-all')">⏹ Stop All</button>
        </div>
    </div>
    <div class="stats" id="summary">กำลังโหลดข้อมูล...</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>ชื่อบอท</th>
                <th>เน็ตเวิร์ก</th>
                <th>สถานะ</th>
                <th>ขั้นตอนล่าสุด</th>
                <th>ข้อผิดพลาดจากเซิร์ฟ (Error Log)</th>
                <th>อัปเดตเมื่อ</th>
                <th>จัดการ</th>
            </tr>
        </thead>
        <tbody id="bot-table"></tbody>
    </table>

    <script>
        async function controlBot(name, action) {
            await fetch(\`/api/control?name=\${name}&action=\${action}\`);
            fetchStatus();
        }

        function getPortByIndex(index) {
            if (index >= 0 && index < 10) return null;
            return 1080 + Math.floor((index - 10) / 5);
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const tbody = document.getElementById('bot-table');
                
                let onlineCount = 0;
                let total = 0;
                let html = '';

                Object.keys(data).forEach((name, index) => {
                    total++;
                    const bot = data[name];
                    const isOnline = bot.status.includes('Online');
                    if (isOnline) onlineCount++;

                    let statusClass = 'Offline';
                    if (isOnline) statusClass = 'Online';
                    else if (bot.status === 'Stopped') statusClass = 'Stopped';
                    else if (bot.status !== 'Offline') statusClass = 'Connecting';

                    const toggleBtn = bot.enabled ? 
                        \`<button class="btn-stop" onclick="controlBot('\${name}', 'stop')">Stop</button>\` : 
                        \`<button class="btn-start" onclick="controlBot('\${name}', 'start')">Start</button>\`;

                    const pPort = getPortByIndex(index);
                    const routeTag = pPort ? 
                        \`<span class="badge-proxy">SOCKS:\${pPort}</span>\` : 
                        \`<span class="badge-direct">Direct</span>\`;

                    html += \`<tr>
                        <td>\${index + 1}</td>
                        <td><b>\${name}</b></td>
                        <td>\${routeTag}</td>
                        <td class="\${statusClass}">\${bot.status}</td>
                        <td>\${bot.step}</td>
                        <td class="err-log">\${bot.lastError}</td>
                        <td>\${bot.lastUpdate}</td>
                        <td>\${toggleBtn}</td>
                    </tr>\`;
                });

                tbody.innerHTML = html;
                document.getElementById('summary').innerHTML = 
                    \`ออนไลน์ทั้งหมด: <b>\${onlineCount}/\${total}</b> ตัว | อัปเดตอัตโนมัติทุก 3 วินาที\`;
            } catch (e) {}
        }

        fetchStatus();
        setInterval(fetchStatus, 3000);
    </script>
</body>
</html>
    `);
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function printStartupLogs(ipAddress) {
    log('==================================================');
    log(`🚀 STARTING MINEFLAYER MULTI-BOT SERVER (80 BOTS)`);
    log('==================================================');
    log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว (14 Tor Circuits)`);
    log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    log('==================================================');
}

server.listen(WEB_PORT, () => {
    http.get('http://api.ipify.org', (res) => {
        let publicIp = '';
        res.on('data', chunk => publicIp += chunk);
        res.on('end', () => printStartupLogs(publicIp.trim()));
    }).on('error', () => {
        printStartupLogs(getLocalIP());
    });
});