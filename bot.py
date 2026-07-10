import tkinter as tk
from tkinter import messagebox
from tkinter import scrolledtext
from tkinter import ttk  
import subprocess
import threading
import os
import sys
import json  

class BotControllerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("🤖 Minecraft Dual-Bot Commander v1.0 (Cobble & Fish Only)")
        self.root.geometry("1100x600") # 🎯 ปรับขนาดให้กระชับพอดีกับ 2 บอท
        self.root.configure(bg="#1e1e2e")

        self.style = ttk.Style()
        self.style.theme_use('default')
        self.style.configure("Horizontal.TProgressbar", thickness=14, troughcolor="#313244", background="#a6e3a1", bordercolor="#1e1e2e", lightcolor="#a6e3a1", darkcolor="#a6e3a1")

        # 🚀 เหลือแค่ 2 โปรเซสตามสั่งของพี่เลยครับ
        self.processes = { "bot1": None, "bot2": None }
        self.bot_files = { "bot1": "fish.js", "bot2": "indexcobble.js" }

        self.alert_states = { "bot1": False, "bot2": False }
        self.blink_toggle = False
        
        self.bot1_rod_percent = "100"
        self.bot2_pick_percent = "100"

        self.setup_ui()
        self.start_global_blinker() 

    def setup_ui(self):
        title_label = tk.Label(self.root, text="ระบบแผงควบคุมคู่หูฟาร์ม AmoryCraft (Cobble & Fish Unified Dashboard)", font=("Helvetica", 12, "bold"), fg="#f5c2e7", bg="#1e1e2e")
        title_label.pack(pady=10)

        # 📦 แผงคอลัมน์แบ่งฝั่งซ้าย-ขวาสำหรับ 2 บอท
        columns_container = tk.Frame(self.root, bg="#1e1e2e")
        columns_container.pack(fill=tk.X, padx=20, pady=5)
        columns_container.grid_columnconfigure(0, weight=1)
        columns_container.grid_columnconfigure(1, weight=1)

        left_column = tk.Frame(columns_container, bg="#1e1e2e")
        left_column.grid(row=0, column=0, sticky="nsew", padx=(0, 10))

        right_column = tk.Frame(columns_container, bg="#1e1e2e")
        right_column.grid(row=0, column=1, sticky="nsew", padx=(10, 0))

        # 🎣 คอลัมน์ซ้าย: บอทตกปลา
        self.create_bot_panel(left_column, "บอทตกปลา", "bot1", cmd_text="🎣 สั่งตกปลา", cmd_func=lambda: self.send_command_to_bot("bot1", "fish"))
        self.bar_bot1 = ttk.Progressbar(getattr(self, "bot1_frame"), orient="horizontal", length=140, mode="determinate", style="Horizontal.TProgressbar")
        self.bar_bot1.pack(side=tk.RIGHT, padx=10)
        self.bar_bot1['value'] = 100
        self.progress_label_bot1 = tk.Label(getattr(self, "bot1_frame"), text="🎣 เบ็ด: 100%", font=("Helvetica", 9, "bold"), fg="#a6e3a1", bg="#1e1e2e")
        self.progress_label_bot1.pack(side=tk.RIGHT, padx=5)

        # ⛏️ คอลัมน์ขวา: บอทขุดหิน
        self.create_bot_panel(right_column, "บอทขุดหิน", "bot2", cmd_text="⛏️ เริ่มขุด", cmd_func=lambda: self.send_command_to_bot("bot2", "mine"))
        self.bar_bot2 = ttk.Progressbar(getattr(self, "bot2_frame"), orient="horizontal", length=140, mode="determinate", style="Horizontal.TProgressbar")
        self.bar_bot2.pack(side=tk.RIGHT, padx=10)
        self.bar_bot2['value'] = 100
        self.progress_label_bot2 = tk.Label(getattr(self, "bot2_frame"), text="⛏️ ที่ขุด: 100%", font=("Helvetica", 9, "bold"), fg="#74c7ec", bg="#1e1e2e")
        self.progress_label_bot2.pack(side=tk.RIGHT, padx=5)

        # 📊 ช่องแสดงรายงานข้อความสถานะ Live Logs ด้านล่าง
        log_frame = tk.LabelFrame(self.root, text=" 📊 ระบบบันทึกรายงานสถานะ (Clean Core Logs) ", font=("Helvetica", 10, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        self.log_widget = scrolledtext.ScrolledText(log_frame, font=("Consolas", 10), fg="#a6e3a1", bg="#11111b", wrap=tk.WORD)
        self.log_widget.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.log_widget.config(state="disabled")

        exit_btn = tk.Button(self.root, text="สับสะพานไฟฉุกเฉิน เตะบอททั้งหมดออกจากเกม (Kill All Exit)", command=self.kill_all_and_exit, font=("Helvetica", 9, "bold"), fg="#ffffff", bg="#f38ba8", activebackground="#e64553", activeforeground="#ffffff", height=2, bd=0, cursor="hand2")
        exit_btn.pack(fill=tk.X, padx=20, pady=10)

    def create_bot_panel(self, parent_frame, display_name, bot_key, cmd_text, cmd_func):
        frame = tk.LabelFrame(parent_frame, text=f" {display_name} - [{self.bot_files[bot_key]}] ", font=("Helvetica", 8, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1, height=65)
        frame.pack(fill=tk.X, pady=3)
        frame.pack_propagate(False)
        setattr(self, f"{bot_key}_frame", frame)

        status_canvas = tk.Canvas(frame, width=20, height=20, bg="#1e1e2e", highlightthickness=0)
        status_canvas.pack(side=tk.LEFT, padx=(10, 2))
        status_dot = status_canvas.create_oval(2, 2, 18, 18, fill="#f38ba8")

        status_text = tk.Label(frame, text="OFFLINE", font=("Helvetica", 8, "bold"), fg="#f38ba8", bg="#1e1e2e", width=8, anchor="w")
        status_text.pack(side=tk.LEFT, padx=(0, 10))

        setattr(self, f"{bot_key}_dot", status_dot)
        setattr(self, f"{bot_key}_canvas", status_canvas)
        setattr(self, f"{bot_key}_text", status_text)

        start_btn = tk.Button(frame, text="▶ เปิด", command=lambda: self.start_bot_thread(bot_key), font=("Helvetica", 8, "bold"), fg="#11111b", bg="#a6e3a1", bd=0, padx=10, pady=2, cursor="hand2")
        start_btn.pack(side=tk.LEFT, padx=3)
        setattr(self, f"{bot_key}_start_btn", start_btn)

        custom_btn = tk.Button(frame, text=cmd_text, command=cmd_func, font=("Helvetica", 8, "bold"), fg="#11111b", bg="#f9e2af", bd=0, padx=10, pady=2, state="disabled", cursor="hand2")
        custom_btn.pack(side=tk.LEFT, padx=3)
        setattr(self, f"{bot_key}_custom_btn", custom_btn)

        stop_btn = tk.Button(frame, text="■ ปิด", command=lambda: self.stop_bot(bot_key), font=("Helvetica", 8, "bold"), fg="#ffffff", bg="#181825", bd=0, padx=10, pady=2, state="disabled", cursor="hand2")
        stop_btn.pack(side=tk.LEFT, padx=3)
        setattr(self, f"{bot_key}_stop_btn", stop_btn)

        alert_canvas = tk.Canvas(frame, width=22, height=22, bg="#1e1e2e", highlightthickness=0)
        alert_canvas.pack(side=tk.RIGHT, padx=10)
        alert_dot = alert_canvas.create_oval(2, 2, 20, 20, fill="#1e1e2e")
        setattr(self, f"{bot_key}_alert_canvas", alert_canvas)
        setattr(self, f"{bot_key}_alert_dot", alert_dot)

    def update_status_ui(self, bot_key, is_running):
        canvas = getattr(self, f"{bot_key}_canvas")
        dot = getattr(self, f"{bot_key}_dot")
        text_label = getattr(self, f"{bot_key}_text")
        start_btn = getattr(self, f"{bot_key}_start_btn")
        stop_btn = getattr(self, f"{bot_key}_stop_btn")
        custom_btn = getattr(self, f"{bot_key}_custom_btn")

        if is_running:
            canvas.itemconfig(dot, fill="#a6e3a1")
            text_label.config(text="RUNNING", fg="#a6e3a1")
            start_btn.config(state="disabled", bg="#313244", fg="#585b70")
            stop_btn.config(state="normal", bg="#f38ba8", fg="#11111b")
            custom_btn.config(state="normal", bg="#f9e2af", fg="#11111b")
        else:
            canvas.itemconfig(dot, fill="#f38ba8")
            text_label.config(text="OFFLINE", fg="#f38ba8")
            start_btn.config(state="normal", bg="#a6e3a1", fg="#11111b")
            stop_btn.config(state="disabled", bg="#181825", fg="#585b70")
            custom_btn.config(state="disabled", bg="#181825", fg="#585b70")
            self.alert_states[bot_key] = False 
            self.refresh_alert_dot(bot_key)
            self.set_progress_ui(bot_key, 0)

    def start_global_blinker(self):
        self.blink_toggle = not self.blink_toggle
        for bot_key, has_alert in self.alert_states.items():
            if has_alert:
                a_canvas = getattr(self, f"{bot_key}_alert_canvas")
                a_dot = getattr(self, f"{bot_key}_alert_dot")
                color = "#f38ba8" if self.blink_toggle else "#1e1e2e"
                a_canvas.itemconfig(a_dot, fill=color)
        self.root.after(400, self.start_global_blinker)

    def refresh_alert_dot(self, bot_key):
        if not self.alert_states.get(bot_key, False):
            try:
                a_canvas = getattr(self, f"{bot_key}_alert_canvas")
                a_dot = getattr(self, f"{bot_key}_alert_dot")
                a_canvas.itemconfig(a_dot, fill="#1e1e2e")
            except: pass

    def set_progress_ui(self, bot_key, percentage):
        if bot_key == "bot1":
            self.progress_label_bot1.config(text=f"🎣 เบ็ด: {self.bot1_rod_percent}%")
            self.bar_bot1['value'] = percentage
        elif bot_key == "bot2":
            self.progress_label_bot2.config(text=f"⛏️ ที่ขุด: {self.bot2_pick_percent}%")
            self.bar_bot2['value'] = percentage

    def write_log(self, text):
        low_text = text.lower()
        if "chunk size" in low_text or "partial packet" in low_text or "world_particles" in low_text:
            return
        self.log_widget.config(state="normal")
        self.log_widget.insert(tk.END, text)
        self.log_widget.see(tk.END)
        self.log_widget.config(state="disabled")

    def start_bot_thread(self, bot_key):
        if self.processes[bot_key] is not None: return
        t = threading.Thread(target=self.run_bot_process, args=(bot_key,), daemon=True)
        t.start()

    def run_bot_process(self, bot_key):
        file_name = self.bot_files[bot_key]
        if not os.path.exists(file_name):
            self.root.after(0, self.write_log, f"❌ [ระบบ]: หาไฟล์ {file_name} ไม่เจอ!\n")
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

                    # ดักจับ % เบ็ดตกปลา
                    if bot_key == "bot1" and "👉 ROD_DURABILITY:" in line:
                        try:
                            val = line.split("👉 ROD_DURABILITY:")[1].strip()
                            self.bot1_rod_percent = val
                            self.root.after(0, lambda: self.set_progress_ui("bot1", int(val)))
                        except: pass
                        continue

                    if bot_key == "bot1" and "👉 ROD_BROKEN" in line:
                        self.alert_states["bot1"] = True
                        continue

                    # ดักจับ % ที่ขุดหิน
                    if bot_key == "bot2" and "👉 PICKAXE_DURABILITY:" in line:
                        try:
                            val = line.split("👉 PICKAXE_DURABILITY:")[1].strip()
                            self.bot2_pick_percent = val
                            self.root.after(0, lambda: self.set_progress_ui("bot2", int(val)))
                        except: pass
                        continue

                    if bot_key == "bot2" and "👉 PICKAXE_BROKEN" in line:
                        self.alert_states["bot2"] = True
                        continue

                    self.root.after(0, self.write_log, f"[{file_name}]: {line}")
            
            self.processes[bot_key].wait()
        except Exception as e:
            self.root.after(0, self.write_log, f"⚠️ [Error {file_name}]: {str(e)}\n")
        finally:
            self.processes[bot_key] = None
            self.root.after(0, self.update_status_ui, bot_key, False)

    def send_command_to_bot(self, bot_key, command):
        process = self.processes[bot_key]
        if process and process.poll() is None:
            try:
                process.stdin.write(f"{command}\n")
                process.stdin.flush()
                self.write_log(f"✍️ [ส่งคอมมานด์ -> {self.bot_files[bot_key]}]: '{command}' เรียบร้อยครับพี่\n")
            except: pass

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
        for bot_key in list(self.processes.keys()): self.stop_bot(bot_key)
        self.root.destroy()
        sys.exit(0)

if __name__ == "__main__":
    root = tk.Tk()
    app = BotControllerGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.kill_all_and_exit)
    root.mainloop()