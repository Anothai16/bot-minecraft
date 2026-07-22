import sys
import os
import subprocess
import threading
import tkinter as tk
import customtkinter as ctk

# ตั้งค่า Theme ของ GUI
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class AmoryCraftBotGUI(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("AmoryCraft Auto-Mining Control Center")
        self.geometry("850x600")
        self.minsize(750, 500)

        self.process = None
        self.is_running = False

        # --- Grid Layout Setup ---
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ==================== LEFT SIDEBAR ====================
        self.sidebar_frame = ctk.CTkFrame(self, width=220, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar_frame.grid_rowconfigure(8, weight=1)

        # Title
        self.logo_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="⛏️ AmoryBot", 
            font=ctk.CTkFont(size=22, weight="bold")
        )
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 10))

        # Status Label
        self.status_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="🔴 Status: OFFLINE", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#FF5555"
        )
        self.status_label.grid(row=1, column=0, padx=20, pady=(0, 20))

        # Start / Stop Process Buttons
        self.btn_start_script = ctk.CTkButton(
            self.sidebar_frame, 
            text="▶️ Start Bot Process", 
            fg_color="#2EB67D", 
            hover_color="#1F8B5E",
            command=self.start_node_process
        )
        self.btn_start_script.grid(row=2, column=0, padx=20, pady=8)

        self.btn_stop_script = ctk.CTkButton(
            self.sidebar_frame, 
            text="⏹️ Stop Bot Process", 
            fg_color="#E01E5A", 
            hover_color="#A81340",
            state="disabled",
            command=self.stop_node_process
        )
        self.btn_stop_script.grid(row=3, column=0, padx=20, pady=8)

        # Divider
        self.separator = ctk.CTkFrame(self.sidebar_frame, height=2, fg_color="#333333")
        self.separator.grid(row=4, column=0, sticky="ew", padx=15, pady=15)

        # Mining Control Buttons
        self.btn_mine_fortune = ctk.CTkButton(
            self.sidebar_frame, 
            text="⛏️ Mine FORTUNE", 
            state="disabled",
            command=lambda: self.send_command("mine f")
        )
        self.btn_mine_fortune.grid(row=5, column=0, padx=20, pady=8)

        self.btn_mine_silk = ctk.CTkButton(
            self.sidebar_frame, 
            text="✨ Mine SILK TOUCH", 
            state="disabled",
            command=lambda: self.send_command("mine s")
        )
        self.btn_mine_silk.grid(row=6, column=0, padx=20, pady=8)

        self.btn_cancel = ctk.CTkButton(
            self.sidebar_frame, 
            text="🛑 Cancel Mining", 
            fg_color="#ECB22E", 
            hover_color="#B2821E",
            text_color="#000000",
            state="disabled",
            command=lambda: self.send_command("c")
        )
        self.btn_cancel.grid(row=7, column=0, padx=20, pady=8)

        # ==================== MAIN CONTENT (LOG CONSOLE) ====================
        self.main_frame = ctk.CTkFrame(self, corner_radius=10)
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=15, pady=15)
        self.main_frame.grid_rowconfigure(1, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)

        # Console Header
        self.console_title = ctk.CTkLabel(
            self.main_frame, 
            text="📟 Realtime Bot Logs & Output", 
            font=ctk.CTkFont(size=16, weight="bold")
        )
        self.console_title.grid(row=0, column=0, padx=15, pady=(15, 5), sticky="w")

        # Textbox Console
        self.log_textbox = ctk.CTkTextbox(
            self.main_frame, 
            font=ctk.CTkFont(family="Consolas", size=13),
            activate_scrollbars=True
        )
        self.log_textbox.grid(row=1, column=0, padx=15, pady=5, sticky="nsew")

        # Command Input Area
        self.input_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.input_frame.grid(row=2, column=0, padx=15, pady=15, sticky="ew")
        self.input_frame.grid_columnconfigure(0, weight=1)

        self.cmd_entry = ctk.CTkEntry(
            self.input_frame, 
            placeholder_text="Enter raw command (e.g., mine f, c)..."
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
        """ สั่งรัน node .\indexcobble.js เบื้องหลัง """
        if self.is_running:
            return

        script_path = os.path.join(os.path.dirname(__file__), "indexcobble.js")
        if not os.path.exists(script_path):
            self.append_log(f"❌ Error: ไม่พบไฟล์ {script_path}\n")
            return

        try:
            # รัน Node.js Subprocess พร้อม UTF-8 Encoding
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

            # เปิด Thread อ่าน Log Real-time ไม่ให้ GUI ค้าง
            threading.Thread(target=self.read_process_output, daemon=True).start()

        except Exception as e:
            self.append_log(f"❌ เกิดข้อผิดพลาดในการเปิด Process: {str(e)}\n")

    def stop_node_process(self):
        """ สั่งหยุดการทำงานของ Node.js Process """
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
        """ อ่าน Output จาก Node.js แบบ Realtime """
        while self.is_running and self.process and self.process.poll() is None:
            line = self.process.stdout.readline()
            if line:
                self.append_log(line)
        
        if self.is_running:
            self.is_running = False
            self.update_ui_state(running=False)
            self.append_log("🔌 [SYSTEM] การเชื่อมต่อหรือ Process ดับลงแล้ว\n")

    def send_command(self, cmd_text):
        """ ยิงคำสั่งไปยัง stdin ของ Node.js """
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
        """ อัปเดตข้อความลงใน Log Textbox """
        self.log_textbox.configure(state="normal")
        self.log_textbox.insert(tk.END, text)
        self.log_textbox.see(tk.END)
        self.log_textbox.configure(state="disabled")

    def update_ui_state(self, running):
        """ สลับสถานะปุ่มและป้ายกำกับ """
        if running:
            self.status_label.configure(text="🟢 Status: ONLINE", text_color="#2EB67D")
            self.btn_start_script.configure(state="disabled")
            self.btn_stop_script.configure(state="normal")
            self.btn_mine_fortune.configure(state="normal")
            self.btn_mine_silk.configure(state="normal")
            self.btn_cancel.configure(state="normal")
        else:
            self.status_label.configure(text="🔴 Status: OFFLINE", text_color="#FF5555")
            self.btn_start_script.configure(state="normal")
            self.btn_stop_script.configure(state="disabled")
            self.btn_mine_fortune.configure(state="disabled")
            self.btn_mine_silk.configure(state="disabled")
            self.btn_cancel.configure(state="disabled")

    def on_closing(self):
        self.stop_node_process()
        self.destroy()

if __name__ == "__main__":
    app = AmoryCraftBotGUI()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()