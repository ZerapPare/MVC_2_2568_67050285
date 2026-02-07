# ศูนย์จัดการอพยพ - MVC Application

ระบบการจัดการการอพยพประชาชนไปยังศูนย์พักพิง พัฒนาด้วย MVC Design Pattern

## การใช้งาน

### 1. เปิดหน้าแรก
```
file:///path/to/views/index.html
```

### 2. Import CSV
- ไปหน้า Index
- เลือก CSV type
- อัปโหลดไฟล์ CSV
- กด "Import"

### 3. เพิ่มข้อมูล
- ไปหน้า Citizens หรือ Shelters
- กรอกข้อมูล
- กด "บันทึก"

### 4. จัดสรรที่พัก
- หลังเพิ่มประชาชนแล้ว ไปหน้า Report
- จะเห็นประชาชนที่ยังไม่ได้ที่พัก

### 5. ดาวน์โหลด CSV
- ไปหน้า Index
- กด "Export [filename].csv"
