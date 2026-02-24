/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';
const supabaseCilent = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

/* ====== HELPERS ====== */
const $ = sel => document.querySelector(sel);
let allMajors = []; // เก็บข้อมูลสาขาที่โหลดมาทั้งหมด
let allClassesData = []; // เก็บข้อมูล Class ทั้งหมด
let globalIsoDate;
let globalSemester;
let globalAcademicYear;

function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}

function formatTimeISO(d) {
    if (!d) return '';

    // 1. สร้าง Date object จาก timestamp ที่ได้มา
    // (JavaScript จะเข้าใจอัตโนมัติว่านี่คือเวลา UTC และเก็บไว้)
    const dateObj = new Date(d);

    // 2. ดึง "ชั่วโมง" และ "นาที" ตามเวลาท้องถิ่น (Local Time) ของเครื่องผู้ใช้
    // (คำสั่ง .getHours() จะแปลงจาก UTC เป็น Local ให้อัตโนมัติ)
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    // 3. คืนค่าเป็น "HH:mm"
    return `${hours}:${minutes}`;
}

function parseDisplayDateToISO(display) {
    if (!display) return null;
    const parts = display.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(p => p.trim());
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/* ====== LOADERS / RENDER (Logic ใหม่ที่ผสานแล้ว) ====== */

async function fetchAllMajorsAndClasses() {
    const { data: majors, error: majorError } = await supabaseCilent
        .from('major')
        .select('id, name, level');
    if (majorError) { console.error('Error fetching majors:', majorError.message); return; }
    allMajors = majors;

    const { data: classes, error: classError } = await supabaseCilent
        .from('class')
        .select('id, class_name, major_id, year, class_number');
    if (classError) { console.error('Error fetching classes:', classError.message); return; }
    allClassesData = classes;
}

// 1. อัปเดต Dropdown สาขา (Department) ตามระดับ (Level)
function updateDepartmentOptions(selectedLevel, currentMajorId = null) {
    const departmentSelect = document.getElementById('department');
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';

    if (!selectedLevel) return;

    const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
    filteredMajors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        // 💡 เลือกค่าที่โหลดมา
        if (m.id.toString() === currentMajorId?.toString()) {
            option.selected = true;
        }
        departmentSelect.appendChild(option);
    });
}

// 2. อัปเดต Dropdown ปี (Year) ตามระดับ (Level)
function updateYearOptions(selectedLevel, currentYear = null) {
    const yearSelect = document.getElementById('studentYear');
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';

    if (!selectedLevel) return;

    let years = [];
    if (selectedLevel === 'ปวช.') {
        years = [1, 2, 3];
    } else if (selectedLevel === 'ปวส.') {
        years = [1, 2];
    }

    years.forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        // 💡 เลือกค่าที่โหลดมา
        if (y.toString() === currentYear?.toString()) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    });
}

// 3. อัปเดต Dropdown ห้อง (Class Number) ตาม Major/Year
async function fetchStudentClass(currentClassId = null) {
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;
    const classSelect = document.getElementById('studentClass');
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!majorId || !year) return;

    try {
        const { data: classes, error } = await supabaseCilent
            .from('class')
            .select('id, class_name, class_number')
            .eq('major_id', majorId) // ค้นหาด้วย varchar
            .eq('year', year);

        if (error) throw error;

        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.class_name ? c.class_name : `ห้อง ${c.class_number}`;
            if (c.id.toString() === currentClassId?.toString()) {
                option.selected = true;
            }
            classSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching classes:", err);
    }
}

function attachRadioToggleBehavior(container = document) {
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (radio.dataset.listenerAttached === "true") return;
        radio.addEventListener('click', function (event) {
            if (this.dataset.waschecked === "true") {
                event.preventDefault();
                const that = this;
                setTimeout(() => {
                    that.checked = false;
                    that.dataset.waschecked = "false";
                }, 0);
            } else {
                const group = container.querySelectorAll(`input[name="${this.name}"]`);
                group.forEach(r => r.dataset.waschecked = "false");
                this.dataset.waschecked = "true";
            }
        });
        radio.dataset.listenerAttached = "true";
    });
}

