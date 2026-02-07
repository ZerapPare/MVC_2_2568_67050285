/* ========= CSV Utils ========= */
function csvEscape(value){
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll(`"`, `""`)}"`;
  return s;
}

function toCSV(rows, headers){
  const lines = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows){
    lines.push(headers.map(h => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

// Basic CSV parser (supports quotes)
function parseCSV(text){
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i=0; i<text.length; i++){
    const c = text[i];
    const next = text[i+1];

    if (inQuotes){
      if (c === `"` && next === `"`){ field += `"`; i++; }
      else if (c === `"`) inQuotes = false;
      else field += c;
    } else {
      if (c === `"`) inQuotes = true;
      else if (c === ","){ row.push(field); field = ""; }
      else if (c === "\n"){
        row.push(field); field = "";
        rows.push(row); row = [];
      } else if (c === "\r") {
        // ignore
      } else field += c;
    }
  }
  // last field
  if (field.length > 0 || row.length > 0){
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0].map(h => h.trim());
  const data = rows.slice(1)
    .filter(r => r.some(cell => String(cell).trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim());
      return obj;
    });

  return { headers, data };
}

function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function fileToText(file){
  return await file.text();
}

/* ========= Model ========= */
const STORAGE_KEY = "evac_mvc_db_v1";

const DB = {
  citizens: [],
  shelters: [],
  assignments: []
};

const SCHEMA = {
  citizens: ["citizenId","name","age","healthStatus","registerDate","citizenType"],
  shelters: ["shelterId","name","capacity","riskLevel"],
  assignments: ["citizenId","shelterId","checkInDate"]
};

function seedIfEmpty(){
  if (DB.citizens.length || DB.shelters.length || DB.assignments.length) return;

  // NOTE: seed ข้อมูลตัวอย่าง
  DB.shelters = [
    { shelterId:"S001", name:"ศูนย์กีฬาเขต 1", capacity:"6", riskLevel:"Low" },
    { shelterId:"S002", name:"โรงเรียนเทศบาล 2", capacity:"5", riskLevel:"Medium" },
    { shelterId:"S003", name:"วัดกลาง", capacity:"7", riskLevel:"Low" },
    { shelterId:"S004", name:"ศูนย์การศึกษาจังหวัร", capacity:"5", riskLevel:"Low" },
    { shelterId:"S005", name:"โรงแรมพักอาศัย", capacity:"8", riskLevel:"Medium" }
  ];

  DB.citizens = [
    { citizenId:"C001", name:"Aom",  age:"19", healthStatus:"Healthy", registerDate: todayISO(), citizenType:"ทั่วไป" },
    { citizenId:"C002", name:"Boss", age:"70", healthStatus:"Chronic", registerDate: todayISO(), citizenType:"กลุ่มเสี่ยง" },
    { citizenId:"C003", name:"Chet", age:"28", healthStatus:"Injured", registerDate: todayISO(), citizenType:"VIP" }
  ];

  DB.assignments = [
    { citizenId:"C002", shelterId:"S001", checkInDate: todayISO() }
  ];
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function saveDB(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

function loadDB(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){
    seedIfEmpty();
    saveDB();
    return;
  }
  try{
    const parsed = JSON.parse(raw);
    DB.citizens = Array.isArray(parsed.citizens) ? parsed.citizens : [];
    DB.shelters = Array.isArray(parsed.shelters) ? parsed.shelters : [];
    DB.assignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];
  } catch {
    seedIfEmpty();
    saveDB();
  }
}

function getAssignedShelterId(citizenId){
  const a = DB.assignments.find(x => x.citizenId === citizenId);
  return a ? a.shelterId : "";
}

function getShelterOccupancy(shelterId){
  return DB.assignments.filter(a => a.shelterId === shelterId).length;
}

function findShelter(shelterId){
  return DB.shelters.find(s => s.shelterId === shelterId);
}

function normalizeUniqueId(list, key, id){
  const exists = list.some(x => x[key] === id);
  return !exists;
}

/* ========= Controller ========= */
const Controller = {
  init(){
    loadDB();
  },

  // Citizens
  addCitizen(payload){
    const citizenId = String(payload.citizenId ?? "").trim();
    if (!citizenId) return { ok:false, msg:"ต้องมี citizenId" };
    if (!normalizeUniqueId(DB.citizens, "citizenId", citizenId)) return { ok:false, msg:"citizenId ซ้ำแล้ว" };

    DB.citizens.push({
      citizenId,
      name: String(payload.name ?? "").trim(),
      age: String(payload.age ?? "").trim(),
      healthStatus: String(payload.healthStatus ?? "").trim(),
      registerDate: String(payload.registerDate ?? "").trim() || todayISO(),
      citizenType: String(payload.citizenType ?? "").trim()
    });

    saveDB();
    return { ok:true };
  },

  // Delete citizen
  deleteCitizen(citizenId){
    citizenId = String(citizenId ?? "").trim();
    if (!citizenId) return { ok:false, msg:"ต้องมี citizenId" };
    
    const idx = DB.citizens.findIndex(c => c.citizenId === citizenId);
    if (idx < 0) return { ok:false, msg:"ไม่พบประชาชนนี้" };
    
    DB.citizens.splice(idx, 1);
    // ลบ assignment ถ้ามี
    DB.assignments = DB.assignments.filter(a => a.citizenId !== citizenId);
    
    saveDB();
    return { ok:true };
  },

  // Shelters
  addShelter(payload){
    const shelterId = String(payload.shelterId ?? "").trim();
    if (!shelterId) return { ok:false, msg:"ต้องมี shelterId" };
    if (!normalizeUniqueId(DB.shelters, "shelterId", shelterId)) return { ok:false, msg:"shelterId ซ้ำแล้ว" };

    DB.shelters.push({
      shelterId,
      name: String(payload.name ?? "").trim(),
      capacity: String(payload.capacity ?? "").trim(),
      riskLevel: String(payload.riskLevel ?? "").trim()
    });

    saveDB();
    return { ok:true };
  },

  // Delete shelter
  deleteShelter(shelterId){
    shelterId = String(shelterId ?? "").trim();
    if (!shelterId) return { ok:false, msg:"ต้องมี shelterId" };
    
    const idx = DB.shelters.findIndex(s => s.shelterId === shelterId);
    if (idx < 0) return { ok:false, msg:"ไม่พบศูนย์พักพิงนี้" };
    
    // ลบ assignment ของศูนย์นี้ทั้งหมด
    DB.assignments = DB.assignments.filter(a => a.shelterId !== shelterId);
    DB.shelters.splice(idx, 1);
    
    saveDB();
    return { ok:true };
  },

  // Assignments (Business Rules enforced)
  assignCitizen({ citizenId, shelterId, checkInDate }) {
    citizenId = String(citizenId ?? "").trim();
    shelterId = String(shelterId ?? "").trim();
    checkInDate = String(checkInDate ?? "").trim() || todayISO();

    // Rule: citizen ต้องมีจริง
    const citizen = DB.citizens.find(c => c.citizenId === citizenId);
    if (!citizen) return { ok:false, msg:"ไม่พบ citizenId นี้ในระบบ" };

    const shelter = DB.shelters.find(s => s.shelterId === shelterId);
    if (!shelter) return { ok:false, msg:"ไม่พบ shelterId นี้ในระบบ" };

    // Rule: ศูนย์เต็มแล้วห้ามรับเพิ่ม
    const capacity = Number(shelter.capacity || 0);
    const occupancy = DB.assignments.filter(a => a.shelterId === shelterId).length;
    if (occupancy >= capacity) return { ok:false, msg:"ศูนย์พักพิงนี้เต็มแล้ว" };

    // Rule: สุขภาพเสี่ยง ต้องไป Low
    const riskyHealth = ["Chronic", "Injured", "Disabled"];
    if (riskyHealth.includes(String(citizen.healthStatus || ""))){
      if (String(shelter.riskLevel || "") !== "Low"){
        return { ok:false, msg:"ผู้มีความเสี่ยงด้านสุขภาพ ต้องไปศูนย์ความเสี่ยงต่ำ (Low) เท่านั้น" };
      }
    }

    // Rule: เด็ก/ผู้สูงอายุ ได้ก่อน (enforce แบบสงวนสิทธิ์ตอนใกล้เต็ม)
    const age = Number(citizen.age);
    const isPriority = (age < 12) || (age >= 60) || (citizen.citizenType === "กลุ่มเสี่ยง");
    if (!isPriority && (capacity - occupancy) <= 1){
      return { ok:false, msg:"ที่พักใกล้เต็ม สงวนสิทธิ์ให้เด็ก/ผู้สูงอายุก่อน" };
    }

    // Rule: citizen 1 คน มี assignment เดียว (ย้ายได้)
    const existing = DB.assignments.find(a => a.citizenId === citizenId);
    if (existing){
      existing.shelterId = shelterId;
      existing.checkInDate = checkInDate;
    } else {
      DB.assignments.push({ citizenId, shelterId, checkInDate });
    }

    saveDB();
    return { ok:true };
  },

  unassignCitizen(citizenId){
    citizenId = String(citizenId ?? "").trim();
    DB.assignments = DB.assignments.filter(a => a.citizenId !== citizenId);
    saveDB();
  },

  // CSV Import/Export
  importCSV(kind, csvText){
    const { headers, data } = parseCSV(csvText);
    const expected = SCHEMA[kind];

    const hasAll = expected.every(h => headers.includes(h));
    if (!hasAll){
      return { ok:false, msg:`หัวตารางไม่ตรง (${kind}) ต้องมี: ${expected.join(",")}` };
    }

    DB[kind] = data.map(row => {
      const obj = {};
      expected.forEach(h => obj[h] = (row[h] ?? "").trim());
      return obj;
    });

    saveDB();
    return { ok:true };
  },

  exportCSV(kind){
    return toCSV(DB[kind], SCHEMA[kind]);
  },

  resetAll(){
    DB.citizens = [];
    DB.shelters = [];
    DB.assignments = [];
    seedIfEmpty();
    saveDB();
  }
};

/* ========= View Helpers ========= */
function $(sel){ return document.querySelector(sel); }

function setActiveNav(){
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === path);
  });
}

