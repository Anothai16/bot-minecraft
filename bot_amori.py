import tkinter as tk
from tkinter import messagebox
from tkinter import scrolledtext
from tkinter import ttk  
import subprocess
import threading
import os
import sys
import json
import time

class AmoryBotControllerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("🤖 AmoryCraft Bits Core-Scanner v2.4")
        self.root.geometry("1450x850") 
        self.root.configure(bg="#1e1e2e")

        self.style = ttk.Style()
        self.style.theme_use('default')

        # 🚀 [รายชื่อไอดีฝูงบอทของพี่]
        self.account_list = [
            'obs1', 'Morgan05', 'Domertown', 'Nattanon09', 'Nanepez', 'Sudlorkayeejai', 'Wood_Skel', 'sindirt', 'Pompamz', 'Netherboy', 'quast', 'Geyman'
            , 'Jolibee','Posma2','Rxzy3','mecular','tutipong', 'Iron34','d456','llMasterll','Ixcw2534','ShadowEmpress','gulnwza007','Monosox','twenty29','0zow29'
        ]

        self.processes = {name: None for name in self.account_list}
        self.bot_bits_tracker = {name: 0 for name in self.account_list}
        
        self.ui_elements = {}
        self.setup_ui()

    def setup_ui(self):
        title_label = tk.Label(self.root, text="ระบบแผงควบคุมฝูงบอทคิวสายเนียน AmoryCraft (Unified Bit Watcher)", font=("Helvetica", 14, "bold"), fg="#f5c2e7", bg="#1e1e2e")
        title_label.pack(pady=10)

        # 📦 เมนูกลุ่มปุ่มกดสั่งระดมพลทะยอยปล่อยคิวบอททีละ 10 ตัว
        batch_frame = tk.LabelFrame(self.root, text=" ✈️ แผงสั่งการระดมพลคิวหน่วงเวลา (คลิกเดียว บูตโปรเซส + CONNECT ออโต้) ", font=("Helvetica", 10, "bold"), fg="#fab387", bg="#1e1e2e", bd=1)
        batch_frame.pack(fill=tk.X, padx=20, pady=5)

        btn_batch1 = tk.Button(batch_frame, text="🚀 รันและล็อกอินบอทชุดที่ 1 (ตัวที่ 1 - 10)", command=lambda: self.trigger_batch_process_queue(0, 10), font=("Helvetica", 9, "bold"), fg="#11111b", bg="#a6e3a1", bd=0, padx=15, pady=8, cursor="hand2")
        btn_batch1.pack(side=tk.LEFT, padx=15, pady=10)

        btn_batch2 = tk.Button(batch_frame, text="🚀 รันและล็อกอินบอทชุดที่ 2 (ตัวที่ 11 - 20)", command=lambda: self.trigger_batch_process_queue(10, 20), font=("Helvetica", 9, "bold"), fg="#11111b", bg="#74c7ec", bd=0, padx=15, pady=8, cursor="hand2")
        btn_batch2.pack(side=tk.LEFT, padx=15, pady=10)

        # 📦 Container แบ่งฝั่งซ้าย-ขวา
        main_container = tk.Frame(self.root, bg="#1e1e2e")
        main_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=5)
        main_container.grid_columnconfigure(0, weight=1)
        main_container.grid_columnconfigure(1, weight=1)

        # 💾 แผงควบคุมบอท + สไลด์เลื่อนส่องดู (ฝั่งซ้าย)
        left_wrapper = tk.LabelFrame(main_container, text=" 💾 สถานะแดชบอร์ดและการควบคุมรายไอดี ", font=("Helvetica", 10, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1)
        left_wrapper.grid(row=0, column=0, sticky="nsew", padx=(0, 10))

        canvas = tk.Canvas(left_wrapper, bg="#1e1e2e", highlightthickness=0)
        scrollbar = ttk.Scrollbar(left_wrapper, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#1e1e2e")

        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        scrollbar.pack(side="right", fill="y")

        for idx, name in enumerate(self.account_list):
            self.create_bot_row(scrollable_frame, f"[{idx+1}] ไอดี: {name}", name)

        # 📊 แผงรายงาน Live Logs หน้าต่างตรวจสอบ Packet (ฝั่งขวา)
        right_column = tk.LabelFrame(main_container, text=" 📊 ระบบตรวจสอบและถอดรหัสสัญญาณบอร์ดดิบ (Core Live Logs) ", font=("Helvetica", 10, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1)
        right_column.grid(row=0, column=1, sticky="nsew", padx=(10, 0))

        self.log_widget = scrolledtext.ScrolledText(right_column, font=("Consolas", 9), fg="#a6e3a1", bg="#11111b", wrap=tk.WORD)
        self.log_widget.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.log_widget.config(state="disabled")

        # ปุ่ม Kill All ตัดสะพานไฟทิ้งทั้งหมด
        exit_btn = tk.Button(self.root, text="สับสะพานไฟฉุกเฉิน เตะฝูงบอททั้งหมดออกจากเกม (Kill All)", command=self.kill_all_and_exit, font=("Helvetica", 9, "bold"), fg="#ffffff", bg="#f38ba8", activebackground="#e64553", activeforeground="#ffffff", height=2, bd=0, cursor="hand2")
        exit_btn.pack(fill=tk.X, padx=20, pady=10)

    def create_bot_row(self, parent, display_name, bot_key):
        frame = tk.Frame(parent, bg="#1e1e2e", height=45)
        frame.pack(fill=tk.X, padx=5, pady=2)

        # ไฟสัญญาณกลม
        status_canvas = tk.Canvas(frame, width=12, height=12, bg="#1e1e2e", highlightthickness=0)
        status_canvas.pack(side=tk.LEFT, padx=(5, 5))
        status_dot = status_canvas.create_oval(2, 2, 10, 10, fill="#f38ba8")

        # ป้ายชื่อ
        name_label = tk.Label(frame, text=display_name, font=("Helvetica", 9, "bold"), fg="#cdd6f4", bg="#1e1e2e", width=18, anchor="w")
        name_label.pack(side=tk.LEFT, padx=5)

        # สเตตัส
        status_text = tk.Label(frame, text="OFFLINE", font=("Helvetica", 8, "bold"), fg="#f38ba8", bg="#1e1e2e", width=10, anchor="w")
        status_text.pack(side=tk.LEFT, padx=2)

        # ป้ายคะแนนบิท
        data_label = tk.Label(frame, text="🪙 ยอดบิท: 0 บิท", font=("Helvetica", 9, "bold"), fg="#74c7ec", bg="#1e1e2e", width=22, anchor="w")
        data_label.pack(side=tk.LEFT, padx=10)

        run_btn = tk.Button(frame, text="⚡ รันเข้าเกม", command=lambda: self.trigger_single_auto_connect(bot_key), font=("Helvetica", 8, "bold"), fg="#11111b", bg="#a6e3a1", bd=0, padx=12, cursor="hand2")
        run_btn.pack(side=tk.LEFT, padx=2)

        stop_btn = tk.Button(frame, text="■ ปิดบอท", command=lambda: self.stop_bot(bot_key), font=("Helvetica", 8, "bold"), fg="#ffffff", bg="#313244", bd=0, padx=12, state="disabled", cursor="hand2")
        stop_btn.pack(side=tk.LEFT, padx=2)

        self.ui_elements[bot_key] = {
            "canvas": status_canvas, "dot": status_dot, "text": status_text,
            "data_label": data_label, "run_btn": run_btn, "stop_btn": stop_btn
        }

    def update_status_ui(self, bot_key, is_running):
        elements = self.ui_elements.get(bot_key)
        if not elements: return
        
        if is_running:
            elements["canvas"].itemconfig(elements["dot"], fill="#a6e3a1")
            elements["text"].config(text="ONLINE", fg="#a6e3a1")
            elements["run_btn"].config(state="disabled", bg="#313244", fg="#585b70")
            elements["stop_btn"].config(state="normal", bg="#f38ba8", fg="#11111b")
        else:
            elements["canvas"].itemconfig(elements["dot"], fill="#f38ba8")
            elements["text"].config(text="OFFLINE", fg="#f38ba8")
            elements["run_btn"].config(state="normal", bg="#a6e3a1", fg="#11111b")
            elements["stop_btn"].config(state="disabled", bg="#313244", fg="#585b70")
            self.bot_bits_tracker[bot_key] = 0
            elements["data_label"].config(text="🪙 ยอดบิท: 0 บิท")

    def write_log(self, text):
        self.log_widget.config(state="normal")
        self.log_widget.insert(tk.END, text)
        self.log_widget.see(tk.END)
        self.log_widget.config(state="disabled")

    def trigger_single_auto_connect(self, bot_key):
        if self.processes[bot_key] is not None: return
        t = threading.Thread(target=self.run_single_auto_process, args=(bot_key,), daemon=True)
        t.start()

    def run_single_auto_process(self, bot_key):
        self.start_node_engine(bot_key)
        time.sleep(2.0)
        self.send_command_to_bot(bot_key, f"connect {bot_key}")

    # 🎯 [จุดแก้ไขระบบคิวหน่วงเวลากลุ่ม]: ยืดเวลาคอยเซฟตี้จาก 4.5 วินาที เป็น 15.0 วินาทีเต็มตามสั่งครับ
    def trigger_batch_process_queue(self, start_idx, end_idx):
        t = threading.Thread(target=self.process_batch_queue_logic, args=(start_idx, end_idx), daemon=True)
        t.start()

    def process_batch_queue_logic(self, start_idx, end_idx):
        target_batch = self.account_list[start_idx:end_idx]
        self.root.after(0, self.write_log, f"\n⚡ [ระบบคิว]: เริ่มต้นคิวทะยอยปล่อยตัวบอทรายบุคคล (หน่วงเวลาเซฟตี้ 15 วินาที/ตัว)...\n")
        
        for idx, name in enumerate(target_batch):
            if self.processes[name] is not None: continue
            
            self.root.after(0, self.write_log, f"⚙️ [คิวอัตโนมัติ]: บูตไฟล์เบื้องหลังและสั่งยิงคอนเน็กต์ให้กับไอดี -> {name}\n")
            self.start_node_engine(name)
            time.sleep(2.0) # รอระบบท่อส่ง Readline หลังบ้านตั้งตัว 2 วินาที
            self.send_command_to_bot(name, f"connect {name}")
            
            # 🎯 ดักเช็คหน่วงเวลา 15 วินาที ยกเว้นไอดีตัวสุดท้ายของชุดคิว จะได้ไม่ต้องรอเก้อหลังรันเสร็จครับ
            if idx < len(target_batch) - 1:
                self.root.after(0, self.write_log, f"⏳ [Anti-Spam]: พักคอยระบายสายเน็ตเวิร์ก 15 วินาที ก่อนปลดคิวให้ตัวถัดไป...\n")
                time.sleep(15.0)
            
        self.root.after(0, self.write_log, f"✅ [ระบบคิว]: ระดมพลฝูงบอทเข้าเซิร์ฟย่อยเสร็จสิ้นด้วยดี เว้นจังหวะปลอดภัย 100% ครับพี่!\n\n")

    def start_node_engine(self, bot_key):
        file_name = "bot_amori.js"
        t = threading.Thread(target=self.run_bot_process, args=(bot_key, file_name), daemon=True)
        t.start()

    def run_bot_process(self, bot_key, file_name):
        if not os.path.exists(file_name):
            self.root.after(0, self.write_log, f"❌ [ระบบ]: หาไฟล์ {file_name} ไม่เจอในโฟลเดอร์นี้!\n")
            return

        try:
            current_env = os.environ.copy()
            current_env["PYTHONIOENCODING"] = "utf-8"
            self.processes[bot_key] = subprocess.Popen(
                ["node", file_name], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env=current_env, text=True, bufsize=1, encoding="utf-8"
            )
            self.root.after(0, self.update_status_ui, bot_key, True)
            
            for line in iter(self.processes[bot_key].stdout.readline, ''):
                if line:
                    if "PartialReadError" in line or "packet_world_particles" in line or "partial packet" in line or "Chunk size" in line:
                        continue

                    if "BIT_DATA:" in line:
                        try:
                            json_str = line.split("BIT_DATA:")[1].strip()
                            data = json.loads(json_str)
                            b_val = data.get('bits', 0)
                            
                            self.bot_bits_tracker[bot_key] = b_val
                            self.root.after(0, lambda k=bot_key, b=b_val: self.ui_elements[k]["data_label"].config(
                                text=f"🪙 ยอดบิท: {b} บิท"
                            ))
                        except: pass
                        continue

                    self.root.after(0, self.write_log, f"[{bot_key}] {line}")
            
            self.processes[bot_key].wait()
        except Exception as e:
            self.root.after(0, self.write_log, f"⚠️ [Error {bot_key}]: {str(e)}\n")
        finally:
            self.processes[bot_key] = None
            self.root.after(0, self.update_status_ui, bot_key, False)

    def send_command_to_bot(self, bot_key, command):
        process = self.processes[bot_key]
        if process and process.poll() is None:
            try:
                process.stdin.write(f"{command}\n")
                process.stdin.flush()
            except Exception as e: pass

    def stop_bot(self, bot_key):
        process = self.processes[bot_key]
        if process is not None and process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=1)
            except:
                try: process.kill()
                except: pass
        self.processes[bot_key] = None
        self.update_status_ui(bot_key, False)

    def kill_all_and_exit(self):
        for name in self.account_list: 
            self.stop_bot(name)
        self.root.destroy()
        sys.exit(0)

if __name__ == "__main__":
    root = tk.Tk()
    app = AmoryBotControllerGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.kill_all_and_exit)
    root.mainloop()