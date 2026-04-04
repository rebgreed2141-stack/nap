const STEP_MIN = 5;
const DAY_TIMES = buildAllTimes();
const RANGE_DEFS = [
  { id: "am", label: "9:00〜11:55", startHour: 9, endHour: 11 },
  { id: "pm", label: "12:00〜15:55", startHour: 12, endHour: 15 }
];

const tabRecord = document.getElementById("tabRecord");
const tabCalendar = document.getElementById("tabCalendar");
const tabManage = document.getElementById("tabManage");

const paneRecord = document.getElementById("paneRecord");
const paneCalendar = document.getElementById("paneCalendar");
const paneManage = document.getElementById("paneManage");

const rangeRadios = document.getElementById("rangeRadios");
const viewStatus = document.getElementById("viewStatus");
const viewBody = document.getElementById("viewBody");

const calendarStatus = document.getElementById("calendarStatus");
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");
const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");

const manageStatus = document.getElementById("manageStatus");
const yearSelect = document.getElementById("yearSelect");
const btnBackup = document.getElementById("btnBackup");
const btnRestore = document.getElementById("btnRestore");
const btnDeleteYear = document.getElementById("btnDeleteYear");
const restoreZipInput = document.getElementById("restoreZipInput");

let currentPane = "record";
let selectedYMD = ymdToday();
let selectedRangeId = defaultRangeIdForNow();
let currentChildren = [];
const invalidSelections = new Map();

const selectedDateObj = ymdToDate(selectedYMD);
let calendarYear = selectedDateObj.getFullYear();
let calendarMonth = selectedDateObj.getMonth();

init();

async function init(){
  try{
    currentChildren = await loadChildrenJson();
    renderRangeRadios();
    updateRecordTabLabel();
    renderYearSelect();
    renderRecord();
    renderCalendar();
    renderManageStatus();
  }catch(err){
    console.error(err);
    alert("child.json の読み込みに失敗しました。");
  }
}

