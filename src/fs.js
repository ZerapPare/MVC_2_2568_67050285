// fs.js - File System Access API helper (Chrome/Edge)

const FS_KEY = "evac_mvc_fs_handles_v1";

const FileStore = {
  handles: {
    citizens: null,
    shelters: null,
    assignments: null
  },

  async pickFile(kind){
    // kind = citizens ,shelters ,assignments
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "CSV",
        accept: { "text/csv": [".csv"] }
      }]
    });
    this.handles[kind] = handle;
    await this._persistHandles();
    return handle;
  },

  async loadFromFile(kind){
    const h = this.handles[kind];
    if (!h) return { ok:false, msg:`ยังไม่ได้เลือกไฟล์ ${kind}.csv` };

    const file = await h.getFile();
    const text = await file.text();
    return { ok:true, text };
  },

  async saveToFile(kind, csvText){
    const h = this.handles[kind];
    if (!h) return { ok:false, msg:`ยังไม่ได้เลือกไฟล์ ${kind}.csv` };

    const writable = await h.createWritable();
    await writable.write(csvText);
    await writable.close();
    return { ok:true };
  },

  async _persistHandles(){
    // FileSystemHandle เซฟลง IndexedDB ผ่าน structured clone ได้ใน Chromium
    // เก็บไว้ใน localStorage ไม่ได้ -> ใช้ indexedDB แบบง่าย
    await idbSet(FS_KEY, this.handles);
  },

  async restoreHandles(){
    const saved = await idbGet(FS_KEY);
    if (saved){
      this.handles = saved;
    }
  }
};

// ------- tiny IndexedDB helpers -------
const IDB_DB = "evac_fs_db";
const IDB_STORE = "kv";

function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

window.EVAC_FS = { FileStore };
