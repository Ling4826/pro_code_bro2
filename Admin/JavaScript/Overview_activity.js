// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentActivities = []; // เก็บข้อมูลกิจกรรมล่าสุด
let isFirstLoad = true;

// ฟังก์ชันหลักดึงข้อมูล (ทำงานตลอดทุก 3 วินาที)
async function fetchActivities() {
    try {
        // ดึงกิจกรรม + รายการเช็คชื่อ (เพื่อนับจำนวน)
        const { data: activities, error } = await supabaseClient
            .from('activity')
            .select(`
                id,
                name,
                start_time,
                end_time,
                is_recurring,
                class:class_id (
                    id,
                    class_name,
                    year,
                    class_number,
                    major:major_id (
                        id,
                        name,
                        level
                    )
                ),
                check:activity_check (
                    id,
                    status
                )
            `)
            .order('start_time', { ascending: true });

        if (error) throw error;

        currentActivities = activities;

        // ถ้าโหลดครั้งแรก ให้สร้างตัวเลือกวันที่
        if (isFirstLoad) {
            LoadDateOptions(activities);
            setupFilterListeners();
            isFirstLoad = false;
        } else {
            // โหลดครั้งต่อๆ ไป (Auto refresh) อัปเดตเฉพาะตัวเลือกวันที่ใหม่ๆ
            LoadDateOptions(activities, true); 
        }

        applyFiltersAndRender();

    } catch (err) {
        console.error('Error fetching activities:', err.message);
    }
}

// สร้าง Options ให้ Dropdown (วัน/เดือน/ปี)
function LoadDateOptions(activities, keepSelection = false) {
    const daySelect = document.getElementById('daySelect');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    // จำค่าเดิมไว้ก่อน ถ้าสั่งให้ keepSelection
    const currentDay = keepSelection ? daySelect.value : "";
    const currentMonth = keepSelection ? monthSelect.value : "";
    const currentYear = keepSelection ? yearSelect.value : "";

    const days = new Set();
    const months = new Set();
    const years = new Set();

    activities.forEach(act => {
        if(act.start_time) {
            const d = new Date(act.start_time);
            days.add(d.getDate());
            months.add(d.getMonth() + 1);
            years.add(d.getFullYear() + 543);
        }
    });

    daySelect.innerHTML = `<option value="">ทั้งหมด</option>`;
    monthSelect.innerHTML = `<option value="">ทั้งหมด</option>`;
    yearSelect.innerHTML = `<option value="">ทั้งหมด</option>`;

    Array.from(days).sort((a,b)=>a-b).forEach(d => daySelect.innerHTML += `<option value="${d}">${d}</option>`);
    Array.from(months).sort((a,b)=>a-b).forEach(m => monthSelect.innerHTML += `<option value="${m}">${m}</option>`);
    Array.from(years).sort((a,b)=>a-b).forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);

    // คืนค่าที่เลือกไว้กลับไป
    if(currentDay) daySelect.value = currentDay;
    if(currentMonth) monthSelect.value = currentMonth;
    if(currentYear) yearSelect.value = currentYear;
}

function setupFilterListeners() {
    document.getElementById('daySelect').addEventListener('change', applyFiltersAndRender);
    document.getElementById('monthSelect').addEventListener('change', applyFiltersAndRender);
    document.getElementById('yearSelect').addEventListener('change', applyFiltersAndRender);
}

function applyFiltersAndRender() {
    const dVal = document.getElementById('daySelect').value;
    const mVal = document.getElementById('monthSelect').value;
    const yVal = document.getElementById('yearSelect').value;

    const filtered = currentActivities.filter(act => {
        if(!act.start_time) return false;
        const d = new Date(act.start_time);
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear() + 543;

        const matchDay = dVal ? day === parseInt(dVal) : true;
        const matchMonth = mVal ? month === parseInt(mVal) : true;
        const matchYear = yVal ? year === parseInt(yVal) : true;

        return matchDay && matchMonth && matchYear;
    });

    RenderTable(filtered);
}

function RenderTable(activities) {
    const container = document.getElementById('activityCheckTableBody');
    if (!container) return;

    const rows = activities.map(act => {
        const startTime = formatTime(act.start_time);
        const endTime = formatTime(act.end_time);
        const dateStr = formatDate(act.start_time);
        
        // 🔥🔥🔥 แก้ไขตรงนี้: เปลี่ยนเครื่องหมาย - เป็นคำว่า "ทุก..." 🔥🔥🔥
        const major = act.class?.major?.name ?? 'ทุกสาขา';
        const level = act.class?.major?.level ?? 'ทุกระดับ';
        const year = act.class?.year ?? 'ทุกชั้นปี';
        const className = act.class?.class_name ?? 'ทุกห้อง';

        // นับจำนวนจาก activity_check โดยตรง
        const checkList = act.check || [];
        const totalStudents = checkList.length; 
        const attendedCount = checkList.filter(c => c.status === "Attended").length;

        // คำนวณเปอร์เซ็นต์
        const percent = totalStudents > 0
            ? Math.round((attendedCount / totalStudents) * 100)
            : 0;

        // กำหนดสถานะ
        let statusText = "ยังไม่เช็ก";
        let statusClass = "unchecked";

        if (totalStudents > 0) {
            const isStarted = checkList.some(c => c.status !== null);
            
            if (!isStarted) {
                statusText = "ยังไม่เช็ก";
                statusClass = "unchecked";
            } else if (attendedCount === totalStudents) {
                statusText = "มาครบ";
                statusClass = "checked";
            } else {
                statusText = "ยังไม่ครบ";
                statusClass = "partial";
            }
        } else {
            statusText = "ไม่มีรายชื่อ";
            statusClass = "unchecked";
        }

        return `
        <tr>
            <td>${act.name}</td>
            <td>${dateStr}</td>
            <td>${startTime} - ${endTime}</td>
            <td>${major}</td>
            <td>${level}</td>
            <td>${year}</td>
            <td>${className}</td>
            <td class="status-cell">
                <span class="${statusClass}" style="font-weight:bold;">${statusText}</span>
            </td>
            <td>
                <strong>${attendedCount} / ${totalStudents}</strong>
                <span style="color:#666; font-size:0.9em;">(${percent}%)</span>
            </td>
        </tr>`;
    });

    container.innerHTML = rows.length > 0 ? rows.join('') : '<tr><td colspan="9" style="text-align:center; padding: 20px;">ไม่พบข้อมูลกิจกรรม</td></tr>';
}

// Helpers
function formatTime(ts) {
    if(!ts) return "-";
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
    if(!ts) return "-";
    return new Date(ts).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function exportToExcel() {
    alert("กำลังพัฒนาฟีเจอร์ Export Excel...");
}

// เริ่มทำงาน
document.addEventListener('DOMContentLoaded', async () => {
    // 1. ผูกปุ่ม Excel
    const excelBtn = document.getElementById("exportExcelBtn");
    if(excelBtn) excelBtn.addEventListener("click", exportToExcel);

    // 2. โหลดครั้งแรก
    await fetchActivities();

    // 3. ตั้งเวลาโหลดอัตโนมัติทุก 3 วินาที
    setInterval(() => {
        fetchActivities();
    }, 3000); 
});