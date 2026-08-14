import tkinter as tk
from tkinter import scrolledtext
import subprocess
import threading
import os
import json 

class AFKBotControllerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("🤖 AmoryCraft Multi-AFK Station v2.0")
        self.root.geometry("800x650")
        self.root.configure(bg="#1e1e2e")

        self.processes = {} # เก็บ Process แยกไอดี
        self.bot_ui_elements = {}

        self.setup_ui()

    def setup_ui(self):
        title_label = tk.Label(self.root, text="ระบบแผงควบคุมบอทเปิดฟาร์ม AFK (Multi-Account Hub)", font=("Helvetica", 12, "bold"), fg="#f5c2e7", bg="#1e1e2e")
        title_label.pack(pady=10)

        dashboard = tk.Frame(self.root, bg="#1e1e2e")
        dashboard.pack(fill=tk.X, padx=20, pady=5)

        # รายชื่อไอดีบอทที่ต้องการควบคุม
        bots = ["tutipong", "Bee67"]

        for name in bots:
            frame_bot = tk.LabelFrame(dashboard, text=f" ไอดีบอท: {name} ", font=("Helvetica", 9, "bold"), fg="#cdd6f4", bg="#1e1e2e", bd=1)
            frame_bot.pack(fill=tk.X, pady=5, ipady=5)

            # ไฟ LED สถานะ
            canvas = tk.Canvas(frame_bot, width=16, height=16, bg="#1e1e2e", highlightthickness=0)
            canvas.pack(side=tk.LEFT, padx=(15, 5))
            oval = canvas.create_oval(2, 2, 14, 14, fill="#f38ba8")
            
            status_txt = tk.Label(frame_bot, text="OFFLINE", font=("Helvetica", 9, "bold"), fg="#f38ba8", bg="#1e1e2e", width=10, anchor="w")
            status_txt.pack(side=tk.LEFT, padx=5)

            # ปุ่มกด Start / Stop แยกตามชื่อ
            btn_start = tk.Button(frame_bot, text="▶ เปิดรันบอท", command=lambda n=name: self.start_bot(n), font=("Helvetica", 9, "bold"), fg="#11111b", bg="#a6e3a1", bd=0, height=1, width=14, cursor="hand2")
            btn_start.pack(side=tk.LEFT, padx=10)

            btn_stop = tk.Button(frame_bot, text="■ ปิดบอท", command=lambda n=name: self.stop_bot(n), font=("Helvetica", 9, "bold"), fg="#ffffff", bg="#313244", bd=0, height=1, width=14, state="disabled", cursor="hand2")
            btn_stop.pack(side=tk.LEFT, padx=5)

            # บันทึกองค์ประกอบ UI ไว้ดึงมาอัปเดต
            self.bot_ui_elements[name] = {
                "canvas": canvas,
                "oval": oval,
                "txt": status_txt,
                "btn_start": btn_start,
                "btn_stop": btn_stop
            }

        # 📊 แผงรายงาน Live Logs
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

    def start_bot(self, username):
        if username in self.processes and self.processes[username] is not None:
            return
        t = threading.Thread(target=self.run_node_backend, args=(username,), daemon=True)
        t.start()

    def run_node_backend(self, username):
        file_name = "afk.js"
        if not os.path.exists(file_name):
            self.root.after(0, self.write_log, f"❌ [Error]: หาไฟล์หลังบ้าน {file_name} ไม่เจอ!\n")
            return

        try:
            # ปรับปุ่ม UI
            self.bot_ui_elements[username]["btn_start"].config(state="disabled", bg="#313244", fg="#585b70")
            self.bot_ui_elements[username]["btn_stop"].config(state="normal", bg="#f38ba8", fg="#11111b")
            
            current_env = os.environ.copy()
            current_env["PYTHONIOENCODING"] = "utf-8"
            
            # ส่งพารามิเตอร์ชื่อบอทไปยัง afk.js
            proc = subprocess.Popen(
                ["node", file_name, username], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env=current_env, text=True, bufsize=1, encoding="utf-8"
            )
            self.processes[username] = proc

            for line in iter(proc.stdout.readline, ''):
                if line:
                    if "AFK_BOT_DATA:" in line:
                        try:
                            raw_json = line.split("AFK_BOT_DATA:")[1].strip()
                            data = json.loads(raw_json)
                            u_name = data["username"]
                            status = data["status"]
                            self.root.after(0, lambda u=u_name, s=status: self.update_bot_status_ui(u, s))
                        except: pass
                        continue
                    self.root.after(0, self.write_log, line)
            proc.wait()
        except Exception as e:
            self.root.after(0, self.write_log, f"⚠️ [{username} Error]: {str(e)}\n")
        finally:
            self.processes[username] = None
            self.root.after(0, lambda u=username: self.reset_ui_to_offline(u))

    def update_bot_status_ui(self, username, status):
        if username not in self.bot_ui_elements: return
        color = "#a6e3a1" if "ONLINE" in status else "#f9e2af" if "LOADING" in status else "#f38ba8"
        ui = self.bot_ui_elements[username]
        ui["canvas"].itemconfig(ui["oval"], fill=color)
        ui["txt"].config(text=status, fg=color)

    def reset_ui_to_offline(self, username):
        if username not in self.bot_ui_elements: return
        ui = self.bot_ui_elements[username]
        ui["btn_start"].config(state="normal", bg="#a6e3a1", fg="#11111b")
        ui["btn_stop"].config(state="disabled", bg="#313244", fg="#585b70")
        ui["canvas"].itemconfig(ui["oval"], fill="#f38ba8")
        ui["txt"].config(text="OFFLINE", fg="#f38ba8")

    def stop_bot(self, username):
        if username in self.processes and self.processes[username] is not None:
            proc = self.processes[username]
            if proc.poll() is None:
                try: proc.terminate()
                except: pass
            self.processes[username] = None
        self.reset_ui_to_offline(username)

if __name__ == "__main__":
    root = tk.Tk()
    app = AFKBotControllerGUI(root)
    root.mainloop()