async function loadAttendanceTable(activityIdLocal) {
    const tableBody = document.querySelector('.attendance-table tbody');
    tableBody.innerHTML = '';

    try {
        const { data, error } = await supabaseCilent
            .from('activity_check')
            .select('id,semester,student:student_id (id,name),status,date,academic_year')
            .eq('activity_id', activityIdLocal)
            .order('student_id', { ascending: true });

        if (error) throw error;
        const statusMap = { 'Attended': 'present', 'Absent': 'absent', 'Excused': 'late' };

        data.forEach((record) => {
            const indexId = record.id;
            const studentName = record.student?.name || '-';
            const studentId = record.student?.id || '-';
            const status = statusMap[record.status] || '';

            const tr = document.createElement('tr');
            tr.dataset.recordId = record.id;
            const radioName = `status_${record.id}`;

            tr.innerHTML = `
                <td style="text-align:left; padding-left:8px">${studentName}</td>
                <td>${studentId}</td>
                <td>
                    <input type="radio" name="${radioName}"  id="present_${indexId}" value="present" ${status === 'present' ? 'checked' : ''} disabled>
                    <label for="present_${indexId}" class="present-btn"></label>
                </td>
                <td>
                    <input type="radio" name="${radioName}" id="absent_${indexId}" value="absent" ${status === 'absent' ? 'checked' : ''} disabled>
                    <label for="absent_${indexId}" class="absent-btn"></label>
                </td>
                `;
            tableBody.appendChild(tr);
        });

        attachRadioToggleBehavior(tableBody);
    } catch (err) {
        console.error('loadAttendanceTable error', err);
    }
}

/* ====== ACTIONS ====== */

