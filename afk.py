import tkinter as tk
from tkinter import scrolledtext
from tkinter import ttk  
import subprocess
import threading
import os
import sys
import json  

class AFKBotControllerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("🤖 AmoryCraft Single-AFK Station v1.0")
        self.root.geometry("750x550") # ปรับขนาดให้กระทัดรัดสบายตา
        self.root.configure(bg="#1e1e2e")

        self.process = None
        self.setup_ui()

    def setup_ui(self):
        title_label = tk.Label(self.root, text="ระบบแผงควบคุมบอทเปิดฟาร์ม AFK (Single Account Hub)", font=("Helvetica", 11, "bold"), fg="#f5c2e7", bg="#1e1e2e")
        title_label.pack(pady=10)

        # 📦 แผงแดชบอร์ดแสดงสถานะไอดีเดี่ยว tutipong
        dashboard = tk.Frame(self.root, bg="#1e1e2e")
        dashboard.pack(fill=tk.X, padx=20, pady=5)

        frame_bot = tk.LabelFrame(dashboard, text=" ไอดีบอทเปิดฟาร์ม: tutipong ", font=("Helvetica", 9, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1, height=65)
        frame_bot.pack(fill=tk.X, ipady=5)
        frame_bot.pack_propagate(False)
        
        self.dot_canvas = tk.Canvas(frame_bot, width=16, height=16, bg="#1e1e2e", highlightthickness=0)
        self.dot_canvas.pack(side=tk.LEFT, padx=(15, 5))
        self.oval_status = self.dot_canvas.create_oval(2, 2, 14, 14, fill="#f38ba8")
        
        self.txt_status = tk.Label(frame_bot, text="OFFLINE", font=("Helvetica", 9, "bold"), fg="#f38ba8", bg="#1e1e2e")
        self.txt_status.pack(side=tk.LEFT, padx=5)

        # 🎛️ ปุ่มเปิด/ปิด ระบบหลัก
        btn_frame = tk.Frame(self.root, bg="#1e1e2e")
        btn_frame.pack(fill=tk.X, padx=20, pady=10)

        self.start_btn = tk.Button(btn_frame, text="▶ เปิดระบบรันบอท", command=self.start_backend_process, font=("Helvetica", 9, "bold"), fg="#11111b", bg="#a6e3a1", bd=0, height=2, width=22, cursor="hand2")
        self.start_btn.pack(side=tk.LEFT, padx=5)

        self.stop_btn = tk.Button(btn_frame, text="■ ปิดระบบบอท", command=self.stop_backend_process, font=("Helvetica", 9, "bold"), fg="#ffffff", bg="#313244", bd=0, height=2, width=22, state="disabled", cursor="hand2")
        self.stop_btn.pack(side=tk.LEFT, padx=5)

        # 📊 แผงรายงานข้อความสถานะสด Live Logs
        log_frame = tk.LabelFrame(self.root, text=" 📊 ระบบบันทึกสถานะเรียลไทม์ (Live AFK Logs) ", font=("Helvetica", 9, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        self.log_widget = scrolledtext.ScrolledText(log_frame, font=("Consolas", 10), fg="#a6e3a1", bg="#11111b", wrap=tk.WORD)
        self.log_widget.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.log_widget.config(state="disabled")

    def write_log(self, text):
        self.log_widget.config(state="normal")
        self.log_widget.insert(tk.END, text)
        self.log_widget.see(tk.END)
        self.log_widget.config(state="disabled")

    def start_backend_process(self):
        if self.process is not None: return
        t = threading.Thread(target=self.run_node_backend, daemon=True)
        t.start()

    def run_node_backend(self):
        file_name = "afk.js"
        if not os.path.exists(file_name):
            self.root.after(0, self.write_log, f"❌ [Error]: หาไฟล์หลังบ้าน {file_name} ไม่เจอในโฟลเดอร์ด่วน!\n")
            return

        try:
            self.start_btn.config(state="disabled", bg="#313244", fg="#585b70")
            self.stop_btn.config(state="normal", bg="#f38ba8", fg="#11111b")
            
            current_env = os.environ.copy()
            current_env["PYTHONIOENCODING"] = "utf-8"
            self.process = subprocess.Popen(
                ["node", file_name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env=current_env, text=True, bufsize=1, encoding="utf-8"
            )

            for line in iter(self.process.stdout.readline, ''):
                if line:
                    if "AFK_BOT_DATA:" in line:
                        try:
                            raw_json = line.split("AFK_BOT_DATA:")[1].strip()
                            data = json.loads(raw_json)
                            status = data["status"]
                            self.root.after(0, lambda s=status: self.update_bot_status_ui(s))
                        except: pass
                        continue
                    self.root.after(0, self.write_log, line)
            self.process.wait()
        except Exception as e:
            self.root.after(0, self.write_log, f"⚠️ [Error]: {str(e)}\n")
        finally:
            self.process = None
            self.root.after(0, self.reset_ui_to_offline)

    def update_bot_status_ui(self, status):
        color = "#a6e3a1" if "ONLINE" in status else "#f9e2af" if "LOADING" in status else "#f38ba8"
        self.dot_canvas.itemconfig(self.oval_status, fill=color)
        self.txt_status.config(text=status, fg=color)

    def reset_ui_to_offline(self):
        self.start_btn.config(state="normal", bg="#a6e3a1", fg="#11111b")
        self.stop_btn.config(state="disabled", bg="#313244", fg="#585b70")
        self.dot_canvas.itemconfig(self.oval_status, fill="#f38ba8")
        self.txt_status.config(text="OFFLINE", fg="#f38ba8")

    def stop_backend_process(self):
        if self.process is not None and self.process.poll() is None:
            try: self.process.terminate()
            except: pass
        self.process = None
        self.reset_ui_to_offline()

if __name__ == "__main__":
    root = tk.Tk()
    app = AFKBotControllerGUI(root)
    root.mainloop()