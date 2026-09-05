const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = 3005;

const PIPE = '/tmp/mcc_pipe_satang_cmd';
const HISTORY_FILE = path.join(__dirname, 'satang_pay_history.json');
const BALANCE_FILE = path.join(__dirname, 'satang_balance.json');

app.use(express.json());

// 🛡️ ส่งได้เฉพาะคำสั่งที่มี / นำหน้าเท่านั้น (ป้องกันแชทรั่วไหล 100%)
function sendCommand(cmd) {
  if (!fs.existsSync(PIPE)) return false;
  if (!cmd.startsWith('/')) {
    console.error(`[SECURITY BLOCKED]: '${cmd}' ไม่มี / นำหน้า ถูกระงับ`);
    return false;
  }
  try {
    exec(`echo "${cmd}" > ${PIPE}`);
    return true;
  } catch (e) {
    return false;
  }
}

// โหลด/บันทึกยอดเงินคงเหลือ
function getBalance() {
  try {
    if (fs.existsSync(BALANCE_FILE)) {
      const data = JSON.parse(fs.readFileSync(BALANCE_FILE, 'utf-8'));
      return data.balance !== undefined ? data.balance : 0;
    }
  } catch (e) {}
  return 0;
}

function saveBalance(amount) {
  try {
    fs.writeFileSync(BALANCE_FILE, JSON.stringify({ balance: amount }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Save balance error:', e);
  }
}

// โหลด/บันทึกประวัติการโอน
function getHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

function saveHistory(entry) {
  try {
    const list = getHistory();
    list.unshift(entry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Save history error:', e);
  }
}

// 📌 API ดึงยอดเงินปัจจุบัน
app.get('/api/balance', (req, res) => {
  res.json({ success: true, balance: getBalance() });
});

// 📌 API ตั้งค่ายอดเงินเริ่มต้นใหม่
app.post('/api/set-balance', (req, res) => {
  const { balance } = req.body;
  const num = parseFloat(balance);
  if (isNaN(num) || num < 0) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกตัวเลขยอดเงินที่ถูกต้อง' });
  }
  saveBalance(num);
  res.json({ success: true, balance: num, message: 'อัปเดตยอดเงินคงเหลือเรียบร้อย' });
});

// 📌 API สั่งโอนเงิน และหักยอดเงินอัตโนมัติ
app.post('/api/pay', (req, res) => {
  let { player, amount } = req.body;

  player = String(player || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  amount = parseInt(amount, 10);

  if (!player || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'ชื่อผู้เล่นหรือจำนวนเงินไม่ถูกต้อง' });
  }

  if (!fs.existsSync(PIPE)) {
    return res.status(500).json({ success: false, message: 'บอท Satang13 ไม่ออนไลน์' });
  }

  const currentBal = getBalance();
  if (currentBal < amount) {
    return res.status(400).json({ 
      success: false, 
      message: `ยอดเงินคงเหลือไม่พอ (มีอยู่ ${currentBal.toLocaleString()} แต่ต้องการโอน ${amount.toLocaleString()})` 
    });
  }

  // 1. ส่งคำสั่ง /pay
  sendCommand(`/pay ${player} ${amount}`);

  // 2. ส่งคำสั่งกดยืนยัน GUI
  setTimeout(() => {
    sendCommand('/inventory container click 11 Left');
    sendCommand('/dialog click 1');
  }, 1200);

  // 3. หักลบยอดเงินคงเหลือ
  const newBal = currentBal - amount;
  saveBalance(newBal);

  // 4. บันทึกประวัติ Log
  const timeNow = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
  const dateNow = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  saveHistory({
    player: player,
    amount: amount,
    time: timeNow,
    date: dateNow,
    timestamp: Date.now()
  });

  res.json({ 
    success: true, 
    balance: newBal,
    message: `ส่งคำสั่ง /pay ${player} ${amount} เรียบร้อยแล้ว (ยอดคงเหลือ: ${newBal.toLocaleString()})` 
  });
});

// 📌 API ดึงประวัติทั้งหมด
app.get('/api/logs', (req, res) => {
  res.json({ logs: getHistory() });
});

// 🌐 หน้า Web Dashboard
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="th">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minecraft Pay Controller</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@600;700&family=Silkscreen&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background-color: #1a1a1a;
        background-image: 
          radial-gradient(circle, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.9) 100%),
          url('https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/block/stone_bricks.png');
        background-repeat: repeat;
        background-size: auto, 64px 64px;
        image-rendering: pixelated;
        color: #f0f6fc;
        font-family: 'Kanit', sans-serif;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 30px 16px;
      }

      .container { width: 100%; max-width: 580px; }

      .card {
        background: rgba(24, 26, 32, 0.94);
        backdrop-filter: blur(8px);
        border: 2px solid #4a5568;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8), inset 0 0 2px rgba(255,255,255,0.2);
        margin-bottom: 20px;
      }

      h1 { 
        font-size: 1.4rem; 
        color: #f59e0b; 
        margin-bottom: 4px; 
        font-weight: 800; 
        text-align: center;
        text-shadow: 2px 2px #000;
      }
      .sub { color: #94a3b8; font-size: 0.85rem; text-align: center; margin-bottom: 16px; }

      /* การ์ดยอดเงินคงเหลือ */
      .balance-box {
        background: rgba(10, 12, 16, 0.85);
        border: 2px solid #2d3748;
        border-radius: 8px;
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 18px;
      }
      .balance-label { font-size: 0.8rem; color: #94a3b8; font-weight: 700; }
      .balance-val { 
        font-family: 'JetBrains Mono', monospace; 
        font-size: 1.6rem; 
        color: #ffff55; 
        font-weight: 800;
        text-shadow: 2px 2px #000;
      }
      .btn-setbal {
        background: #2b3544;
        color: #38bdf8;
        border: 2px solid #38bdf8;
        padding: 8px 14px;
        font-weight: 700;
        font-size: 0.85rem;
        border-radius: 6px;
        cursor: pointer;
        transition: 0.15s;
        font-family: 'Kanit', sans-serif;
      }
      .btn-setbal:hover { background: #38bdf8; color: #000; }

      .form-group { margin-bottom: 14px; text-align: left; }
      label { display: block; font-size: 0.85rem; font-weight: 700; color: #e2e8f0; margin-bottom: 6px; text-shadow: 1px 1px #000; }
      input {
        width: 100%;
        padding: 12px 14px;
        background: rgba(0, 0, 0, 0.7);
        border: 2px solid #4b5563;
        border-radius: 6px;
        color: #fff;
        font-size: 1rem;
        outline: none;
        font-family: 'Kanit', sans-serif;
        font-weight: 600;
      }
      input:focus { border-color: #f59e0b; }

      .btn-pay {
        width: 100%;
        padding: 14px;
        background: linear-gradient(180deg, #d97706 0%, #b45309 100%);
        border: 2px solid #f59e0b;
        border-radius: 6px;
        color: #fff;
        font-size: 1.1rem;
        font-weight: 800;
        cursor: pointer;
        margin-top: 6px;
        font-family: 'Kanit', sans-serif;
        text-shadow: 2px 2px #000;
        box-shadow: 0 4px 0 #78350f;
      }
      .btn-pay:hover { filter: brightness(1.15); }
      .btn-pay:active { transform: translateY(2px); box-shadow: 0 2px 0 #78350f; }

      /* 🎮 กล่องแสดงผลแชทจำลองหน้าต่าง Minecraft */
      .chat-screen-container {
        background: rgba(0, 0, 0, 0.85);
        border: 2px solid #374151;
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      }
      .chat-header {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-bottom: 12px;
        font-weight: 700;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        padding-bottom: 8px;
      }

      .chat-scroll {
        max-height: 400px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* 🎨 แถบข้อความถอดแบบจาก Minecraft 100% */
      .mc-chat-screen {
        background: rgba(0, 0, 0, 0.72);
        border-radius: 4px;
        padding: 10px 14px;
        font-family: 'Kanit', 'Silkscreen', sans-serif;
        font-size: 19px;
        font-weight: 700;
        line-height: 1.35;
        letter-spacing: 0.5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      }

      .mc-row {
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
      }

      /* เงาคมกริบ 1-bit Pixel Offset สไตล์ Minecraft */
      .mc-text {
        text-shadow: 2px 2px 0px #000000, 
                     2px 0px 0px #000000, 
                     0px 2px 0px #000000;
        display: inline-block;
      }

      /* สีถอดแบบตามรูปต้นฉบับเป๊ะๆ */
      .mc-tag     { color: #F7941D; font-family: 'Silkscreen', 'Kanit', sans-serif; margin-right: 6px; } /* [ECONOMY] */
      .mc-white   { color: #FFFFFF; } 
      .mc-yellow  { color: #FFFF55; font-family: 'Silkscreen', 'Kanit', sans-serif; margin: 0 4px; } 
      .mc-target  { color: #F7941D; font-family: 'Silkscreen', 'Kanit', sans-serif; margin-left: 6px; } 

      /* 🪙 Custom Coin Icon พิกเซลแท้จากในรูป */
      .mc-pixel-coin {
        display: inline-block;
        width: 18px;
        height: 18px;
        vertical-align: -2px;
        margin-left: 4px;
        image-rendering: pixelated;
        background-size: contain;
        background-repeat: no-repeat;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'><rect x='2' y='1' width='12' height='14' fill='%23000'/><rect x='1' y='2' width='14' height='12' fill='%23000'/><rect x='3' y='2' width='10' height='12' fill='%23ffff55'/><rect x='2' y='3' width='12' height='10' fill='%23ffff55'/><rect x='4' y='3' width='8' height='10' fill='%23facc15'/><rect x='5' y='5' width='6' height='2' fill='%23000'/><rect x='4' y='7' width='8' height='1' fill='%23000'/><rect x='5' y='8' width='1' height='3' fill='%23000'/><rect x='7' y='8' width='2' height='3' fill='%23000'/><rect x='10' y='8' width='1' height='3' fill='%23000'/><rect x='5' y='11' width='6' height='1' fill='%23000'/><rect x='7' y='6' width='2' height='1' fill='%23facc15'/></svg>");
        filter: drop-shadow(2px 2px 0px #000);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>💸 SATANG13 PAY CONTROLLER</h1>
        <div class="sub">ระบบโอนเงินสั่งการตรงผ่าน Named Pipe</div>

        <!-- กล่องยอดเงิน -->
        <div class="balance-box">
          <div>
            <div class="balance-label">ยอดเงินคงเหลือในกระเป๋า</div>
            <div class="balance-val" id="displayBalance">0</div>
          </div>
          <button class="btn-setbal" onclick="setManualBalance()">✏️ กำหนดยอดเงิน</button>
        </div>

        <div class="form-group">
          <label>ชื่อผู้เล่นปลายทาง</label>
          <input type="text" id="targetPlayer" placeholder="เช่น Kaitom_4" autocomplete="off" />
        </div>

        <div class="form-group">
          <label>จำนวนเงินที่ต้องการโอน</label>
          <input type="number" id="payAmount" placeholder="เช่น 1 หรือ 100" min="1" />
        </div>

        <button class="btn-pay" onclick="sendPay()">โอนเงินทันที</button>
      </div>

      <!-- กล่องแชท Minecraft -->
      <div class="chat-screen-container">
        <div class="chat-header">
          <span>📜 ประวัติการโอนเงิน (Live Log)</span>
          <span id="logCount" style="color: #ffff55;">0 รายการ</span>
        </div>
        <div class="chat-scroll" id="chatBox">
          <div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">ยังไม่มีประวัติการโอนเงิน</div>
        </div>
      </div>
    </div>

    <script>
      async function fetchBalance() {
        try {
          const res = await fetch('/api/balance');
          const data = await res.json();
          if (data.success) {
            document.getElementById('displayBalance').innerText = Number(data.balance).toLocaleString();
          }
        } catch (e) {}
      }

      async function setManualBalance() {
        const input = prompt('ใส่จำนวนเงินเริ่มต้นที่มีอยู่ในตัวละคร:');
        if (input === null) return;
        const bal = parseFloat(input);
        if (isNaN(bal) || bal < 0) {
          alert('กรุณากรอกตัวเลขจำนวนเต็มบวก');
          return;
        }

        try {
          const res = await fetch('/api/set-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: bal })
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('displayBalance').innerText = Number(data.balance).toLocaleString();
          } else {
            alert(data.message);
          }
        } catch (e) {
          alert('ไม่สามารถอัปเดตยอดเงินได้');
        }
      }

      async function sendPay() {
        const playerInput = document.getElementById('targetPlayer');
        const amountInput = document.getElementById('payAmount');
        const player = playerInput.value.trim();
        const amount = amountInput.value.trim();

        if (!player || !amount) {
          alert('กรุณากรอกชื่อผู้เล่นและจำนวนเงิน');
          return;
        }

        try {
          const res = await fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player, amount })
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('displayBalance').innerText = Number(data.balance).toLocaleString();
            amountInput.value = '';
            fetchLogs();
          } else {
            alert(data.message);
          }
        } catch (e) {
          alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        }
      }

      function renderLogs(logs) {
        const box = document.getElementById('chatBox');
        const countSpan = document.getElementById('logCount');
        countSpan.innerText = logs.length + ' รายการ';

        if (!logs || logs.length === 0) {
          box.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">ยังไม่มีประวัติการโอนเงิน</div>';
          return;
        }

        box.innerHTML = logs.map(item => \`
          <div class="mc-chat-screen">
            <!-- บรรทัดที่ 1: [ECONOMY] คุณโอนเงินจำนวน 1 [เหรียญ] -->
            <div class="mc-row">
              <span class="mc-text mc-tag">[ECONOMY]</span> 
              <span class="mc-text mc-white">คุณโอนเงินจำนวน</span> 
              <span class="mc-text mc-yellow">\${Number(item.amount).toLocaleString()}</span>
              <span class="mc-pixel-coin"></span>
            </div>
            <!-- บรรทัดที่ 2: ให้กับผู้เล่น <ชื่อ> -->
            <div class="mc-row">
              <span class="mc-text mc-white">ให้กับผู้เล่น</span> 
              <span class="mc-text mc-target">\${item.player}</span>
            </div>
          </div>
        \`).join('');
      }

      async function fetchLogs() {
        try {
          const res = await fetch('/api/logs');
          const data = await res.json();
          if (data.logs) {
            renderLogs(data.logs);
          }
        } catch (e) {}
      }

      fetchBalance();
      fetchLogs();
      setInterval(fetchLogs, 4000);
    </script>
  </body>
  </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Satang Pay Controller รันบน http://localhost:${PORT}`);
});