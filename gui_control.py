import json
import os
import subprocess
import threading
import customtkinter as ctk

# 🎨 ตั้งค่าธีม Cyberpunk / Dark Mode
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# 📐 สูตรคำนวณวัตถุดิบที่ต้องใช้ต่อ 1 เครื่อง
REQUIRED_ITEMS = {
    'slime_block': {'req': 12, 'name_th': 'Slime Block', 'color': '#2ecc71'},
    'iron_bars': {'req': 6, 'name_th': 'Iron Bars', 'color': '#bdc3c7'},
    'observer': {'req': 4, 'name_th': 'Observer', 'color': '#e67e22'},
    'sticky_piston': {'req': 2, 'name_th': 'Sticky Piston', 'color': '#1abc9c'},
    'obsidian': {'req': 1, 'name_th': 'Obsidian', 'color': '#9b59b6'},
    'note_block': {'req': 1, 'name_th': 'Note Block', 'color': '#e74c3c'},
}


class CyberpunkBotControl(ctk.CTk):

  def __init__(self):
    super().__init__()

    self.title("⚡ AMORYCRAFT AUTOMATION GUI CONTROLLER ⚡")
    self.geometry("760x900")
    self.configure(fg_color="#0b0c10")

    self.process = None

    # ---------------- 🎯 1. HEADER TITLE & STATUS ----------------
    header = ctk.CTkFrame(self, fg_color="transparent")
    header.pack(fill="x", padx=20, pady=(15, 5))

    ctk.CTkLabel(
        header,
        text="⚡ BOT SLICE BUILDER CONTROLLER",
        font=ctk.CTkFont(family="Consolas", size=20, weight="bold"),
        text_color="#00f3ff",
    ).pack(side="left")

    self.status_pill = ctk.CTkLabel(
        header,
        text="🔴 DISCONNECTED",
        font=ctk.CTkFont(size=12, weight="bold"),
        fg_color="#341f27",
        text_color="#ff0055",
        corner_radius=8,
        padx=12,
        pady=4,
    )
    self.status_pill.pack(side="right")

    # ---------------- 🎯 2. INPUT CONTROL CARD ----------------
    input_card = ctk.CTkFrame(
        self,
        fg_color="#1f2833",
        corner_radius=12,
        border_width=1,
        border_color="#45a29e",
    )
    input_card.pack(fill="x", padx=20, pady=10)

    ctk.CTkLabel(
        input_card,
        text="📍 สั่งการสร้างโครงสร้าง (BUILD TARGET)",
        font=ctk.CTkFont(size=13, weight="bold"),
        text_color="#66fcf1",
    ).grid(row=0, column=0, columnspan=8, sticky="w", padx=15, pady=(10, 5))

    ctk.CTkLabel(
        input_card,
        text="X:",
        text_color="#00f3ff",
        font=ctk.CTkFont(weight="bold"),
    ).grid(row=1, column=0, padx=(15, 2), pady=10)
    self.ent_x = ctk.CTkEntry(
        input_card,
        width=75,
        fg_color="#0b0c10",
        border_color="#00f3ff",
        text_color="#ffffff",
    )
    self.ent_x.grid(row=1, column=1, padx=5, pady=10)

    ctk.CTkLabel(
        input_card,
        text="Y:",
        text_color="#00f3ff",
        font=ctk.CTkFont(weight="bold"),
    ).grid(row=1, column=2, padx=(10, 2), pady=10)
    self.ent_y = ctk.CTkEntry(
        input_card,
        width=75,
        fg_color="#0b0c10",
        border_color="#00f3ff",
        text_color="#ffffff",
    )
    self.ent_y.grid(row=1, column=3, padx=5, pady=10)

    ctk.CTkLabel(
        input_card,
        text="Z:",
        text_color="#00f3ff",
        font=ctk.CTkFont(weight="bold"),
    ).grid(row=1, column=4, padx=(10, 2), pady=10)
    self.ent_z = ctk.CTkEntry(
        input_card,
        width=75,
        fg_color="#0b0c10",
        border_color="#00f3ff",
        text_color="#ffffff",
    )
    self.ent_z.grid(row=1, column=5, padx=5, pady=10)

    ctk.CTkLabel(
        input_card,
        text="จำนวนรอบ:",
        text_color="#ff007f",
        font=ctk.CTkFont(weight="bold"),
    ).grid(row=1, column=6, padx=(10, 2), pady=10)
    self.ent_loops = ctk.CTkEntry(
        input_card,
        width=65,
        fg_color="#0b0c10",
        border_color="#ff007f",
        text_color="#ffffff",
    )
    self.ent_loops.insert(0, "1")
    self.ent_loops.grid(row=1, column=7, padx=(5, 15), pady=10)

    # ---------------- 🎯 3. ACTION BUTTONS ----------------
    btn_frame = ctk.CTkFrame(self, fg_color="transparent")
    btn_frame.pack(fill="x", padx=20, pady=5)

    self.btn_build = ctk.CTkButton(
        btn_frame,
        text="🚀 เริ่มสร้าง (BUILD)",
        font=ctk.CTkFont(size=14, weight="bold"),
        fg_color="#45a29e",
        hover_color="#66fcf1",
        text_color="#0b0c10",
        height=40,
        corner_radius=8,
        command=self.send_build,
    )
    self.btn_build.pack(side="left", expand=True, fill="x", padx=(0, 5))

    self.btn_tpa = ctk.CTkButton(
        btn_frame,
        text="📡 ส่ง TPA",
        font=ctk.CTkFont(size=14, weight="bold"),
        fg_color="#0984e3",
        hover_color="#74b9ff",
        height=40,
        corner_radius=8,
        command=self.send_tpa,
    )
    self.btn_tpa.pack(side="left", expand=True, fill="x", padx=5)

    self.btn_stop = ctk.CTkButton(
        btn_frame,
        text="🛑 หยุดทำงาน (C)",
        font=ctk.CTkFont(size=14, weight="bold"),
        fg_color="#d63031",
        hover_color="#ff7675",
        height=40,
        corner_radius=8,
        command=self.send_cancel,
    )
    self.btn_stop.pack(side="left", expand=True, fill="x", padx=(5, 0))

    # ---------------- 🎯 4. INVENTORY & CAPACITY MATRIX ----------------
    inv_card = ctk.CTkFrame(
        self,
        fg_color="#1f2833",
        corner_radius=12,
        border_width=1,
        border_color="#45a29e",
    )
    inv_card.pack(fill="x", padx=20, pady=10)

    ctk.CTkLabel(
        inv_card,
        text="📦 เสบียงวัตถุดิบในกระเป๋าบอท (LIVE REAL-TIME)",
        font=ctk.CTkFont(size=13, weight="bold"),
        text_color="#66fcf1",
    ).pack(anchor="w", padx=15, pady=(10, 5))

    # สรุปภาพรวม
    self.summary_box = ctk.CTkFrame(
        inv_card,
        fg_color="#0b0c10",
        corner_radius=8,
        border_width=1,
        border_color="#ff0055",
    )
    self.summary_box.pack(fill="x", padx=15, pady=5)

    self.lbl_capacity = ctk.CTkLabel(
        self.summary_box,
        text="⏳ กำลังรอเชื่อมต่อข้อมูลกระเป๋าจากบอท...",
        font=ctk.CTkFont(size=15, weight="bold"),
        text_color="#ff0055",
        pady=8,
    )
    self.lbl_capacity.pack()

    # การ์ดแต่ละไอเทม
    items_grid = ctk.CTkFrame(inv_card, fg_color="transparent")
    items_grid.pack(fill="x", padx=10, pady=10)

    self.item_cards = {}
    self.item_val_lbls = {}
    self.item_mach_lbls = {}

    col_idx = 0
    row_idx = 0

    for key, info in REQUIRED_ITEMS.items():
      card = ctk.CTkFrame(
          items_grid,
          fg_color="#0b0c10",
          corner_radius=8,
          border_width=1,
          border_color="#ff0055",
      )
      card.grid(row=row_idx, column=col_idx, padx=5, pady=5, sticky="nsew")
      items_grid.columnconfigure(col_idx, weight=1)

      ctk.CTkLabel(
          card,
          text=f"{info['name_th']} (ใช้ {info['req']})",
          font=ctk.CTkFont(size=11, weight="bold"),
          text_color=info['color'],
      ).pack(anchor="w", padx=10, pady=(6, 2))

      lbl_val = ctk.CTkLabel(
          card,
          text="0 ชิ้น",
          font=ctk.CTkFont(size=16, weight="bold"),
          text_color="#ffffff",
      )
      lbl_val.pack(anchor="w", padx=10, pady=0)

      lbl_mach = ctk.CTkLabel(
          card,
          text="สร้างได้ 0 เครื่อง",
          font=ctk.CTkFont(size=10),
          text_color="#8f93a2",
      )
      lbl_mach.pack(anchor="w", padx=10, pady=(0, 6))

      self.item_cards[key] = card
      self.item_val_lbls[key] = lbl_val
      self.item_mach_lbls[key] = lbl_mach

      col_idx += 1
      if col_idx > 2:
        col_idx = 0
        row_idx += 1

    # ---------------- 🎯 5. TERMINAL LOGS ----------------
    log_card = ctk.CTkFrame(
        self,
        fg_color="#1f2833",
        corner_radius=12,
        border_width=1,
        border_color="#45a29e",
    )
    log_card.pack(fill="both", expand=True, padx=20, pady=(5, 15))

    ctk.CTkLabel(
        log_card,
        text="💻 TERMINAL CONSOLE LOGS",
        font=ctk.CTkFont(size=12, weight="bold"),
        text_color="#66fcf1",
    ).pack(anchor="w", padx=15, pady=(8, 2))

    self.txt_log = ctk.CTkTextbox(
        log_card,
        fg_color="#0b0c10",
        text_color="#66fcf1",
        font=ctk.CTkFont(family="Consolas", size=11),
        border_width=1,
        border_color="#1f2833",
    )
    self.txt_log.pack(fill="both", expand=True, padx=10, pady=(0, 10))

    self.start_node_process()

  def append_log(self, text):
    self.txt_log.insert("end", text + "\n")
    self.txt_log.see("end")

  def send_command(self, cmd):
    if self.process and self.process.poll() is None:
      self.process.stdin.write(f"{cmd}\n")
      self.process.stdin.flush()
      self.append_log(f"❯ [GUI SENT]: {cmd}")

  def send_build(self):
    x = self.ent_x.get().strip()
    y = self.ent_y.get().strip()
    z = self.ent_z.get().strip()
    loops = self.ent_loops.get().strip()
    if x and y and z:
      self.send_command(f"build {x} {y} {z} {loops}")

  def send_tpa(self):
    self.send_command("tpa")

  def send_cancel(self):
    self.send_command("c")

  # 📊 อัปเดตข้อมูลตัวเลขและการ์ดสรุปผล
  def update_inventory_ui(self, items_dict):
    min_machines = float("inf")

    for key, info in REQUIRED_ITEMS.items():
      count = items_dict.get(key, 0)
      req = info["req"]
      possible = count // req

      if possible < min_machines:
        min_machines = possible

      # อัปเดตข้อความใน UI
      self.item_val_lbls[key].configure(text=f"{count} ชิ้น")
      self.item_mach_lbls[key].configure(text=f"สร้างได้ {possible} เครื่อง")

      if possible >= 1:
        self.item_cards[key].configure(border_color="#2ecc71")
      else:
        self.item_cards[key].configure(border_color="#ff0055")

    if min_machines == float("inf"):
      min_machines = 0

    # อัปเดตการ์ดสรุปด้านบน
    if min_machines >= 1:
      self.summary_box.configure(border_color="#2ecc71")
      self.lbl_capacity.configure(
          text=f"⚡ เสบียงในตัวพร้อมสร้างได้สูงสุด: {min_machines} เครื่อง!",
          text_color="#2ecc71",
      )
    else:
      self.summary_box.configure(border_color="#ff0055")
      self.lbl_capacity.configure(
          text="⚠️ วัตถุดิบในตัวไม่พอสำหรับสร้าง 1 เครื่อง!",
          text_color="#ff0055",
      )

  def read_node_output(self):
    while self.process and self.process.poll() is None:
      line = self.process.stdout.readline()
      if line:
        cleaned = line.strip()

        # 🔥 [🎯 ROBUST DIRECT JSON PARSER]: ถอดรหัส JSON โดยตรงไม่พึ่ง Regex
        if cleaned.startswith('{') and '"INV_UPDATE"' in cleaned:
          try:
            # ค้นหาตำแหน่งเริ่มต้น { และสิ้นสุด } ของก้อน JSON แท้จริง
            start_idx = cleaned.find('{')
            end_idx = cleaned.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
              json_str = cleaned[start_idx : end_idx + 1]
              data = json.loads(json_str)
              if "items" in data:
                self.after(0, self.update_inventory_ui, data["items"])
                continue  # อ่านสำเร็จ -> ข้ามไม่พิมพ์บรรทัด JSON ลง Terminal Log ให้รก
          except Exception:
            pass

        # 🟢 ดักจับบอทออนไลน์
        if "ออนไลน์สำเร็จ" in cleaned:
          self.after(
              0,
              lambda: self.status_pill.configure(
                  text="🟢 ONLINE", fg_color="#1b382b", text_color="#2ecc71"
              ),
          )

        self.after(0, self.append_log, cleaned)

  def start_node_process(self):
    script_path = os.path.join(os.path.dirname(__file__), "schem_builder.js")

    if not os.path.exists(script_path):
      js_files = [
          f
          for f in os.listdir(os.path.dirname(__file__))
          if f.endswith(".js") and f != "login.js"
      ]
      if js_files:
        script_path = os.path.join(os.path.dirname(__file__), js_files[0])

    try:
      self.process = subprocess.Popen(
          ["node", script_path],
          stdin=subprocess.PIPE,
          stdout=subprocess.PIPE,
          stderr=subprocess.STDOUT,
          text=True,
          encoding="utf-8",
          errors="replace",
          bufsize=1,
      )
      t = threading.Thread(target=self.read_node_output, daemon=True)
      t.start()
    except Exception as e:
      self.append_log(f"❌ ไม่สามารถเปิด Node.js ได้: {e}")


if __name__ == "__main__":
  app = CyberpunkBotControl()
  app.mainloop()