async function loadChildrenJson(){
  const res = await fetch("./child.json", { cache:"no-store" });
  if(!res.ok) throw new Error("child.json fetch failed");
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

function buildAllTimes(){
  const out = [];
  for(let hour = 9; hour <= 15; hour++){
    for(let min = 0; min < 60; min += STEP_MIN){
      out.push(`${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }
  return out;
}

function ymdToday(){
  return dateToYmd(new Date());
}

function dateToYmd(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToDate(ymd){
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function ymdToLabelNoYear(ymd){
  const d = ymdToDate(ymd);
  return `${d.getMonth() + 1}月${d.getDate()}日の記録`;
}

function hhmmToMin(hhmm){
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function defaultRangeIdForNow(){
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 12 * 60 ? "pm" : "am";
}

function getRangeDef(rangeId){
  return RANGE_DEFS.find(r => r.id === rangeId) || RANGE_DEFS[0];
}

function getRangeTimes(rangeId){
  const range = getRangeDef(rangeId);
  return DAY_TIMES.filter(time => {
    const hour = Number(time.split(":")[0]);
    return hour >= range.startHour && hour <= range.endHour;
  });
}

function getRangeHours(rangeId){
  const range = getRangeDef(rangeId);
  const hours = [];
  for(let h = range.startHour; h <= range.endHour; h++){
    hours.push(h);
  }
  return hours;
}

function storeKey(ymd){
  return `nap_${ymd}`;
}

function createEmptyDayData(){
  return { children:{} };
}

function normalizeDayData(source){
  const out = createEmptyDayData();
  const srcChildren = source && source.children && typeof source.children === "object" ? source.children : {};

  for(const [childId, childObj] of Object.entries(srcChildren)){
    const name = childObj && typeof childObj.name === "string" ? childObj.name : "";
    const recordsSrc = childObj && childObj.records && typeof childObj.records === "object" ? childObj.records : {};
    const records = {};
    for(const [time, value] of Object.entries(recordsSrc)){
      if(DAY_TIMES.includes(time) && (value === "u" || value === "d")){
        records[time] = value;
      }
    }
    out.children[childId] = { name, records };
  }

  return out;
}

function loadDayData(ymd){
  try{
    const raw = localStorage.getItem(storeKey(ymd));
    const parsed = raw ? JSON.parse(raw) : createEmptyDayData();
    return normalizeDayData(parsed);
  }catch{
    return createEmptyDayData();
  }
}

function saveDayData(ymd, dayData){
  localStorage.setItem(storeKey(ymd), JSON.stringify(normalizeDayData(dayData)));
}

function removeDayData(ymd){
  localStorage.removeItem(storeKey(ymd));
}

function ensureChildExistsInDay(dayData, childId, childName){
  if(!dayData.children[childId]){
    dayData.children[childId] = { name: childName || "", records:{} };
  }
  if(childName){
    dayData.children[childId].name = childName;
  }
}

function getStoredValue(ymd, childId, time){
  const dayData = loadDayData(ymd);
  return dayData.children[childId] && dayData.children[childId].records[time]
    ? dayData.children[childId].records[time]
    : "";
}

function setStoredValue(ymd, childId, childName, time, value){
  const dayData = loadDayData(ymd);
  ensureChildExistsInDay(dayData, childId, childName);

  if(value === "u" || value === "d"){
    dayData.children[childId].records[time] = value;
  }else{
    delete dayData.children[childId].records[time];
  }

  saveDayData(ymd, dayData);
}

function childCountWithRecord(ymd){
  const dayData = loadDayData(ymd);
  return Object.values(dayData.children).filter(obj => Object.keys(obj.records || {}).length > 0).length;
}

function firstSleepTime(ymd, childId){
  const dayData = loadDayData(ymd);
  const child = dayData.children[childId];
  if(!child) return "";
  const times = Object.keys(child.records || {}).sort((a, b) => hhmmToMin(a) - hhmmToMin(b));
  return times.length ? times[0] : "";
}

function getInvalidKey(childId, time){
  return `${selectedYMD}__${childId}__${time}`;
}

function getEffectiveState(childId, time){
  const invalid = invalidSelections.get(getInvalidKey(childId, time));
  if(invalid){
    return { supine:true, prone:true, invalid:true };
  }

  const stored = getStoredValue(selectedYMD, childId, time);
  return {
    supine: stored === "u",
    prone: stored === "d",
    invalid: false
  };
}

function handleCheckboxChange(child, time, type, checked){
  const current = getEffectiveState(child.id, time);
  let supine = current.supine;
  let prone = current.prone;

  if(type === "u"){
    supine = checked;
  }else{
    prone = checked;
  }

  const invalidKey = getInvalidKey(child.id, time);

  if(supine && prone){
    invalidSelections.set(invalidKey, true);
  }else{
    invalidSelections.delete(invalidKey);
    if(supine){
      setStoredValue(selectedYMD, child.id, child.name, time, "u");
    }else if(prone){
      setStoredValue(selectedYMD, child.id, child.name, time, "d");
    }else{
      setStoredValue(selectedYMD, child.id, child.name, time, "");
    }
  }

  renderRecord();
  refreshStatuses();
}

function updateRecordTabLabel(){
  tabRecord.textContent = ymdToLabelNoYear(selectedYMD);
}

function setPane(name){
  currentPane = name;

  tabRecord.classList.toggle("active", name === "record");
  tabCalendar.classList.toggle("active", name === "calendar");
  tabManage.classList.toggle("active", name === "manage");

  paneRecord.classList.toggle("active", name === "record");
  paneCalendar.classList.toggle("active", name === "calendar");
  paneManage.classList.toggle("active", name === "manage");

  if(name === "record"){
    renderRecord();
  }else if(name === "calendar"){
    renderCalendar();
  }else if(name === "manage"){
    renderYearSelect();
    renderManageStatus();
  }
}

tabRecord.addEventListener("click", ()=> setPane("record"));
tabCalendar.addEventListener("click", ()=> setPane("calendar"));
tabManage.addEventListener("click", ()=> setPane("manage"));

function renderRangeRadios(){
  rangeRadios.innerHTML = "";

  for(const range of RANGE_DEFS){
    const label = document.createElement("label");
    label.className = "rangeRadio";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "recordRange";
    input.value = range.id;
    input.checked = range.id === selectedRangeId;
    input.addEventListener("change", ()=>{
      selectedRangeId = range.id;
      renderRecord();
    });

    const span = document.createElement("span");
    span.textContent = range.label;

    label.appendChild(input);
    label.appendChild(span);
    rangeRadios.appendChild(label);
  }
}

async function renderRecord(){
  currentChildren = await loadChildrenJson();
  renderRangeRadios();

  const selectedRange = getRangeDef(selectedRangeId);
  const invalidCount = Array.from(invalidSelections.keys()).filter(key => key.startsWith(`${selectedYMD}__`)).length;
  viewStatus.innerHTML = `日付：<b>${selectedYMD}</b> ／ 表示範囲：<b>${selectedRange.label}</b> ／ 園児数：<b>${currentChildren.length}</b> ／ 未保存の赤表示：<b>${invalidCount}</b>`;

  viewBody.innerHTML = "";

  for(const child of currentChildren){
    const row = document.createElement("div");
    row.className = "childRow";

    const nameBox = document.createElement("div");
    nameBox.className = "childNameBox";

    const name = document.createElement("div");
    name.textContent = child.name;

    const firstTag = document.createElement("div");
    firstTag.className = "firstSleep";
    firstTag.textContent = `最初に寝た時間：${firstSleepTime(selectedYMD, child.id) || "—"}`;

    nameBox.appendChild(name);
    nameBox.appendChild(firstTag);

    const blocks = document.createElement("div");
    blocks.className = "blocks";

    for(const hour of getRangeHours(selectedRangeId)){
      const block = document.createElement("div");
      block.className = "hourBlock";

      const table = document.createElement("table");
      table.className = "mini";

      const headerRow = document.createElement("tr");
      const hourHead = document.createElement("th");
      hourHead.className = "hourHead";
      hourHead.colSpan = 13;
      hourHead.textContent = `${hour}時`;
      headerRow.appendChild(hourHead);
      table.appendChild(headerRow);

      const minuteRow = document.createElement("tr");
      const blankHead = document.createElement("th");
      blankHead.className = "rowLabel minHead";
      blankHead.textContent = "";
      minuteRow.appendChild(blankHead);

      for(let min = 0; min < 60; min += STEP_MIN){
        const th = document.createElement("th");
        th.className = "minHead";
        th.textContent = String(min);
        minuteRow.appendChild(th);
      }
      table.appendChild(minuteRow);

      const supineRow = document.createElement("tr");
      const supineHead = document.createElement("th");
      supineHead.className = "rowLabel";
      supineHead.textContent = "仰向け";
      supineRow.appendChild(supineHead);

      const proneRow = document.createElement("tr");
      const proneHead = document.createElement("th");
      proneHead.className = "rowLabel";
      proneHead.textContent = "うつ伏せ";
      proneRow.appendChild(proneHead);

      for(let min = 0; min < 60; min += STEP_MIN){
        const time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const state = getEffectiveState(child.id, time);

        const supineCell = document.createElement("td");
        const proneCell = document.createElement("td");

        if(state.invalid){
          supineCell.classList.add("invalidCell");
          proneCell.classList.add("invalidCell");
        }

        const supineWrap = document.createElement("label");
        supineWrap.className = "checkWrap" + (state.invalid ? " invalid" : "");
        const supineInput = document.createElement("input");
        supineInput.type = "checkbox";
        supineInput.checked = state.supine;
        supineInput.addEventListener("change", (e)=>{
          handleCheckboxChange(child, time, "u", e.target.checked);
        });
        supineWrap.appendChild(supineInput);
        supineCell.appendChild(supineWrap);

        const proneWrap = document.createElement("label");
        proneWrap.className = "checkWrap" + (state.invalid ? " invalid" : "");
        const proneInput = document.createElement("input");
        proneInput.type = "checkbox";
        proneInput.checked = state.prone;
        proneInput.addEventListener("change", (e)=>{
          handleCheckboxChange(child, time, "d", e.target.checked);
        });
        proneWrap.appendChild(proneInput);
        proneCell.appendChild(proneWrap);

        supineRow.appendChild(supineCell);
        proneRow.appendChild(proneCell);
      }

      table.appendChild(supineRow);
      table.appendChild(proneRow);
      block.appendChild(table);
      blocks.appendChild(block);
    }

    row.appendChild(nameBox);
    row.appendChild(blocks);
    viewBody.appendChild(row);
  }
}

function refreshStatuses(){
  renderCalendarStatus();
  renderManageStatus();
  renderYearSelect();
}

function renderCalendarStatus(){
  const count = childCountWithRecord(selectedYMD);
  calendarStatus.innerHTML = `選択日：<b>${selectedYMD}</b> ／ 記録園児数：<b>${count}</b>`;
}

function renderCalendar(){
  renderCalendarStatus();
  calendarTitle.textContent = `${calendarYear}年 ${calendarMonth + 1}月`;
  calendarGrid.innerHTML = "";

  const dows = ["日", "月", "火", "水", "木", "金", "土"];
  for(const dow of dows){
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = dow;
    calendarGrid.appendChild(el);
  }

  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startIndex = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevLastDay = new Date(calendarYear, calendarMonth, 0).getDate();

  for(let i=0;i<42;i++){
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "dayCell";

    let year = calendarYear;
    let month = calendarMonth;
    let dayNum = 0;
    let outside = false;

    if(i < startIndex){
      outside = true;
      dayNum = prevLastDay - startIndex + i + 1;
      const prev = new Date(calendarYear, calendarMonth, 0);
      year = prev.getFullYear();
      month = prev.getMonth();
    }else if(i >= startIndex + daysInMonth){
      outside = true;
      dayNum = i - (startIndex + daysInMonth) + 1;
      const next = new Date(calendarYear, calendarMonth + 1, 1);
      year = next.getFullYear();
      month = next.getMonth();
    }else{
      dayNum = i - startIndex + 1;
    }

    const d = new Date(year, month, dayNum);
    const ymd = dateToYmd(d);
    const count = childCountWithRecord(ymd);
    const isToday = ymd === ymdToday();
    const isSelected = ymd === selectedYMD;

    if(outside) cell.classList.add("outside");
    if(isToday) cell.classList.add("today");
    if(isSelected) cell.classList.add("selected");

    const top = document.createElement("div");
    top.className = "dayTop";

    const num = document.createElement("div");
    num.className = "dayNum";
    num.textContent = dayNum;

    const mark = document.createElement("div");
    mark.className = "recordMark";
    mark.textContent = count > 0 ? `●${count}` : "";

    top.appendChild(num);
    top.appendChild(mark);

    const bottom = document.createElement("div");
    bottom.className = "dayBottom";
    bottom.textContent = isToday ? "今日" : "";

    cell.appendChild(top);
    cell.appendChild(bottom);

    if(!outside){
      cell.addEventListener("click", ()=>{
        selectedYMD = ymd;
        updateRecordTabLabel();
        refreshStatuses();
        setPane("record");
      });
    }else{
      cell.disabled = true;
    }

    calendarGrid.appendChild(cell);
  }
}

btnPrevMonth.addEventListener("click", ()=>{
  const d = new Date(calendarYear, calendarMonth - 1, 1);
  calendarYear = d.getFullYear();
  calendarMonth = d.getMonth();
  renderCalendar();
});

btnNextMonth.addEventListener("click", ()=>{
  const d = new Date(calendarYear, calendarMonth + 1, 1);
  calendarYear = d.getFullYear();
  calendarMonth = d.getMonth();
  renderCalendar();
});

function fiscalYearFromYmd(ymd){
  const [y, m] = ymd.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

function fiscalYearRange(startYear){
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`
  };
}

function listExistingYMDs(){
  const out = [];
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i);
    if(/^nap_\d{4}-\d{2}-\d{2}$/.test(key)){
      out.push(key.replace("nap_", ""));
    }
  }
  return out.sort();
}

function getAvailableFiscalYears(){
  const years = new Set();
  years.add(fiscalYearFromYmd(ymdToday()));

  for(const ymd of listExistingYMDs()){
    years.add(fiscalYearFromYmd(ymd));
  }

  return Array.from(years).sort((a, b) => a - b);
}

function renderYearSelect(){
  const years = getAvailableFiscalYears();
  const selectedYear = Number(yearSelect.value) || fiscalYearFromYmd(ymdToday());
  yearSelect.innerHTML = "";

  for(const year of years){
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = `${year}年度`;
    if(year === selectedYear){
      opt.selected = true;
    }
    yearSelect.appendChild(opt);
  }

  if(yearSelect.options.length === 0){
    const year = fiscalYearFromYmd(ymdToday());
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = `${year}年度`;
    opt.selected = true;
    yearSelect.appendChild(opt);
  }
}

function renderManageStatus(){
  const year = Number(yearSelect.value) || fiscalYearFromYmd(ymdToday());
  const range = fiscalYearRange(year);
  manageStatus.innerHTML = `選択年度：<b>${year}年度</b> ／ 期間：<b>${range.start}</b> ～ <b>${range.end}</b>`;
}

yearSelect.addEventListener("change", ()=>{
  renderManageStatus();
});

function escapeCsv(value){
  const s = String(value ?? "");
  if(/[",\n]/.test(s)){
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvHeader(){
  return ["childId", "childName", ...DAY_TIMES];
}

function buildCsvForDay(ymd){
  const dayData = loadDayData(ymd);
  const rows = [];
  rows.push(csvHeader().map(escapeCsv).join(","));

  for(const [childId, childObj] of Object.entries(dayData.children)){
    const hasAny = Object.keys(childObj.records || {}).length > 0;
    if(!hasAny) continue;

    const row = [
      childId,
      childObj.name || "",
      ...DAY_TIMES.map(time => childObj.records[time] || "")
    ];
    rows.push(row.map(escapeCsv).join(","));
  }

  return "\uFEFF" + rows.join("\r\n");
}

function parseCsvLine(line){
  const result = [];
  let current = "";
  let inQuotes = false;

  for(let i=0;i<line.length;i++){
    const ch = line[i];
    const next = line[i + 1];

    if(ch === '"' && inQuotes && next === '"'){
      current += '"';
      i++;
    }else if(ch === '"'){
      inQuotes = !inQuotes;
    }else if(ch === "," && !inQuotes){
      result.push(current);
      current = "";
    }else{
      current += ch;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(text){
  const lines = text.replace(/\r/g, "").split("\n").filter(line => line !== "");
  if(lines.length === 0) return null;

  const expected = csvHeader();
  const header = parseCsvLine(lines[0]);
  if(header.length !== expected.length) return null;

  for(let i=0;i<expected.length;i++){
    if(header[i].replace(/^0/,"") !== expected[i].replace(/^0/,"")) return null;
  }

  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = parseCsvLine(lines[i]);
    while(cols.length < expected.length){
      cols.push("");
    }
    rows.push(cols.slice(0, expected.length));
  }

  return rows;
}

function overwriteDayFromCsvRows(ymd, rows){
  const dayData = createEmptyDayData();

  for(const row of rows){
    const childId = row[0];
    const childName = row[1] || "";
    if(!childId) continue;

    dayData.children[childId] = { name: childName, records:{} };

    for(let i=0;i<DAY_TIMES.length;i++){
      const value = row[i + 2] || "";
      if(value === "u" || value === "d"){
        dayData.children[childId].records[DAY_TIMES[i]] = value;
      }
    }
  }

  saveDayData(ymd, dayData);
}

async function backupFiscalYearZip(startYear){
  if(typeof JSZip === "undefined"){
    alert("ZIPライブラリを読み込めませんでした。");
    return;
  }

  const range = fiscalYearRange(startYear);
  const confirmMsg = `${startYear}年度（${range.start}〜${range.end}）をバックアップしますか？`;
  if(!confirm(confirmMsg)) return;

  const zip = new JSZip();
  let current = ymdToDate(range.start);
  const end = ymdToDate(range.end);

  while(current <= end){
    const ymd = dateToYmd(current);
    if(childCountWithRecord(ymd) > 0){
      zip.file(`nap_${ymd}.csv`, buildCsvForDay(ymd));
    }
    current.setDate(current.getDate() + 1);
  }

  const blob = await zip.generateAsync({ type:"blob" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `nap_backup_${startYear}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function restoreFiscalYearZip(file){
  if(typeof JSZip === "undefined"){
    alert("ZIPライブラリを読み込めませんでした。");
    return;
  }

  const zip = await JSZip.loadAsync(file);
  const entries = Object.keys(zip.files).filter(name => /^nap_\d{4}-\d{2}-\d{2}\.csv$/i.test(name));

  let imported = 0;

  for(const name of entries){
    const match = name.match(/^nap_(\d{4}-\d{2}-\d{2})\.csv$/i);
    if(!match) continue;

    const ymd = match[1];
    const text = new TextDecoder("utf-8").decode(await zip.files[name].async("uint8array"));
    const rows = parseCsv(text);
    if(!rows) continue;

    overwriteDayFromCsvRows(ymd, rows);
    imported++;
  }

  invalidSelections.clear();
  renderYearSelect();
  renderManageStatus();
  renderRecord();
  if(currentPane === "calendar") renderCalendar();
  alert(`復元しました。対象ファイル数：${imported}`);
}

function deleteFiscalYear(startYear){
  const range = fiscalYearRange(startYear);
  const msg = `${startYear}年度（${range.start}〜${range.end}）のデータを削除しますか？`;
  if(!confirm(msg)) return;

  let current = ymdToDate(range.start);
  const end = ymdToDate(range.end);
  let deleted = 0;

  while(current <= end){
    const ymd = dateToYmd(current);
    if(localStorage.getItem(storeKey(ymd)) !== null){
      removeDayData(ymd);
      deleted++;
    }
    current.setDate(current.getDate() + 1);
  }

  for(const key of Array.from(invalidSelections.keys())){
    const datePart = key.split("__")[0];
    if(fiscalYearFromYmd(datePart) === startYear){
      invalidSelections.delete(key);
    }
  }

  renderYearSelect();
  renderManageStatus();
  renderRecord();
  if(currentPane === "calendar") renderCalendar();

  alert(`削除しました。対象日数：${deleted}`);
}

btnBackup.addEventListener("click", ()=>{
  const year = Number(yearSelect.value) || fiscalYearFromYmd(ymdToday());
  backupFiscalYearZip(year);
});

btnRestore.addEventListener("click", ()=> restoreZipInput.click());

restoreZipInput.addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  await restoreFiscalYearZip(file);
  restoreZipInput.value = "";
});

btnDeleteYear.addEventListener("click", ()=>{
  const year = Number(yearSelect.value) || fiscalYearFromYmd(ymdToday());
  deleteFiscalYear(year);
});