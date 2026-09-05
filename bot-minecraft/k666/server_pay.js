const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = 3005;

const PIPE = '/tmp/mcc_pipe_satang_cmd';
const LOG_FILE = path.join(__dirname, 'satang_logs.txt');
const BAL_FILE = path.join(__dirname, 'balance.txt');

app.use(express.json());

function sendCommand(cmd) {
  if (!fs.existsSync(PIPE)) return false;
  if (!cmd.startsWith('/')) return false; // ป้องกันแชทรั่วไหล
  try {
    exec(`echo "${cmd}" > ${PIPE}`);
    return true;
  } catch (e) {
    return false;
  }
}

// 📌 API สั่งเช็คยอดเงิน /money
app.get('/api/check-balance', (req, res) => {
  if (!fs.existsSync(PIPE)) {
    return res.status(500).json({ success: false, message: 'บอท Satang13 ไม่ออนไลน์' });
  }

  // 1. เคลียร์ค่าเดิมก่อนส่งคำสั่ง
  if (fs.existsSync(BAL_FILE)) {
    fs.writeFileSync(BAL_FILE, '', 'utf-8');
  }

  // 2. สั่งคำสั่ง /money ตรงไปยังบอท
  sendCommand('/money');

  // 3. รอให้เซิร์ฟเวอร์ตอบกลับประมาณ 1 วินาที แล้วอ่านไฟล์แกะตัวเลข
  setTimeout(() => {
    try {
      if (fs.existsSync(BAL_FILE)) {
        const rawLine = fs.readFileSync(BAL_FILE, 'utf-8').trim();
        if (rawLine) {
          // แกะตัวเลขยอดเงิน เช่น 1,500,000 หรือ 250.50
          const match = rawLine.match(/[\d,]+(\.\d+)?/);
          const balance = match ? match[0] : '0';
          return res.json({ success: true, balance: balance, raw: rawLine });
        }
      }
      res.json({ success: false, message: 'ไม่พบข้อความตอบกลับจากเซิร์ฟเวอร์' });
    } catch (e) {
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอ่านไฟล์ยอดเงิน' });
    }
  }, 1200);
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

  res.json({ success: true, message: `ส่งคำสั่ง /pay ${player} ${amount} เรียบร้อยแล้ว` });
});

// 📌 API ดึง Log
app.get('/api/logs', (req, res) => {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const raw = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean).slice(-15);
      return res.json({ logs: lines });
    } catch (e) {}
  }
  res.json({ logs: [] });
});

