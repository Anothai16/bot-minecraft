import tkinter as tk
from tkinter import messagebox, scrolledtext
import subprocess
import threading
import os
import sys

# ตัวแปรโปรเซส Node.js
bot_process = None

def run_node_bot():
    global bot_process
    js_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scaffording.js")
    
    if not os.path.exists(js_file):
        append_gui_log(f"❌ ไม่พบไฟล์ {js_file}")
        return

    try:
        # บังคับ Environment ให้เป็น UTF-8 ทั้งฝั่ง Python และ Node.js
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["NODE_OPTIONS"] = "--enable-source-maps"

        # เปิดรัน node scaffording.js พร้อมถอดรหัส utf-8 แบบกัน Error
        bot_process = subprocess.Popen(
            ["node", js_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=env
        )

        lbl_bot_status.config(text="● RUNNING", fg="#34d399")
        
        # ลูปอ่าน Log ออกมาแสดงผล
        for line in iter(bot_process.stdout.readline, ''):
            if line:
                append_gui_log(line.strip())
                
        bot_process.stdout.close()
        bot_process.wait()
    except Exception as e:
        append_gui_log(f"❌ ไม่สามารถเปิด Node.js ได้: {str(e)}")
    finally:
        bot_process = None  # รีเซ็ตตัวแปรให้สามารถกด Start ใหม่ได้
        lbl_bot_status.config(text="○ STOPPED", fg="#f87171")

def send_command(cmd_text):
    global bot_process
    if bot_process and bot_process.stdin and bot_process.poll() is None:
        try:
            bot_process.stdin.write(cmd_text + "\n")
            bot_process.stdin.flush()
        except Exception as e:
            append_gui_log(f"❌ ส่งคำสั่งล้มเหลว: {str(e)}")
    else:
        append_gui_log("❌ บอทไม่ได้กำลังทำงาน กรุณากด Start Bot ก่อน")

def on_start_bot_click():
    global bot_process
    if bot_process is None or bot_process.poll() is not None:
        threading.Thread(target=run_node_bot, daemon=True).start()
    else:
        append_gui_log("⚠️ บอทกำลังทำงานอยู่แล้ว")

def on_tpa_click():
    send_command("tpa")

def on_build_click():
    try:
        x = int(entry_x.get())
        y = int(entry_y.get())
        z = int(entry_z.get())
        end_x = int(entry_end_x.get())
    except ValueError:
        messagebox.showerror("Error", "กรุณากรอกพิกัดเป็นตัวเลขจำนวนเต็ม")
        return

    cmd = f"build {x} {y} {z} {end_x}"
    send_command(cmd)

def on_stop_click():
    send_command("stop")

def append_gui_log(text):
    log_box.config(state="normal")
    log_box.insert(tk.END, text + "\n")
    log_box.see(tk.END)
    log_box.config(state="disabled")

def on_closing():
    global bot_process
    if bot_process and bot_process.poll() is None:
        bot_process.terminate()
    root.destroy()
    sys.exit(0)

# --- หน้าต่าง GUI Theme Dark ---
root = tk.Tk()
root.title("Minecraft Scaffolding Controller")
root.geometry("540x630")
root.configure(bg="#0b0f19")
root.resizable(False, False)
root.protocol("WM_DELETE_WINDOW", on_closing)

# Top Bar
top_frame = tk.Frame(root, bg="#0b0f19")
top_frame.pack(fill="x", padx=20, pady=(15, 5))

title_label = tk.Label(top_frame, text="SCAFFOLD CONTROLLER", font=("Segoe UI", 15, "bold"), fg="#10b981", bg="#0b0f19")
title_label.pack(side="left")

lbl_bot_status = tk.Label(top_frame, text="○ STOPPED", font=("Consolas", 10, "bold"), fg="#f87171", bg="#0b0f19")
lbl_bot_status.pack(side="right")

# Main Control Buttons Frame
btn_frame = tk.Frame(root, bg="#0b0f19")
btn_frame.pack(fill="x", padx=20, pady=5)

btn_start_bot = tk.Button(btn_frame, text="🟢 Start Node Bot", font=("Segoe UI", 9, "bold"),
                          bg="#059669", fg="#ffffff", relief="flat", cursor="hand2", pady=6, command=on_start_bot_click)
btn_start_bot.pack(side="left", expand=True, fill="x", padx=(0, 4))

btn_tpa = tk.Button(btn_frame, text="⚡ TPA to JaiyenKub", font=("Segoe UI", 9, "bold"),
                    bg="#2563eb", fg="#ffffff", relief="flat", cursor="hand2", pady=6, command=on_tpa_click)
btn_tpa.pack(side="right", expand=True, fill="x", padx=(4, 0))

# Coordinate Input Frame
frame_coords = tk.LabelFrame(root, text=" Build Coordinates ", font=("Segoe UI", 9, "bold"),
                             fg="#cbd5e1", bg="#131b2e", padx=12, pady=8, relief="groove")
frame_coords.pack(fill="x", padx=20, pady=5)

def create_input_row(parent, label_text, default_val):
    row = tk.Frame(parent, bg="#131b2e")
    row.pack(fill="x", pady=2)
    lbl = tk.Label(row, text=label_text, width=8, anchor="w", fg="#94a3b8", bg="#131b2e", font=("Segoe UI", 9))
    lbl.pack(side="left")
    ent = tk.Entry(row, bg="#0b0f19", fg="#ffffff", insertbackground="#ffffff", relief="flat", font=("Consolas", 10))
    ent.insert(0, default_val)
    ent.pack(side="right", expand=True, fill="x", ipady=2)
    return ent

entry_x = create_input_row(frame_coords, "Start X:", "10422")
entry_y = create_input_row(frame_coords, "Start Y:", "211")
entry_z = create_input_row(frame_coords, "Start Z:", "-5074")
entry_end_x = create_input_row(frame_coords, "End X:", "10341")

# Action Buttons
frame_actions = tk.Frame(root, bg="#0b0f19")
frame_actions.pack(fill="x", padx=20, pady=6)

btn_build = tk.Button(frame_actions, text="🚀 Start Build", font=("Segoe UI", 10, "bold"),
                      bg="#10b981", fg="#064e3b", relief="flat", cursor="hand2", pady=5, command=on_build_click)
btn_build.pack(side="left", expand=True, fill="x", padx=(0, 4))

btn_stop = tk.Button(frame_actions, text="🛑 Stop Build", font=("Segoe UI", 10, "bold"),
                     bg="#ef4444", fg="#ffffff", relief="flat", cursor="hand2", pady=5, command=on_stop_click)
btn_stop.pack(side="right", expand=True, fill="x", padx=(4, 0))

# Live Console Frame
frame_log = tk.LabelFrame(root, text=" Live Bot Output ", font=("Segoe UI", 9, "bold"),
                          fg="#cbd5e1", bg="#0b0f19", padx=8, pady=6, relief="groove")
frame_log.pack(fill="both", expand=True, padx=20, pady=(5, 12))

log_box = scrolledtext.ScrolledText(frame_log, bg="#050811", fg="#38bdf8", insertbackground="#ffffff",
                                   font=("Consolas", 9), relief="flat", wrap="word", state="disabled")
log_box.pack(fill="both", expand=True)

# เริ่มต้นเปิดบอทอัตโนมัติทันทีที่รัน GUI
threading.Thread(target=run_node_bot, daemon=True).start()

root.mainloop()