function toast(msg, type=""){
  const el = $("#toast");
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.className = "badge " + (type || "");
  el.style.display = "inline-flex";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ el.style.display="none"; }, 2600);
}

window.EVAC = {
  DB, Controller, SCHEMA,
  todayISO, getAssignedShelterId, getShelterOccupancy, findShelter,
  toast, setActiveNav, $, fileToText, downloadText
};

// ป้องกัน EVAC not defined ในบางโหมด
const EVAC = window.EVAC;

/* ========= Auto Save to CSV (optional) ========= */
EVAC.autoSaveEnabled = true;

EVAC.autoSaveAll = async function(){
  if (!window.EVAC_FS) return;
  if (!EVAC.autoSaveEnabled) return;

  const kinds = ["citizens","shelters","assignments"];
  for (const kind of kinds){
    const csv = EVAC.Controller.exportCSV(kind);
    if (EVAC_FS.FileStore?.handles?.[kind]){
      try{
        await EVAC_FS.FileStore.saveToFile(kind, csv);
      } catch {
        // หากบันทึกไม่สำเร็จ จะไม่แสดงข้อความแจ้งเตือน
      }
    }
  }
};

// hook: หลัง saveDB() ให้ autoSaveAll()
const __oldSaveDB = saveDB;
saveDB = function(){
  __oldSaveDB();
  // เรียกใช้ใน background
  EVAC.autoSaveAll();
};