// 🌐 หน้า Web Dashboard
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="th">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satang13 Pay System</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Noto+Sans+Thai:wght@500;700;900&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg: #0d1117;
        --card: #161b22;
        --border: rgba(255, 255, 255, 0.1);
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: var(--bg);
        color: #f0f6fc;
        font-family: 'Plus Jakarta Sans', 'Noto Sans Thai', sans-serif;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 30px 16px;
      }

      .container { width: 100%; max-width: 540px; }

      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        margin-bottom: 20px;
      }

      h1 { font-size: 1.4rem; color: #38bdf8; margin-bottom: 4px; font-weight: 800; text-align: center; }
      .sub { color: #8b949e; font-size: 0.85rem; text-align: center; margin-bottom: 16px; }

      /* การ์ดยอดเงิน */
      .balance-box {
        background: #090d13;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 18px;
      }
      .balance-info { text-align: left; }
      .balance-label { font-size: 0.8rem; color: #94a3b8; font-weight: 700; }
      .balance-val { font-family: 'JetBrains Mono', monospace; font-size: 1.6rem; color: #facc15; font-weight: 800; }
      .btn-balance {
        background: #1e293b;
        color: #38bdf8;
        border: 1px solid #38bdf8;
        padding: 10px 16px;
        font-weight: 800;
        font-size: 0.85rem;
        border-radius: 8px;
        cursor: pointer;
        transition: 0.15s;
      }
      .btn-balance:hover { background: #38bdf8; color: #000; }

      .form-group { margin-bottom: 14px; text-align: left; }
      label { display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
      input {
        width: 100%;
        padding: 12px 14px;
        background: #090d13;
        border: 1px solid #30363d;
        border-radius: 8px;
        color: #fff;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
      }
      input:focus { border-color: #38bdf8; }

      .btn-pay {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        border: none;
        border-radius: 8px;
        color: #000;
        font-size: 1.05rem;
        font-weight: 800;
        cursor: pointer;
        margin-top: 6px;
        transition: transform 0.1s, filter 0.2s;
      }
      .btn-pay:hover { filter: brightness(1.1); }
      .btn-pay:active { transform: scale(0.98); }

      /* 🎮 กล่องแชทเลียนแบบเกม */
      .chat-screen-container {
        background: rgba(10, 10, 10, 0.85);
        border: 1px solid #30363d;
        border-radius: 14px;
        padding: 18px;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.8);
      }
      .chat-header {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-bottom: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .mc-chat-line {
        background: rgba(0, 0, 0, 0.5);
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 8px;
        line-height: 1.5;
        font-family: 'Noto Sans Thai', sans-serif;
        font-size: 1.02rem;
        font-weight: 700;
        text-shadow: 2px 2px 0px #000000;
        display: block;
      }

      .mc-tag { color: #e67e22; font-weight: 900; }
      .mc-white { color: #ffffff; }
      .mc-amount { color: #ffff55; }
      .mc-player { color: #e67e22; }
      .mc-coin-icon {
        display: inline-block;
        width: 14px;
        height: 14px;
        background: #ffff55;
        border-radius: 50%;
        border: 2px solid #000;
        vertical-align: middle;
        margin-left: 2px;
        position: relative;
      }
      .mc-coin-icon::after {
        content: '';
        position: absolute;
        width: 4px;
        height: 4px;
        background: #000;
        top: 3px;
        left: 3px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>💸 ระบบจัดการเงิน Satang13</h1>
        <div class="sub">ส่งคำสั่งโดยตรงผ่าน Named Pipe ปลอดภัย 100%</div>

        <!-- 💰 ส่วนแสดงผลยอดเงินปัจจุบัน -->
        <div class="balance-box">
          <div class="balance-info">
            <div class="balance-label">ยอดเงินคงเหลือในตัว</div>
            <div class="balance-val" id="displayBalance">---</div>
          </div>
          <button class="btn-balance" onclick="checkBalance()">🔄 เช็คยอดเงิน</button>
        </div>

        <div class="form-group">
          <label>ชื่อผู้เล่นปลายทาง</label>
          <input type="text" id="targetPlayer" placeholder="เช่น Kaitom_4" autocomplete="off" />
        </div>

        <div class="form-group">
          <label>จำนวนเงิน</label>
          <input type="number" id="payAmount" placeholder="เช่น 1 หรือ 100" min="1" />
        </div>

        <button class="btn-pay" onclick="sendPay()">โอนเงินทันที</button>
      </div>

      <div class="chat-screen-container">
        <div class="chat-header">📡 ประวัติการโอนเงิน (Live Log)</div>
        <div id="chatBox">
          <div class="mc-chat-line" style="color: #64748b;">รอคำสั่งโอนเงิน...</div>
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
            appendLogUI(player, amount);
            amountInput.value = '';
            // อัปเดตยอดเงินใหม่หลังโอนเสร็จ
            setTimeout(checkBalance, 2000);
          } else {
            alert(data.message);
          }
        } catch (e) {
          alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        }
      }

      function appendLogUI(player, amount) {
        const box = document.getElementById('chatBox');
        if (box.innerText.includes('รอคำสั่งโอนเงิน...')) {
          box.innerHTML = '';
        }
        const line = document.createElement('div');
        line.className = 'mc-chat-line';
        line.innerHTML = \`
          <span class="mc-tag">[ECONOMY]</span> <span class="mc-white">คุณโอนเงินจำนวน</span> <span class="mc-amount">\${amount}</span> <span class="mc-coin-icon"></span><br>
          <span class="mc-white">ให้กับผู้เล่น</span> <span class="mc-player">\${player}</span>
        \`;
        box.prepend(line);
      }

      async function fetchLogs() {
        try {
          const res = await fetch('/api/logs');
          const data = await res.json();
          if (data.logs && data.logs.length > 0) {
            const box = document.getElementById('chatBox');
            box.innerHTML = data.logs.map(log => {
              return \`<div class="mc-chat-line">\${log}</div>\`;
            }).reverse().join('');
          }
        } catch (e) {}
      }

      // โหลดเช็คยอดเงินครั้งแรกตอนเปิดหน้าเว็บ
      checkBalance();
      setInterval(fetchLogs, 3000);
    </script>
  </body>
  </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Satang Pay Controller รันบน http://localhost:${PORT}`);
});