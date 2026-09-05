const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = 3005;

const PIPE = '/tmp/mcc_pipe_satang_cmd';
const CONSOLE_LOG = path.join(__dirname, 'satang_console.log');
const HISTORY_FILE = path.join(__dirname, 'satang_pay_history.json');

app.use(express.json());

// 🛡️ ป้องกันแชทรั่วไหล: ส่งได้เฉพาะคำสั่งที่มี / เท่านั้น
function sendCommand(cmd) {
  if (!fs.existsSync(PIPE)) return false;
  if (!cmd.startsWith('/')) {
    console.error(`[SECURITY BLOCKED]: '${cmd}' ถูกระงับเนื่องจากไม่มี / นำหน้า`);
    return false;
  }
  try {
    exec(`echo "${cmd}" > ${PIPE}`);
    return true;
  } catch (e) {
    return false;
  }
}

// โหลดประวัติ Log จากไฟล์ JSON
function getHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

// เซฟประวัติ Log เพิ่มลงไฟล์ JSON
function saveHistory(entry) {
  try {
    const list = getHistory();
    list.unshift(entry); // เอาอันล่าสุดขึ้นก่อน
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Save history error:', e);
  }
}

// 📌 API เช็คยอดเงิน (/money)
app.get('/api/check-balance', async (req, res) => {
  if (!fs.existsSync(PIPE)) {
    return res.status(500).json({ success: false, message: 'บอท Satang13 ไม่ออนไลน์' });
  }

  const startSize = fs.existsSync(CONSOLE_LOG) ? fs.statSync(CONSOLE_LOG).size : 0;
  sendCommand('/money');

  let foundBalance = null;
  let rawText = '';

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 200));

    if (fs.existsSync(CONSOLE_LOG)) {
      const currentSize = fs.statSync(CONSOLE_LOG).size;
      if (currentSize > startSize) {
        const stream = fs.readFileSync(CONSOLE_LOG, 'utf-8');
        const newLines = stream.slice(startSize).split('\n');

        for (const line of newLines) {
          const cleanLine = line.replace(/§[0-9a-fk-or]/gi, '').trim();
          if (/economy|เงิน|balance|คงเหลือ|คอยน์|\$/i.test(cleanLine)) {
            const match = cleanLine.match(/[\d,]+(?:\.\d+)?/);
            if (match) {
              foundBalance = match[0];
              rawText = cleanLine;
              break;
            }
          }
        }
      }
    }
    if (foundBalance) break;
  }

  if (foundBalance) {
    return res.json({ success: true, balance: foundBalance, raw: rawText });
  }

  res.json({ success: false, message: 'ไม่พบข้อความตอบกลับ (ลองใหม่อีกครั้ง)' });
});

