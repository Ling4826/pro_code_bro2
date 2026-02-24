// Activity_list.js

// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 💡 ลบตัวแปร Filter และ Modal ที่ไม่ใช้
let cachedActivities = [];
let leaderClassId = null; // 💡 เก็บ Class ID ของหัวหน้าห้อง

// ==========================================================
// === 1. LOADERS / POPULATORS ===
// 💡 ลบฟังก์ชัน populateFilters(), updateYearFilter(), updateMajorFilter(), updateClassNumberFilter() ออกทั้งหมด
// ==========================================================

// ==========================================================
// === 2. FETCH & RENDER ACTIVITY (ปรับปรุงการกรอง) ===
// ==========================================================

// 💡 (ฟังก์ชันใหม่) ดึง Class ID ของหัวหน้าห้องจาก Ref ID
async function getLeaderClassId(leaderRefId) {
    if (!leaderRefId) return null;

    const { data: studentData, error: studentError } = await supabaseClient
        .from('student')
        .select('class_id')
        .eq('id', leaderRefId)
        .eq('role', 'Leader')
        .single();

    if (studentError) {
        console.error('Error fetching leader student data:', studentError.message);
        return null;
    }
    return studentData ? studentData.class_id : null;
}
// ... (ส่วนหัวโค้ด) ...

async function fetchActivities() {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = 'กำลังโหลดกิจกรรม...';
    
    // ดึง Ref ID ของหัวหน้าห้อง และหา Class ID
    const refId = sessionStorage.getItem('ref_id');
    leaderClassId = await getLeaderClassId(refId); 
    
    if (!leaderClassId) {
        // อนุญาตให้โหลดกิจกรรมรวมได้แม้ไม่พบ Class ID (แต่จะไม่เห็นกิจกรรมห้องตัวเอง)
        console.warn('Class ID for the leader not found. Only loading non-class-specific activities.');
    }

    // 💡 (แก้ไข) ดึงกิจกรรมทั้งหมดที่ไม่ได้ถูกลบ หรือดึงกิจกรรมที่มี class_id เป็นของห้องนี้ หรือเป็น null
    // เนื่องจาก Supabase RLS จะจัดการการอนุญาตการเข้าถึง เราจะเน้นที่การดึงข้อมูลที่จำเป็น

    // **วิธีที่ 1: ดึงกิจกรรมที่ตรงกับ Class ID หรือกิจกรรมรวม**
    // เนื่องจาก Supabase ไม่รองรับ `or` ใน `.select()` โดยตรงกับการกรอง JOIN (แบบ RLS), 
    // เราจะใช้ `.or()` ที่ระดับ Query แทน
    
   // ... (ในฟังก์ชัน fetchActivities) ...

   const { data: activityChecks, error: checkError } = await supabaseClient
        .from('activity_check')
        .select('activity_id')
        .eq('student_id', refId); // refId คือ student_id ของผู้ใช้คนปัจจุบัน

    if (checkError) {
        // จัดการ error
        return;
    }

    const activityIds = activityChecks.map(c => c.activity_id);

    // 2. ดึงรายละเอียดกิจกรรมโดยใช้ ID ที่ได้
    let query = supabaseClient
        .from('activity')
        .select(`
            id,
            name,
            start_time,
            end_time,
            is_recurring,
            activity_type, 
            class:class_id (
                id,
                class_number,
                year,
                major:major_id (id, name, level)
            )
        `)
        // 🔥 ใช้ .in() เพื่อรวมกิจกรรมทั้งหมดที่นักเรียนถูกเช็คชื่อ
        .in('id', activityIds) 
        .order('start_time', { ascending: true });

    
    const { data: activities, error } = await query;
    // 💡 ลบ `.eq('class_id', leaderClassId)` ออก 

    if (error) {
// ... (ส่วนแสดง error) ...
        console.error('Error fetching activities:', error.message);
        container.innerHTML = `<p>ไม่สามารถดึงรายการกิจกรรมได้ (ข้อผิดพลาด: ${error.message})</p>`;
        return;
    }

    cachedActivities = activities;
    initFilters();
    updateFilters(); // แสดงผลครั้งแรกด้วย Filter (ซึ่งเริ่มต้นเป็น 'ทุก...')
    RenderActivityCards(activities, container);
}

