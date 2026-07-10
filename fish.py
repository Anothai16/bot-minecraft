import tkinter as tk
from tkinter import scrolledtext
from tkinter import ttk
import subprocess
import threading
import os
import sys
import json

class FishingControllerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("🎣 AmoryCraft Smart Fishing Core v1.0")
        self.root.geometry("1100x650")
        self.root.configure(bg="#11111b")

        self.style = ttk.Style()
        self.style.theme_use('default')

        self.bot_process = None
        self.is_fishing = False
        
        self.setup_ui()
        
        # 🎯 เปิดเครื่องปุ๊บ บูตบอทเข้าเซิร์ฟทันทีออโต้ตามกฎ
        self.start_node_engine()

    def setup_ui(self):
        # ป้ายหัวข้อด้านบน
        title_label = tk.Label(self.root, text="ระบบควบคุมมาโครตกปลาอัจฉริยะ (ขจัดมลพิษ Log ขยะ 100%)", font=("Helvetica", 13, "bold"), fg="#cba6f7", bg="#11111b")
        title_label.pack(pady=10)

        # กลุ่มแผงคุมเปิด/ปิดระบบตกปลา
        ctrl_frame = tk.LabelFrame(self.root, text=" 🕹️ คอนโทรลเลอร์ภายใน ", font=("Helvetica", 10, "bold"), fg="#fab387", bg="#11111b", bd=1)
        ctrl_frame.pack(fill=tk.X, padx=20, pady=5)

        self.btn_fish = tk.Button(ctrl_frame, text="🎣 [คำสั่ง] เริ่มตกปลา (พิมพ์ fish ออโต้)", command=self.send_fish_command, font=("Helvetica", 10, "bold"), fg="#11111b", bg="#a6e3a1", bd=0, padx=20, pady=8, cursor="hand2")
        self.btn_fish.pack(side=tk.LEFT, padx=15, pady=10)

        self.status_label = tk.Label(ctrl_frame, text="สถานะบอท: OFFLINE", font=("Helvetica", 10, "bold"), fg="#f38ba8", bg="#11111b")
        self.status_label.pack(side=tk.RIGHT, padx=20)

        # หน้าต่างประมวลผล Live Logs ฉบับกรองสารพิษ
        log_frame = tk.LabelFrame(self.root, text=" 📊 บันทึกรายงานหน้างานสายสะอาด (Clean Core Logs) ", font=("Helvetica", 10, "bold"), fg="#cdd6f4", bg="#11111b", bd=1)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        self.log_widget = scrolledtext.ScrolledText(log_frame, font=("Consolas", 10), fg="#a6e3a1", bg="#1e1e2e", wrap=tk.WORD)
        self.log_widget.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.log_widget.config(state="disabled")

    def write_log(self, text):
        # 🎯 [โล่ป้องกันระดับสูงสุด]: ดักจับคัดกรองข้อความขยะทั้งหมด ห้ามหลุดเด้งขึ้นหน้าจอ GUI เด็ดขาด!
        low_text = text.toLowerCase() if hasattr(text, 'toLowerCase') else text.lower()
        if (
            "chunk size" in low_text or 
            "partial packet" in low_text or 
            "world_particles" in low_text or 
            "particles" in low_text or
            "level_particles" in low_text
        ):
            return # ปัดทิ้ง ทำลายร่องรอย เงียบกริบ!

        self.log_widget.config(state="normal")
        self.log_widget.insert(tk.END, text)
        self.log_widget.see(tk.END)
        self.log_widget.config(state="disabled")

    def start_node_engine(self):
        t = threading.Thread(target=self.run_backend_process, daemon=True)
        t.start()

    def run_backend_process(self):
        file_name = "fish.js"
        if not os.path.exists(file_name):
            self.root.after(0, self.write_log, f"❌ หาไฟล์เบื้องหลัง {file_name} ไม่พบในโฟลเดอร์นี้!\n")
            return

        try:
            current_env = os.environ.copy()
            current_env["PYTHONIOENCODING"] = "utf-8"
            
            # บูตท่อ Popen ผูกขาดดึงข้อมูลเบื้องหลัง
            self.bot_process = subprocess.Popen(
                ["node", file_name], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env=current_env, text=True, bufsize=1, encoding="utf-8"
            )
            
            self.root.after(0, lambda: self.status_label.config(text="สถานะบอท: ONLINE", fg="#a6e3a1"))

            for line in iter(self.bot_process.stdout.readline, ''):
                if line:
                    if "BIT_DATA:" in line:
                        continue
                    self.root.after(0, self.write_log, line)

            self.bot_process.wait()
        except Exception as e:
            self.root.after(0, self.write_log, f"⚠️ [Error]: {str(e)}\n")
        finally:
            self.bot_process = None
            self.root.after(0, lambda: self.status_label.config(text="สถานะบอท: OFFLINE", fg="#f38ba8"))

    def send_fish_command(self):
        if self.bot_process and self.bot_process.poll() is None:
            try:
                self.bot_process.stdin.write("fish\n")
                self.bot_process.stdin.flush()
                self.root.after(0, self.write_log, "⚙️ [GUI Event]: ส่งมาโครคำสั่งพิมพ์ 'fish' ลงระบบเรียบร้อย...\n")
            except Exception as e:
                pass

    def kill_all_and_exit(self):
        if self.bot_process and self.bot_process.poll() is None:
            try:
                self.bot_process.terminate()
                self.bot_process.wait(timeout=1)
            except:
                try: self.bot_process.kill()
                except: pass
        self.root.destroy()
        sys.exit(0)

if __name__ == "__main__":
    root = tk.Tk()
    app = FishingControllerGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.kill_all_and_exit)
    root.mainloop()