// 📌 API สั่งโอนเงิน
app.post('/api/pay', (req, res) => {
  let { player, amount } = req.body;

  player = String(player || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  amount = parseInt(amount, 10);

  if (!player || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
  }

  if (!fs.existsSync(PIPE)) {
    return res.status(500).json({ success: false, message: 'บอท Satang13 ไม่ออนไลน์' });
  }

  sendCommand(`/pay ${player} ${amount}`);

  setTimeout(() => {
    sendCommand('/inventory container click 11 Left');
    sendCommand('/dialog click 1');
  }, 1200);

  // บันทึก Log ประวัติ
  const timeNow = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
  const dateNow = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  saveHistory({
    player: player,
    amount: amount,
    time: timeNow,
    date: dateNow,
    timestamp: Date.now()
  });

  res.json({ success: true, message: `ส่งคำสั่ง /pay ${player} ${amount} เรียบร้อยแล้ว` });
});

// 📌 API ดึงประวัติ Log ทั้งหมด
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
    <link href="https://fonts.googleapis.com/css2?family=VT323&family=Bai+Jamjuree:wght@600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        /* พื้นหลัง Texture Stone Bricks จาก Minecraft */
        background-color: #1a1a1a;
        background-image: 
          radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%),
          url('https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/block/stone_bricks.png');
        background-repeat: repeat;
        background-size: auto, 64px 64px;
        image-rendering: pixelated;
        color: #f0f6fc;
        font-family: 'Bai Jamjuree', sans-serif;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 30px 16px;
      }

      .container { width: 100%; max-width: 580px; }

      /* กรอบสไตล์ GUI Minecraft */
      .card {
        background: rgba(24, 26, 32, 0.92);
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

      /* ส่วนยอดเงิน */
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
      .btn-balance {
        background: #2b3544;
        color: #38bdf8;
        border: 2px solid #38bdf8;
        padding: 8px 14px;
        font-weight: 700;
        font-size: 0.85rem;
        border-radius: 6px;
        cursor: pointer;
        transition: 0.15s;
        font-family: 'Bai Jamjuree', sans-serif;
      }
      .btn-balance:hover { background: #38bdf8; color: #000; }

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
        font-family: 'Bai Jamjuree', sans-serif;
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
        font-family: 'Bai Jamjuree', sans-serif;
        text-shadow: 2px 2px #000;
        box-shadow: 0 4px 0 #78350f;
      }
      .btn-pay:hover { filter: brightness(1.15); }
      .btn-pay:active { transform: translateY(2px); box-shadow: 0 2px 0 #78350f; }

      /* 🎮 กล่องแชท MINECRAFT ตามภาพต้นฉบับ */
      .chat-screen-container {
        background: rgba(0, 0, 0, 0.75);
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
        max-height: 380px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .mc-chat-line {
        background: rgba(0, 0, 0, 0.55);
        padding: 8px 12px;
        border-radius: 4px;
        line-height: 1.45;
        font-family: 'VT323', 'Bai Jamjuree', monospace;
        font-size: 1.35rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        /* เงาข้อความแบบคมกริบสไตล์ Minecraft */
        text-shadow: 2px 2px 0px #000000;
        display: block;
        border-left: 3px solid #e67e22;
      }

      /* ถอดแบบสีตามรูปต้นฉบับเป๊ะๆ */
      .mc-tag { color: #e67e22; font-weight: 900; }     /* [ECONOMY] สีส้มเข้ม */
      .mc-white { color: #ffffff; }                     /* คุณโอนเงินจำนวน */
      .mc-amount { color: #ffff55; }                    /* ตัวเลข สีเหลือง */
      .mc-player { color: #e67e22; }                    /* ชื่อผู้เล่น สีส้ม */
      .mc-time { font-size: 0.85rem; color: #64748b; margin-left: 8px; font-family: 'JetBrains Mono', monospace; }

      /* เหรียญทอง Coin icon ในเกม */
      .mc-coin-icon {
        display: inline-block;
        width: 16px;
        height: 16px;
        background: #ffff55;
        border-radius: 50%;
        border: 2px solid #000;
        vertical-align: -2px;
        margin-left: 3px;
        position: relative;
        box-shadow: 1px 1px 0px #000;
      }
      .mc-coin-icon::after {
        content: '';
        position: absolute;
        width: 4px;
        height: 4px;
        background: #000;
        top: 4px;
        left: 4px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>💸 SATANG13 PAY CONTROLLER</h1>
        <div class="sub">ระบบโอนเงินสั่งการตรงผ่าน Named Pipe</div>

        <!-- ยอดเงิน -->
        <div class="balance-box">
          <div>
            <div class="balance-label">ยอดเงินคงเหลือในกระเป๋า</div>
            <div class="balance-val" id="displayBalance">---</div>
          </div>
          <button class="btn-balance" onclick="checkBalance()">🔄 เช็คยอดเงิน</button>
        </div>

        <div class="form-group">
          <label>ชื่อผู้เล่นปลายทาง</label>
          <input type="text" id="targetPlayer" placeholder="เช่น Satang13" autocomplete="off" />
        </div>

        <div class="form-group">
          <label>จำนวนเงิน</label>
          <input type="number" id="payAmount" placeholder="เช่น 1 หรือ 100" min="1" />
        </div>

        <button class="btn-pay" onclick="sendPay()">โอนเงินทันที</button>
      </div>

      <!-- กล่องแชท Minecraft -->
      <div class="chat-screen-container">
        <div class="chat-header">
          <span>📜 ประวัติการโอนเงิน (บันทึกถาวร)</span>
          <span id="logCount" style="color: #ffff55;">0 รายการ</span>
        </div>
        <div class="chat-scroll" id="chatBox">
          <div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">กำลังโหลดประวัติ...</div>
        </div>
      </div>
    </div>

    <script>
      async function checkBalance() {
        const btn = document.querySelector('.btn-balance');
        const display = document.getElementById('displayBalance');
        btn.innerText = 'กำลังเช็ค...';
        btn.disabled = true;

        try {
          const res = await fetch('/api/check-balance');
          const data = await res.json();
          if (data.success) {
            display.innerText = data.balance;
          } else {
            alert(data.message || 'ไม่สามารถดึงยอดเงินได้');
          }
        } catch (e) {
          alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally {
          btn.innerText = '🔄 เช็คยอดเงิน';
          btn.disabled = false;
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
            amountInput.value = '';
            fetchLogs();
            setTimeout(checkBalance, 2000);
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

        if (logs.length === 0) {
          box.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">ยังไม่มีประวัติการโอนเงิน</div>';
          return;
        }

        box.innerHTML = logs.map(item => \`
          <div class="mc-chat-line">
            <span class="mc-tag">[ECONOMY]</span> <span class="mc-white">คุณโอนเงินจำนวน</span> <span class="mc-amount">\${item.amount}</span> <span class="mc-coin-icon"></span><br>
            <span class="mc-white">ให้กับผู้เล่น</span> <span class="mc-player">\${item.player}</span>
            <span class="mc-time">(\${item.time})</span>
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

      checkBalance();
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