// ... (ส่วนที่เหลือของโค้ดคงเดิม) ...
function RenderActivityCards(activities, container) {
    container.innerHTML = '';

// ... (ส่วน if (activities.length === 0) ยังคงเดิม) ...
    
    const DEFAULT_MAJOR = 'ทุกสาขา';
    const DEFAULT_LEVEL = 'ทุกระดับ';
    const DEFAULT_YEAR = 'ทุกปี';
    const DEFAULT_CLASS_NUM = 'ทุกห้อง';
    
    // 💡 เพิ่มคำว่า "กิจกรรมรวม" เพื่อให้ชัดเจน
    const ALL_CLASSES = 'ทุกชั้นเรียน'; 

    activities.forEach(activity => {
// ... (การคำนวณ date, startTime, endTime ยังคงเดิม) ...
        const date = new Date(activity.start_time).toLocaleDateString('th-TH', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        }).replace(/\//g, '/');
        
        const startTime = new Date(activity.start_time).toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Asia/Bangkok' 
        });
        
        const endTime = new Date(activity.end_time).toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Asia/Bangkok' 
        });
        
        const classData = activity.class;
        const majorData = classData?.major;
        
        // 💡 ปรับปรุงการกำหนดค่าเมื่อ classData เป็น null (กิจกรรมรวม)
        let classDetailText;
        if (classData && classData.id) {
            classDetailText = `ปี ${classData.year || DEFAULT_YEAR} ห้อง ${classData.class_number || DEFAULT_CLASS_NUM}`;
        } else {
            classDetailText = ALL_CLASSES; // แสดง "ทุกชั้นเรียน" สำหรับกิจกรรมรวม
        }


        const departmentName = majorData?.name || DEFAULT_MAJOR;
        const departmentLevel = majorData?.level || DEFAULT_LEVEL;
        
        const mockSemester = (activity.id % 2) + 1;
        const recurringDays = activity.is_recurring ? 'N' : '0';

        const cardHTML = `
            <div class="activity-card" 
                data-id="${activity.id}" 
                data-name="${activity.name}" 
                > <div class="card-title">${activity.name}</div>
                
                <div class="card-detail">วันที่ ${date}</div>
                <div class="card-detail">เวลา ${startTime} น. - ${endTime} น.</div>
                
                <div class="card-detail">สาขา: ${departmentName}</div>
                <div class="card-detail">ระดับ: ${departmentLevel}</div>
                <div class="card-detail">ชั้นเรียน: ${classDetailText}</div> <div class="card-detail">จัดขึ้นทุก ${recurringDays} วัน</div>
                <div class="card-detail">เทอม: ${mockSemester}</div>
                
                </div>
        `;
        container.innerHTML += cardHTML;
        
    });

    attachCardEventListeners();
}

// ==========================================================
// === 3. FILTER LOGIC & EVENT HANDLERS (ถูกลบออกทั้งหมด) ===
// ==========================================================
// 💡 ลบฟังก์ชัน handleLevelChange, handleMajorChange, handleYearChange, filterActivities ออกทั้งหมด

// ==========================================================
// === 4. CARD EVENT LISTENERS (เหลือแค่คลิกการ์ด) ===
// ==========================================================

function attachCardEventListeners() {

    // 💡 1. Listener สำหรับการ์ดทั้งใบ (ไปหน้าเช็คชื่อ)
    document.querySelectorAll('.activity-card').forEach(card => {
        card.addEventListener('click', (event) => {
            
            // ถ้าที่คลิกคือไอคอน (fas) ให้ข้ามไป (เดิมมีไว้ป้องกันปุ่ม Edit/Delete ซึ่งถูกลบไปแล้ว)
            if (event.target.classList.contains('fas')) {
                return;
            }

            // ไปหน้า Check_activities (เช็คชื่อ)
            const activityId = card.dataset.id;
            window.location.href = `Check_activities.html?activityId=${activityId}`;
        });
    });

    // 💡 2. ลบ Listener ปุ่มลบ และ 3. Listener ปุ่มแก้ไข ออก
}

