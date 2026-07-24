import sys
import os
import subprocess
import threading
import tkinter as tk
import customtkinter as ctk

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class AmoryCraftBotGUI(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("AmoryCraft Auto-Mining Control Center")
        self.geometry("850x740")
        self.minsize(750, 620)

        self.process = None
        self.is_running = False

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ==================== LEFT SIDEBAR ====================
        self.sidebar_frame = ctk.CTkFrame(self, width=220, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar_frame.grid_rowconfigure(12, weight=1)

        # Title
        self.logo_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="⛏️ AmoryBot", 
            font=ctk.CTkFont(size=22, weight="bold")
        )
        self.logo_label.grid(row=0, column=0, padx=20, pady=(15, 5))

        # Status Label
        self.status_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="🔴 Status: OFFLINE", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#FF5555"
        )
        self.status_label.grid(row=1, column=0, padx=20, pady=(0, 10))

        # 📊 [NEW] Health & Food Status Frame
        self.stats_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="#1E1E1E", corner_radius=8)
        self.stats_frame.grid(row=2, column=0, padx=15, pady=(0, 10), sticky="ew")

        self.lbl_hp = ctk.CTkLabel(
            self.stats_frame, 
            text="❤️ Health: -- / 20", 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#FF4D4D"
        )
        self.lbl_hp.pack(padx=10, pady=(6, 2), anchor="w")

        self.lbl_food = ctk.CTkLabel(
            self.stats_frame, 
            text="🍖 Food: -- / 20", 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#FFA500"
        )
        self.lbl_food.pack(padx=10, pady=(0, 6), anchor="w")

        # Start / Stop Process Buttons
        self.btn_start_script = ctk.CTkButton(
            self.sidebar_frame, 
            text="▶️ Start Bot Process", 
            fg_color="#2EB67D", 
            hover_color="#1F8B5E",
            command=self.start_node_process
        )
        self.btn_start_script.grid(row=3, column=0, padx=20, pady=6)

        self.btn_stop_script = ctk.CTkButton(
            self.sidebar_frame, 
            text="⏹️ Stop Bot Process", 
            fg_color="#E01E5A", 
            hover_color="#A81340",
            state="disabled",
            command=self.stop_node_process
        )
        self.btn_stop_script.grid(row=4, column=0, padx=20, pady=6)

        # Divider
        self.separator = ctk.CTkFrame(self.sidebar_frame, height=2, fg_color="#333333")
        self.separator.grid(row=5, column=0, sticky="ew", padx=15, pady=10)

        # Mining Control Buttons
        self.btn_mine_fortune = ctk.CTkButton(
            self.sidebar_frame, 
            text="⛏️ Mine FORTUNE", 
            state="disabled",
            command=lambda: self.send_command("mine f")
        )
        self.btn_mine_fortune.grid(row=6, column=0, padx=20, pady=6)

        self.btn_mine_silk = ctk.CTkButton(
            self.sidebar_frame, 
            text="✨ Mine SILK TOUCH", 
            state="disabled",
            command=lambda: self.send_command("mine s")
        )
        self.btn_mine_silk.grid(row=7, column=0, padx=20, pady=6)

        # 🍖 [NEW] ปุ่มสั่งกินอาหาร Manual
        self.btn_eat = ctk.CTkButton(
            self.sidebar_frame, 
            text="🍖 Eat Food (Manual)", 
            fg_color="#D97706",
            hover_color="#B45309",
            state="disabled",
            command=lambda: self.send_command("eat")
        )
        self.btn_eat.grid(row=8, column=0, padx=20, pady=6)

        # 🏠 ปุ่ม Go Home
        self.btn_go_home = ctk.CTkButton(
            self.sidebar_frame, 
            text="🏠 Go Home (/home home)", 
            fg_color="#1D72B8",
            hover_color="#145287",
            state="disabled",
            command=lambda: self.send_command("home")
        )
        self.btn_go_home.grid(row=9, column=0, padx=20, pady=6)

        self.btn_cancel = ctk.CTkButton(
            self.sidebar_frame, 
            text="🛑 Cancel Mining", 
            fg_color="#ECB22E", 
            hover_color="#B2821E",
            text_color="#000000",
            state="disabled",
            command=lambda: self.send_command("c")
        )
        self.btn_cancel.grid(row=10, column=0, padx=20, pady=6)

        # 💀 Death Info Box
        self.death_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="#2A1B1B", corner_radius=8)
        self.death_frame.grid(row=11, column=0, padx=15, pady=(10, 10), sticky="ew")

        self.death_title = ctk.CTkLabel(
            self.death_frame,
            text="💀 Last Death Status",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#FF6B6B"
        )
        self.death_title.pack(padx=8, pady=(6, 2), anchor="w")

        self.death_reason_label = ctk.CTkLabel(
            self.death_frame,
            text="ยังไม่มีประวัติการตาย",
            font=ctk.CTkFont(size=11),
            text_color="#DDDDDD",
            wraplength=180,
            justify="left"
        )
        self.death_reason_label.pack(padx=8, pady=(0, 8), anchor="w")

        # ==================== MAIN CONTENT (LOG CONSOLE) ====================
        self.main_frame = ctk.CTkFrame(self, corner_radius=10)
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=15, pady=15)
        self.main_frame.grid_rowconfigure(1, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)

        self.console_title = ctk.CTkLabel(
            self.main_frame, 
            text="📟 Realtime Bot Logs & Output", 
            font=ctk.CTkFont(size=16, weight="bold")
        )
        self.console_title.grid(row=0, column=0, padx=15, pady=(15, 5), sticky="w")

        self.log_textbox = ctk.CTkTextbox(
            self.main_frame, 
            font=ctk.CTkFont(family="Consolas", size=13),
            activate_scrollbars=True
        )
        self.log_textbox.grid(row=1, column=0, padx=15, pady=5, sticky="nsew")

        self.input_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.input_frame.grid(row=2, column=0, padx=15, pady=15, sticky="ew")
        self.input_frame.grid_columnconfigure(0, weight=1)

        self.cmd_entry = ctk.CTkEntry(
            self.input_frame, 
            placeholder_text="Enter raw command (e.g., mine f, eat, home, c)..."
        )
        self.cmd_entry.grid(row=0, column=0, padx=(0, 10), sticky="ew")
        self.cmd_entry.bind("<Return>", lambda event: self.send_custom_command())

        self.btn_send = ctk.CTkButton(
            self.input_frame, 
            text="Send", 
            width=80,
            command=self.send_custom_command
        )
        self.btn_send.grid(row=0, column=1)

    # --- PROCESS MANAGEMENT ---
    def start_node_process(self):
        if self.is_running:
            return

        script_path = os.path.join(os.path.dirname(__file__), "indexcobble.js")
        if not os.path.exists(script_path):
            self.append_log(f"❌ Error: ไม่พบไฟล์ {script_path}\n")
            return

        try:
            self.process = subprocess.Popen(
                ["node", script_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            self.is_running = True
            self.update_ui_state(running=True)
            self.append_log("🚀 [SYSTEM] เริ่มการทำงานของสคริปต์ Node.js เรียบร้อยแล้ว...\n")

            threading.Thread(target=self.read_process_output, daemon=True).start()

        except Exception as e:
            self.append_log(f"❌ เกิดข้อผิดพลาดในการเปิด Process: {str(e)}\n")

    def stop_node_process(self):
        if self.process and self.is_running:
            try:
                self.process.terminate()
                self.process = None
            except Exception as e:
                self.append_log(f"⚠️ Error stopping process: {e}\n")
        
        self.is_running = False
        self.update_ui_state(running=False)
        self.append_log("🛑 [SYSTEM] ยุติการทำงานของ Process เรียบร้อยแล้ว\n")

    def read_process_output(self):
        while self.is_running and self.process and self.process.poll() is None:
            line = self.process.stdout.readline()
            if line:
                # 📊 ดักจับ STATS_UPDATE สำหรับอัปเดตเลือดและหลอดอาหาร
                if "[STATS_UPDATE]" in line:
                    try:
                        # รูปแบบ [STATS_UPDATE] HP:20/20 | FOOD:18/20
                        parts = line.split("[STATS_UPDATE]")[1].strip().split("|")
                        hp_str = parts[0].strip()   # HP:20/20
                        food_str = parts[1].strip() # FOOD:18/20
                        self.lbl_hp.configure(text=f"❤️ Health: {hp_str.replace('HP:', '')}")
                        self.lbl_food.configure(text=f"🍖 Food: {food_str.replace('FOOD:', '')}")
                    except Exception:
                        pass
                elif "[DEATH_REASON]" in line:
                    reason_text = line.replace("[DEATH_REASON]", "").strip()
                    self.death_reason_label.configure(text=reason_text)
                
                self.append_log(line)
        
        if self.is_running:
            self.is_running = False
            self.update_ui_state(running=False)
            self.append_log("🔌 [SYSTEM] การเชื่อมต่อหรือ Process ดับลงแล้ว\n")

    def send_command(self, cmd_text):
        if self.process and self.is_running and self.process.stdin:
            try:
                self.process.stdin.write(cmd_text + "\n")
                self.process.stdin.flush()
                self.append_log(f"> {cmd_text}\n")
            except Exception as e:
                self.append_log(f"❌ ยิงคำสั่งล้มเหลว: {str(e)}\n")

    def send_custom_command(self):
        cmd = self.cmd_entry.get().strip()
        if cmd:
            self.send_command(cmd)
            self.cmd_entry.delete(0, tk.END)

    def append_log(self, text):
        self.log_textbox.configure(state="normal")
        self.log_textbox.insert(tk.END, text)
        self.log_textbox.see(tk.END)
        self.log_textbox.configure(state="disabled")

    def update_ui_state(self, running):
        if running:
            self.status_label.configure(text="🟢 Status: ONLINE", text_color="#2EB67D")
            self.btn_start_script.configure(state="disabled")
            self.btn_stop_script.configure(state="normal")
            self.btn_mine_fortune.configure(state="normal")
            self.btn_mine_silk.configure(state="normal")
            self.btn_eat.configure(state="normal")        # เปิดใช้งานปุ่มสั่งกิน Manual
            self.btn_go_home.configure(state="normal")
            self.btn_cancel.configure(state="normal")
        else:
            self.status_label.configure(text="🔴 Status: OFFLINE", text_color="#FF5555")
            self.lbl_hp.configure(text="❤️ Health: -- / 20")
            self.lbl_food.configure(text="🍖 Food: -- / 20")
            self.btn_start_script.configure(state="normal")
            self.btn_stop_script.configure(state="disabled")
            self.btn_mine_fortune.configure(state="disabled")
            self.btn_mine_silk.configure(state="disabled")
            self.btn_eat.configure(state="disabled")       # ปิดใช้งานปุ่มสั่งกิน Manual
            self.btn_go_home.configure(state="disabled")
            self.btn_cancel.configure(state="disabled")

    def on_closing(self):
        self.stop_node_process()
        self.destroy()

if __name__ == "__main__":
    app = AmoryCraftBotGUI()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()