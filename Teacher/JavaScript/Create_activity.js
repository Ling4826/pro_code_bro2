// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------------
// *ฟังก์ชันจัดการ Form Submission*
// (ส่วนนี้ไม่มีการแก้ไข)
// -------------------------------------------------------------
async function handleCreateActivity(event) {
    event.preventDefault();
    const form = event.target;

    const activityName = form.activityName.value;
    const activityDate = form.activityDate.value;
    const startTime = form.startTime.value;

    const endTime = form.endTime.value;

    // 1. รับค่าจากฟอร์ม (HTML name="activityType")
    const activityType = form.activityType.value;

    const semester = parseInt(form.semester.value, 10);
    const classSelect = form.studentClass.value || null;

    const level = form.level.value || "";
    const studentYear = form.studentYear.value;
    
    let currentMajorId = null;
    if (level === 'ปวส.') currentMajorId = "1";
    else if (level === 'ปวช.') currentMajorId = "2";
    // เพิ่มการเช็ค activityType
    if (!activityName || !activityDate || !startTime || !endTime || !semester || !activityType || !studentYear) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน รวมถึงภาคเรียนและชั้นปี');
        return;
    }
    try {
        // ... (ส่วนการดึง Major, Class, Student และแปลงวันที่ เหมือนเดิม ไม่ต้องแก้) ...

        // (ขอละไว้เพื่อความกระชับ ให้ copy ส่วนบนจากไฟล์เดิมได้เลยครับ)
        let majorIdsFromLevel = [];
        if (level) {
            const { data: majors, error: majorError } = await supabaseClient
                .from("major").select("id").eq("level", level);
            if (majorError) throw majorError;
            majorIdsFromLevel = majors.map(m => m.id);
        }

        let classQuery = supabaseClient.from("class").select("id, major_id, year");
    if (currentMajorId) classQuery = classQuery.eq("major_id", currentMajorId); // ใช้ varchar ตรงๆ ไม่ parseInt
    if (studentYear) classQuery = classQuery.eq("year", parseInt(studentYear));
    if (classSelect) classQuery = classQuery.eq("id", classSelect);

    const { data: classes, error: classError } = await classQuery;
        if (classError) throw classError;
        if (!classes || classes.length === 0) { alert("⚠️ ไม่พบ class ตามเงื่อนไขที่เลือก"); return; }
        const classIds = classes.map(c => c.id);

        const { data: students, error: studentError } = await supabaseClient
            .from("student").select("id, class_id").in("class_id", classIds);
        if (studentError) throw studentError;
        if (!students || students.length === 0) { alert("⚠️ ไม่มีนักเรียนในคลาสตามที่เลือก"); return; }

        const dateParts = activityDate.split("-").map(Number);
        const [y, m, d] = dateParts.length === 3 ? dateParts : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()];
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const startISO = new Date(y, m - 1, d, sh, sm).toISOString();
        const endISO = new Date(y, m - 1, d, eh, em).toISOString();

        
        const { data: activity, error: activityError } = await supabaseClient
            .from("activity")
            .insert({
                name: activityName,
                activity_type: activityType,
                start_time: startISO,
                end_time: endISO,
                class_id: classSelect ? classSelect : null, 
                major_id: currentMajorId, 
                for_student: 1,
                for_leader: 1,
                for_teacher: 0,
                is_recurring: 0,
                created_by: "1",
            })
            .select("id")
            .single();

        if (activityError) throw activityError;
        const activityId = activity.id;

        // ... (ส่วนสร้าง activity_check เหมือนเดิม) ...
        const currentYear = new Date().getFullYear();
        const academicYear = currentYear + 543;
        const insertDate = activityDate.split(' ').length > 1 ? activityDate.split(' ')[0] : activityDate;

        const checks = students.map(s => ({
            activity_id: activityId,
            student_id: s.id,
            status: null,
            date: insertDate,
            semester,
            academic_year: academicYear,
        }));

        const { error: checkError } = await supabaseClient
            .from("activity_check")
            .insert(checks);

        if (checkError) throw checkError;

        alert(`✅ สร้างกิจกรรมสำเร็จ และเพิ่มนักเรียนทั้งหมด ${students.length} คน`);
        form.reset();

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาด: " + (err.message || JSON.stringify(err)));
    }
}





// -------------------------------------------------------------
// *โหลดข้อมูล Major ทั้งหมด*
// -------------------------------------------------------------
async function fetchAllMajors() {
    console.log('Fetching all majors...');
    const { data: majors, error } = await supabaseClient
        .from('major')
        .select('id, name, level');

    if (error) {
        console.error('Error fetching majors:', error.message);
        alert('ไม่สามารถโหลดข้อมูลสาขาได้');
        return [];
    }

    console.log(`Loaded majors: ${majors.length} items`);
    return majors;
}
async function fetchClasses(level, majorId, year) {
    let classQuery = supabaseClient.from("class").select("id, class_name, major_id, year");

    // กรองตาม major_id
    if (majorId) {
        classQuery = classQuery.eq("major_id", parseInt(majorId, 10));
    } else if (level) {
        // ถ้าไม่มี majorId แต่เลือก level → ดึง major_ids ตาม level
        const { data: majors, error: majorError } = await supabaseClient
            .from("major")
            .select("id")
            .eq("level", level);
        if (majorError) throw majorError;

        const majorIds = majors.map(m => m.id);
        if (majorIds.length > 0) {
            classQuery = classQuery.in("major_id", majorIds);
        }
    }

    // กรองตาม year
    if (year) {
        classQuery = classQuery.eq("year", parseInt(year, 10));
    }

    const { data: classes, error } = await classQuery;
    if (error) throw error;
    return classes || [];
}