let currentFilters = {
    level: '',
    major: '',
    year: '',
    classNumber: '',
    search: ''
};

function getFilteredActivities(activities) {
    let filtered = [...activities];
    const { level, major, year, classNumber, search } = currentFilters;

    if (level) {
        filtered = filtered.filter(a => a.class?.major?.level === level);
    }
    if (major) {
        filtered = filtered.filter(a => a.class?.major?.name === major);
    }
    if (year) {
        filtered = filtered.filter(a => a.class?.year.toString() === year || a.class === null); // รวมกิจกรรมรวม
    }
    if (classNumber) {
        filtered = filtered.filter(a => a.class?.class_number.toString() === classNumber || a.class === null); // รวมกิจกรรมรวม
    }
    if (search) {
        const searchTerm = search.toLowerCase();
        filtered = filtered.filter(a => 
            a.name.toLowerCase().includes(searchTerm) ||
            a.class?.major?.name.toLowerCase().includes(searchTerm) ||
            a.class?.major?.level.toLowerCase().includes(searchTerm)
        );
    }
    return filtered;
}

function initFilters() {
    const activities = cachedActivities;
    
    // ดึงค่าที่ไม่ซ้ำกัน
    const uniqueMajors = [...new Set(activities.map(a => a.class?.major?.name).filter(n => n))].sort();
    const uniqueLevels = [...new Set(activities.map(a => a.class?.major?.level).filter(n => n))].sort();
    const uniqueYears = [...new Set(activities.map(a => a.class?.year).filter(n => n))].sort((a, b) => a - b);
    const uniqueClasses = [...new Set(activities.map(a => a.class?.class_number).filter(n => n))].sort((a, b) => a - b);
    
    // เติมค่าลงใน Dropdown
    fillSelect('level', uniqueLevels, 'ทุกระดับ');
    fillSelect('department', uniqueMajors, 'ทุกสาขาวิชา');
    fillSelect('studentYear', uniqueYears, 'ทุกชั้นปี', 'ปี ');
    fillSelect('classNumber', uniqueClasses, 'ทุกห้อง', 'ห้อง ');
    
    // ตั้งค่า Event Listeners
    document.getElementById('level')?.addEventListener('change', updateFilters);
    document.getElementById('department')?.addEventListener('change', updateFilters);
    document.getElementById('studentYear')?.addEventListener('change', updateFilters);
    document.getElementById('classNumber')?.addEventListener('change', updateFilters);
    document.getElementById('activityNameInput')?.addEventListener('input', updateFilters);
}

function fillSelect(elementId, items, placeholder, prefix = "") {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = prefix + item;
        select.appendChild(option);
    });
}

function updateFilters() {
    currentFilters.level = document.getElementById('level')?.value || '';
    currentFilters.major = document.getElementById('department')?.value || '';
    currentFilters.year = document.getElementById('studentYear')?.value || '';
    currentFilters.classNumber = document.getElementById('classNumber')?.value || '';
    currentFilters.search = document.getElementById('activityNameInput')?.value || '';
    
    const filtered = getFilteredActivities(cachedActivities);
    RenderActivityCards(filtered, document.getElementById('activityCardContainer'));
}


document.addEventListener('DOMContentLoaded', () => {
    // 💡 ลบการกำหนดค่าตัวแปร DOM สำหรับ Filter และ Modal ออกทั้งหมด

    // 1. Populate Dropdowns 💡 ลบ populateFilters(); ออก

    // 2. Fetch Activities (ใช้ฟังก์ชันใหม่ที่กรองด้วย Class ID แล้ว)
    fetchActivities();

    // 3. Attach Event Listeners 💡 ลบ Event Listeners สำหรับ Filter ออกทั้งหมด
});