async function loadActivity() {
    if (!activityId) return;

    try {
        // ดึง major_id ออกมาด้วย
        const { data: activity, error } = await supabaseCilent
            .from('activity')
            .select(`
                id, name, activity_type, start_time, end_time, is_recurring, 
                class_id, major_id,
                class:class_id ( year, class_number )
            `)
            .eq('id', activityId)
            .single();

        if (error) throw error;

        // ดึงข้อมูล activity_check เพื่อหาเทอม
        const { data: activity_check, error: actErr } = await supabaseCilent
            .from('activity_check')
            .select('date,semester')
            .eq('activity_id', activityId)
            .limit(1);

        let initialDate = activity.start_time;
        let initialSemester = null;
        if (!actErr && activity_check && activity_check.length > 0) {
            initialDate = activity_check[0].date;
            initialSemester = activity_check[0].semester;
        }

        // เซ็ตค่าฟอร์มพื้นฐาน
        setValue('activityName', activity.name || '');
        setValue('activityType', activity.activity_type || 'activity');
        setValue('recurringDays', activity.is_recurring ? 1 : 0);
        setValue('semester', initialSemester || '');

        // หา Level จาก major_id
        let initialLevel = '';
        if (activity.major_id === '1') initialLevel = 'ปวส.';
        else if (activity.major_id === '2') initialLevel = 'ปวช.';

        const initialYear = activity.class?.year || '';
        const initialClassId = activity.class_id || '';

        // ตั้งค่า Flatpickr
        if (window.flatpickr) {
            const isCheckPage = window.location.pathname.includes('Check_activities');
            const defaultDate = initialDate ? new Date(initialDate) : null;
            const defaultStartTime = activity.start_time ? formatTimeISO(activity.start_time) : null;
            const defaultEndTime = activity.end_time ? formatTimeISO(activity.end_time) : null;

            flatpickr("#activityDate", { dateFormat: "d/m/Y", locale: "th", defaultDate: defaultDate, disabled: isCheckPage });
            flatpickr("#startTime", { enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i", altInput: true, altFormat: "H:i น.", locale: "th", defaultDate: defaultStartTime, disabled: isCheckPage });
            flatpickr("#endTime", { enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i", altInput: true, altFormat: "H:i น.", locale: "th", defaultDate: defaultEndTime, disabled: isCheckPage });
        }

        // ตั้งค่า Dropdown ทั้งหมดให้ถูกต้อง
        setValue('level', initialLevel);
        handleLevelChange(initialLevel);
        setValue('studentYear', initialYear);
        await fetchStudentClass(initialClassId);

        // โหลดตารางนักเรียน
        await loadAttendanceTable(activityId);

        // เซ็ตตัวแปร Global สำหรับหน้า Check
        if (typeof globalIsoDate !== 'undefined') {
            globalSemester = initialSemester;
            const tempDate = new Date(initialDate);
            globalIsoDate = tempDate.toISOString().split('T')[0];
            globalAcademicYear = tempDate.getFullYear() + 543;
        }

    } catch (err) {
        console.error('loadActivity error', err);
    }
}


function handleLevelChange(selectedLevel) {
    const departmentSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');
    const classSelect = document.getElementById('studentClass');

    // รีเซ็ตค่า
    yearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!selectedLevel) {
        departmentSelect.value = '';
        return;
    }

    // ล็อก Major ตาม Level (1 = ปวส, 2 = ปวช)
    if (selectedLevel === 'ปวส.') {
        departmentSelect.value = '1';
        yearSelect.innerHTML += '<option value="1">ชั้นปีที่ 1</option><option value="2">ชั้นปีที่ 2</option>';
    } else if (selectedLevel === 'ปวช.') {
        departmentSelect.value = '2';
        yearSelect.innerHTML += '<option value="1">ชั้นปีที่ 1</option><option value="2">ชั้นปีที่ 2</option><option value="3">ชั้นปีที่ 3</option>';
    }
}



/* ====== INIT ====== */
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. ดึงแถวนักศึกษาทั้งหมดในตาราง
            const rows = Array.from(document.querySelectorAll('.attendance-table tbody tr'));
            
            // 💡 2. ตรวจสอบว่าทุกคนถูกเลือกสถานะหรือยัง (Validation)
            // ใช้ .some() เพื่อหาว่ามีแถวไหนที่ยังไม่ได้ติ๊กเลือก (checked เป็น null) หรือไม่
            const incomplete = rows.some(row => {
                const checked = row.querySelector('input[type="radio"]:checked');
                return !checked; 
            });

            if (incomplete) {
                alert('⚠️ กรุณาเช็กชื่อนักศึกษาให้ครบทุกคนก่อนกดบันทึก');
                return; // หยุดการทำงานทันที ไม่ส่งข้อมูลไปฐานข้อมูล
            }

            // 💡 3. แสดงหน้าจอรอโหลด (ต้องมี Element id="loadingOverlay" ใน HTML)
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.style.display = 'flex';

            const isEditPage = window.location.pathname.includes('Edit_activity');
            let isoDate = null;
            let semester = null;
            let academicYear = null;

            try {
                // เตรียมข้อมูลการแก้ไข (เฉพาะหน้า Edit)
                if (isEditPage) {
                    const activityDateDisplay = document.getElementById('activityDate').value.trim();
                    isoDate = parseDisplayDateToISO(activityDateDisplay);
                    if (!isoDate) { alert('วันที่ไม่ถูกต้อง'); return; }

                    const startTime = document.getElementById('startTime').value;
                    const endTime = document.getElementById('endTime').value;

                    const [y, m, d] = isoDate.split('-').map(Number);
                    const [sh, sm] = startTime.split(':').map(Number);
                    const [eh, em] = endTime.split(':').map(Number);
                    const start_time_iso = new Date(y, m - 1, d, sh, sm).toISOString();
                    const end_time_iso = new Date(y, m - 1, d, eh, em).toISOString();

                    const level = document.getElementById('level').value;
                    const majorId = (level === 'ปวส.') ? '1' : (level === 'ปวช.' ? '2' : null);
                    const classId = document.getElementById('studentClass').value || null;

                    const recurringInput = document.getElementById('recurringDays');
                    const recurringDays = recurringInput ? parseInt(recurringInput.value || '0', 10) : 0;
                    const isRecurringInt = recurringDays > 0 ? 1 : 0;

                    semester = parseInt(document.getElementById('semester').value || '0', 10);
                    academicYear = new Date(isoDate).getFullYear() + 543;

                    if (!semester || !level) {
                        alert('กรุณากรอกข้อมูลให้ครบถ้วน'); return;
                    }

                    // อัปเดตตาราง Activity
                    const { error: updateError } = await supabaseCilent
                        .from('activity')
                        .update({
                            name: document.getElementById('activityName').value.trim(),
                            activity_type: document.getElementById('activityType').value,
                            start_time: start_time_iso,
                            end_time: end_time_iso,
                            is_recurring: isRecurringInt,
                            class_id: classId,
                            major_id: majorId
                        })
                        .eq('id', activityId);

                    if (updateError) throw updateError;
                }

                // 4. ส่งข้อมูลอัปเดตสถานะนักศึกษาทุกคนพร้อมกัน (Parallel Update)
                const statusMap = { present: 'Attended', absent: 'Absent', late: 'Excused' };

                const updatePromises = rows.map(async (row) => {
                    const recordId = row.dataset.recordId;
                    if (!recordId) return;

                    const checked = row.querySelector('input[type="radio"]:checked');
                    const supaStatus = statusMap[checked.value];

                    let updateData = { status: supaStatus };

                    if (isEditPage) {
                        updateData.date = isoDate;
                        updateData.semester = semester;
                        updateData.academic_year = academicYear;
                    }

                    return supabaseCilent
                        .from('activity_check')
                        .update(updateData)
                        .eq('id', recordId);
                });

                const results = await Promise.all(updatePromises);

                const hasError = results.some(res => res && res.error);
                if (hasError) throw new Error("การบันทึกข้อมูลบางส่วนผิดพลาด");

                alert('✅ บันทึกข้อมูลเรียบร้อยแล้ว!');
                window.location.href = 'Activity_list.html';

            } catch (err) {
                console.error('submit error', err);
                alert('เกิดข้อผิดพลาด: ' + (err.message || JSON.stringify(err)));
            } finally {
                // 💡 5. ซ่อนหน้าจอรอโหลดเมื่อทำงานเสร็จ
                if (overlay) overlay.style.display = 'none';
            }
        });

        // ส่วนของการจัดการ Dropdown
        const levelSelect = document.getElementById('level');
        const studentYearSelect = document.getElementById('studentYear');

        levelSelect?.addEventListener('change', async (e) => {
            handleLevelChange(e.target.value);
            await fetchStudentClass();
        });

        studentYearSelect?.addEventListener('change', () => fetchStudentClass());

        await loadActivity();
    }
});