// -------------------------------------------------------------
// *อัปเดต dropdown ของ Class*
// -------------------------------------------------------------
async function updateClassDropdown() {
    const year = document.getElementById('studentYear').value;
    const level = document.getElementById('level').value; // ดึงระดับมาเช็ค
    const classSelect = document.getElementById('studentClass');
    
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!year || !level) return;

    // ล็อก major_id อัตโนมัติ (ปวส = 1, ปวช = 2)
    const majorId = (level === 'ปวส.') ? "1" : "2";

    try {
        let { data: classes, error } = await supabaseClient
            .from("class")
            .select("id, class_name")
            .eq("major_id", majorId) // ค้นหาด้วย varchar
            .eq("year", parseInt(year));

        if (error) throw error;

        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.class_name;
            classSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching classes:", err);
    }
}

// -------------------------------------------------------------
// *อัปเดต dropdown สาขาและปีตามระดับที่เลือก*
// -------------------------------------------------------------
function handleLevelChange(selectedLevel, majors) {
    const departmentSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');

    // รีเซ็ตค่าเดิม
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    yearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';

    if (!selectedLevel) return;

    // 1. แสดงสาขาตามระดับที่เลือก
    const filteredMajors = majors.filter(m => m.level === selectedLevel);
    filteredMajors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        departmentSelect.appendChild(option);
    });

    // 2. แสดงชั้นปีตามระดับ (ต้องระบุตรงนี้เพื่อให้ช่องชั้นปีมีข้อมูล)
    let years = (selectedLevel === 'ปวช.') ? [1, 2, 3] : [1, 2];

    years.forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = `ชั้นปีที่ ${y}`;
        yearSelect.appendChild(option);
    });

    // ผูก Event เพิ่มเติมเพื่อให้ Dropdown ห้องอัปเดตเมื่อเลือกปี
    yearSelect.addEventListener('change', updateClassDropdown);
}

// -------------------------------------------------------------
// *เริ่มต้นเมื่อ DOM โหลดเสร็จ*
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    
    const levelSelect = document.getElementById('level');
    const yearSelect = document.getElementById('studentYear');
    const departmentSelect = document.getElementById('department');

    if (levelSelect && yearSelect) {
        levelSelect.addEventListener('change', (e) => {
            const selectedLevel = e.target.value;
            
            // รีเซ็ตค่าชั้นปีและสาขาทุกครั้งที่เปลี่ยนระดับ เพื่อป้องกันตัวเลือกซ้ำซ้อน
            yearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';
            document.getElementById('studentClass').innerHTML = '<option value="">เลือกห้อง</option>';

            if (!selectedLevel) {
                departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
                return;
            }

            // กำหนด major_id ตามระดับที่เลือก (1 = ปวส, 2 = ปวช)
            let majorId = "";
            let majorName = "";
            if (selectedLevel === 'ปวส.') {
                majorId = "1";
                majorName = "เทคโนโลยีคอมพิวเตอร์ (ปวส.)";
            } else if (selectedLevel === 'ปวช.') {
                majorId = "2";
                majorName = "เทคโนโลยีคอมพิวเตอร์ (ปวช.)";
            }
            
            // อัปเดตช่องสาขา (ที่ disabled ไว้) ให้แสดงชื่อและมี value ตรงกับ DB
            departmentSelect.innerHTML = `<option value="${majorId}" selected>${majorName}</option>`;

            // สร้างตัวเลือกชั้นปี (ปวช. 3 ปี / ปวส. 2 ปี)
            let maxYear = (selectedLevel === 'ปวช.') ? 3 : 2;
            for (let i = 1; i <= maxYear; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `ชั้นปีที่ ${i}`;
                yearSelect.appendChild(option);
            }
        });

        // เมื่อเลือกชั้นปี ให้ไปดึงรายชื่อห้องมาแสดง
        yearSelect.addEventListener('change', updateClassDropdown);
    }

    // --- (ตั้งค่า Flatpickr และ Event Submit ตามเดิม) ---
    flatpickr(".flatpickr-thai", { locale: "th", dateFormat: "Y-m-d", altInput: true, altFormat: "d F Y" });
    flatpickr(".flatpickr-time", { enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i", altInput: true, altFormat: "H:i น.", minuteIncrement: 1 });

    const form = document.getElementById('createActivityForm');
    if (form) form.addEventListener('submit', handleCreateActivity);
});