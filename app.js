  const HOURS = [9,10,11,12,13,14,15];
  const DEFAULT_HOUR = 9;
  const STEP_MIN = 5;
  const SLOTS_PER_HOUR = 60 / STEP_MIN;
  const DAY_TIMES = buildAllTimes();
  const POS_LABELS = { u:"仰向け", d:"うつ伏せ" };

  const tabInput = document.getElementById("tabInput");
  const tabRecord = document.getElementById("tabRecord");
  const tabCalendar = document.getElementById("tabCalendar");
  const tabManage = document.getElementById("tabManage");

  const paneInput = document.getElementById("paneInput");
  const paneRecord = document.getElementById("paneRecord");
  const paneCalendar = document.getElementById("paneCalendar");
  const paneManage = document.getElementById("paneManage");

  const hourRadios = document.getElementById("hourRadios");
  const timeSelect = document.getElementById("timeSelect");
  const inputStatus = document.getElementById("inputStatus");
  const inputRows = document.getElementById("inputRows");

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

  const topHint = document.getElementById("topHint");

  let currentPane = "input";
  let selectedYMD = ymdToday();
  let currentHour = DEFAULT_HOUR;
  let currentTime = minToHHMM(DEFAULT_HOUR * 60);
  let snapshotAll = null;

  let currentChildren = [];
  let currentChildMap = new Map();

  const selectedDateObj = ymdToDate(selectedYMD);
  let calendarYear = selectedDateObj.getFullYear();
  let calendarMonth = selectedDateObj.getMonth();

  init();

  async function init(){
    try{
      currentChildren = await loadChildrenJson();
      currentChildMap = new Map(currentChildren.map(c => [c.id, c.name]));
      renderHourRadios();
      rebuildTimeSelect();
      currentTime = timeSelect.value;
      updateRecordTabLabel();
      renderYearSelect();
      renderInput();
      renderCalendar();
      renderManageStatus();
      updateTopHint("準備完了");
    }catch(err){
      console.error(err);
      alert("child.json の読み込みに失敗しました。");
      updateTopHint("child.json 読み込み失敗");
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
    for(const h of HOURS){
      for(let i=0;i<SLOTS_PER_HOUR;i++){
        out.push(minToHHMM(h * 60 + i * STEP_MIN));
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

  function minToHHMM(min){
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function hhmmToMin(hhmm){
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function hourToTimes(hour){
    const base = hour * 60;
    const out = [];
    for(let i=0;i<SLOTS_PER_HOUR;i++){
      out.push(minToHHMM(base + i * STEP_MIN));
    }
    return out;
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

  function getInputChildrenForDate(){
  return currentChildren.length
    ? currentChildren.map(c => ({ id:c.id, name:c.name }))
    : [];
  }

  function getDisplayChildrenForDate(ymd){
    const dayData = loadDayData(ymd);
    return Object.entries(dayData.children)
      .filter(([, obj]) => Object.keys(obj.records || {}).length > 0)
      .map(([id, obj]) => ({
        id,
        name: obj.name || ""
      }));
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
    return getDisplayChildrenForDate(ymd).length;
  }

  function firstSleepTime(ymd, childId){
    const dayData = loadDayData(ymd);
    const child = dayData.children[childId];
    if(!child) return "";
    const times = Object.keys(child.records || {}).sort((a, b) => hhmmToMin(a) - hhmmToMin(b));
    return times.length ? times[0] : "";
  }

  function groupHours(ymd, childId){
    const dayData = loadDayData(ymd);
    const child = dayData.children[childId];
    const records = child ? child.records : {};
    const map = new Map();

    for(const [time, value] of Object.entries(records)){
      const hour = Number(time.split(":")[0]);
      if(!map.has(hour)) map.set(hour, {});
      map.get(hour)[time] = value;
    }

    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }

  function deepCopy(obj){
    return JSON.parse(JSON.stringify(obj || {}));
  }

  function updateTopHint(text){
    topHint.textContent = text;
  }

  function updateRecordTabLabel(){
    tabRecord.textContent = ymdToLabelNoYear(selectedYMD);
  }

  function setPane(name){
    currentPane = name;

    tabInput.classList.toggle("active", name === "input");
    tabRecord.classList.toggle("active", name === "record");
    tabCalendar.classList.toggle("active", name === "calendar");
    tabManage.classList.toggle("active", name === "manage");

    paneInput.classList.toggle("active", name === "input");
    paneRecord.classList.toggle("active", name === "record");
    paneCalendar.classList.toggle("active", name === "calendar");
    paneManage.classList.toggle("active", name === "manage");

    if(name === "input"){
      renderInput();
    }else if(name === "record"){
      makeSnapshotAndRender();
    }else if(name === "calendar"){
      renderCalendar();
    }else if(name === "manage"){
      renderYearSelect();
      renderManageStatus();
    }
  }

  tabInput.addEventListener("click", ()=> setPane("input"));
  tabRecord.addEventListener("click", ()=> setPane("record"));
  tabCalendar.addEventListener("click", ()=> setPane("calendar"));
  tabManage.addEventListener("click", ()=> setPane("manage"));

  function renderHourRadios(){
    const keep = hourRadios.firstElementChild;
    hourRadios.innerHTML = "";
    hourRadios.appendChild(keep);

    for(const h of HOURS){
      const label = document.createElement("label");
      label.className = "hourRadio";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "hour";
      input.value = String(h);
      input.checked = (h === currentHour);
      input.addEventListener("change", ()=>{
        currentHour = h;
        rebuildTimeSelect();
        currentTime = timeSelect.value;
        renderInput();
      });

      const span = document.createElement("span");
      span.textContent = `${h}時`;

      label.appendChild(input);
      label.appendChild(span);
      hourRadios.appendChild(label);
    }
  }

  function rebuildTimeSelect(){
    const times = hourToTimes(currentHour);
    timeSelect.innerHTML = "";
    for(const t of times){
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      timeSelect.appendChild(opt);
    }
    timeSelect.value = minToHHMM(currentHour * 60);
  }

  timeSelect.addEventListener("change", ()=>{
    currentTime = timeSelect.value;
    renderInput();
  });

  async function renderInput(){
  currentChildren = await loadChildrenJson();
    const inputChildren = getInputChildrenForDate();

    inputStatus.innerHTML = `日付：<b>${selectedYMD}</b> ／ 時間：<b>${currentHour}時</b> ／ 時刻：<b>${currentTime}</b>`;
    inputRows.innerHTML = "";

    for(const child of inputChildren){
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.className = "nameCell";
      tdName.textContent = child.name;
      tr.appendChild(tdName);

      const tdBtns = document.createElement("td");
      const row = document.createElement("div");
      row.className = "rowBtns";

      const v = getStoredValue(selectedYMD, child.id, currentTime);

      const btnSupine = document.createElement("button");
      btnSupine.type = "button";
      btnSupine.className = "posBtn" + (v === "u" ? " active" : "");
      btnSupine.textContent = "仰向け";
      btnSupine.addEventListener("click", ()=>{
        setStoredValue(selectedYMD, child.id, child.name, currentTime, "u");
        renderInput();
        refreshStatuses();
      });

      const btnProne = document.createElement("button");
      btnProne.type = "button";
      btnProne.className = "posBtn" + (v === "d" ? " active" : "");
      btnProne.textContent = "うつ伏せ";
      btnProne.addEventListener("click", ()=>{
        setStoredValue(selectedYMD, child.id, child.name, currentTime, "d");
        renderInput();
        refreshStatuses();
      });

      const btnClear = document.createElement("button");
      btnClear.type = "button";
      btnClear.className = "clearBtn";
      btnClear.textContent = "クリア";
      btnClear.addEventListener("click", ()=>{
        setStoredValue(selectedYMD, child.id, child.name, currentTime, "");
        renderInput();
        refreshStatuses();
      });

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = v ? POS_LABELS[v] : "未選択";

      row.appendChild(btnSupine);
      row.appendChild(btnProne);
      row.appendChild(btnClear);
      row.appendChild(badge);

      tdBtns.appendChild(row);
      tr.appendChild(tdBtns);
      inputRows.appendChild(tr);
    }

    updateRecordTabLabel();
  }

  function makeSnapshotAndRender(){
    snapshotAll = deepCopy(loadDayData(selectedYMD));
    renderSnapshot();
  }

  function renderSnapshot(){
    const src = snapshotAll || createEmptyDayData();
    const targets = Object.entries(src.children)
      .filter(([, obj]) => Object.keys(obj.records || {}).length > 0)
      .map(([id, obj]) => ({ id, name: obj.name || "" }));

    viewStatus.innerHTML = `日付：<b>${selectedYMD}</b> ／ 表示園児数：<b>${targets.length}</b>`;
    viewBody.innerHTML = "";

    if(targets.length === 0){
      const p = document.createElement("p");
      p.style.color = "var(--muted)";
      p.style.padding = "12px";
      p.textContent = "記録がある園児がいません。";
      viewBody.appendChild(p);
      return;
    }

    for(const child of targets){
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

      const hourGroups = groupHours(selectedYMD, child.id);

      for(const [hour, hourObj] of hourGroups){
        const block = document.createElement("div");
        block.className = "hourBlock";

        const t = document.createElement("table");
        t.className = "mini";

        const r1 = document.createElement("tr");
        const thHour = document.createElement("th");
        thHour.className = "hourHead";
        thHour.colSpan = 13;
        thHour.textContent = `${hour}時`;
        r1.appendChild(thHour);
        t.appendChild(r1);

        const r2 = document.createElement("tr");
        const thBlank = document.createElement("th");
        thBlank.className = "rowLabel minHead";
        thBlank.textContent = "";
        r2.appendChild(thBlank);

        for(let i=0;i<SLOTS_PER_HOUR;i++){
          const m = i * STEP_MIN;
          const th = document.createElement("th");
          th.className = "minHead";
          th.textContent = String(m);
          r2.appendChild(th);
        }
        t.appendChild(r2);

        const r3 = document.createElement("tr");
        const thSup = document.createElement("th");
        thSup.className = "rowLabel";
        thSup.textContent = "仰向け";
        r3.appendChild(thSup);

        const r4 = document.createElement("tr");
        const thPro = document.createElement("th");
        thPro.className = "rowLabel";
        thPro.textContent = "うつ伏せ";
        r4.appendChild(thPro);

        const baseHourStr = String(hour).padStart(2, "0");

        for(let i=0;i<SLOTS_PER_HOUR;i++){
          const mm = i * STEP_MIN;
          const time = `${baseHourStr}:${String(mm).padStart(2, "0")}`;
          const v = hourObj[time];

          const tdSup = document.createElement("td");
          const tdPro = document.createElement("td");

          if(v === "u"){
            tdSup.innerHTML = '<span class="check">✓</span>';
            tdPro.innerHTML = '<span class="blank">✓</span>';
          }else if(v === "d"){
            tdSup.innerHTML = '<span class="blank">✓</span>';
            tdPro.innerHTML = '<span class="check">✓</span>';
          }else{
            tdSup.innerHTML = '<span class="blank">✓</span>';
            tdPro.innerHTML = '<span class="blank">✓</span>';
          }

          r3.appendChild(tdSup);
          r4.appendChild(tdPro);
        }

        t.appendChild(r3);
        t.appendChild(r4);

        block.appendChild(t);
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
          renderInput();
          refreshStatuses();
          setPane("input");
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
      if(header[i].replace(/^0/,'') !== expected[i].replace(/^0/,'')) return null;
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

    updateTopHint("年度のバックアップ中...");
    const zip = new JSZip();

    let current = ymdToDate(range.start);
    const end = ymdToDate(range.end);
    let fileCount = 0;

    while(current <= end){
      const ymd = dateToYmd(current);
      if(childCountWithRecord(ymd) > 0){
        zip.file(`nap_${ymd}.csv`, buildCsvForDay(ymd));
        fileCount++;
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

    updateTopHint(`年度のバックアップ完了（${fileCount}ファイル）`);
  }

  async function restoreFiscalYearZip(file){
    if(typeof JSZip === "undefined"){
      alert("ZIPライブラリを読み込めませんでした。");
      return;
    }

    updateTopHint("年度のデータ復元中...");
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

    renderYearSelect();
    renderManageStatus();
    renderInput();
    if(currentPane === "record") makeSnapshotAndRender();
    if(currentPane === "calendar") renderCalendar();
    updateTopHint(`年度のデータ復元完了（${imported}ファイル）`);
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

    renderYearSelect();
    renderManageStatus();
    renderInput();
    if(currentPane === "record") makeSnapshotAndRender();
    if(currentPane === "calendar") renderCalendar();

    updateTopHint(`年度のデータ削除完了（${deleted}日分）`);
    alert(`削除しました。対象日数：${deleted}`);
  }

  btnBackup.addEventListener("click", async ()=>{
    const year = Number(yearSelect.value) || fiscalYearFromYmd(ymdToday());
    await backupFiscalYearZip(year);
  });

  btnRestore.addEventListener("click", ()=>{
  restoreZipInput.value = "";
  restoreZipInput.click();
});

  restoreZipInput.addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    await restoreFiscalYearZip(file);
  });

  btnDeleteYear.addEventListener("click", ()=>{
    const year = Number(yearSelect.value) || fiscalYearFromYmd(ymdToday());
    deleteFiscalYear(year);
  });
