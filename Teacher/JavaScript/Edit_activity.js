/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseCilent = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

/* ====== HELPERS ====== */
const $ = sel => document.querySelector(sel);
let allMajors = []; 
let allClassesData = []; 

function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}

function formatTimeISO(d) {
    if (!d) return '';
    const dateObj = new Date(d);
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function parseDisplayDateToISO(display) {
    if (!display) return null;
    const parts = display.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(p => p.trim());
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/* ====== LOADERS / RENDER ====== */

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

function updateDepartmentOptions(selectedLevel, currentMajorId = null) {
    const departmentSelect = document.getElementById('department');
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    if (!selectedLevel) return;
    const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
    filteredMajors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        if (m.id.toString() === currentMajorId?.toString()) option.selected = true;
        departmentSelect.appendChild(option);
    });
}

function updateYearOptions(selectedLevel, currentYear = null) {
    const yearSelect = document.getElementById('studentYear');
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';
    if (!selectedLevel) return;
    let years = (selectedLevel === 'ปวช.') ? [1, 2, 3] : [1, 2]; // ปวส.
    years.forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        if (y.toString() === currentYear?.toString()) option.selected = true;
        yearSelect.appendChild(option);
    });
}

async function fetchStudentClass(currentClassId = null) {
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;
    const classSelect = document.getElementById('studentClass');
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!majorId || !year) return;

    const filteredClasses = allClassesData.filter(c =>
        c.major_id.toString() === majorId.toString() && c.year.toString() === year.toString()
    );

    filteredClasses.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.class_name ? c.class_name : `ห้อง ${c.class_number}`;
        if (c.id.toString() === currentClassId?.toString()) option.selected = true;
        classSelect.appendChild(option);
    });
}

function attachRadioToggleBehavior(container = document) {
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (radio.dataset.listenerAttached === "true") return;
        radio.addEventListener('click', function (event) {
            if (this.dataset.waschecked === "true") {
                event.preventDefault();
                const that = this;
                setTimeout(() => { that.checked = false; that.dataset.waschecked = "false"; }, 0);
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
                    <input type="radio" name="${radioName}" id="present_${indexId}" value="present" ${status === 'present' ? 'checked' : ''}>
                    <label for="present_${indexId}" class="present-btn"></label>
                </td>
                <td>
                    <input type="radio" name="${radioName}" id="absent_${indexId}" value="absent" ${status === 'absent' ? 'checked' : ''}>
                    <label for="absent_${indexId}" class="absent-btn"></label>
                </td>
                `;
            tableBody.appendChild(tr);
        });
        attachRadioToggleBehavior(tableBody);
    } catch (err) { console.error('loadAttendanceTable error', err); }
}

/* ====== ACTIONS ====== */

async function loadActivity() {
    if (!activityId) return;

    try {
        const { data: activity, error } = await supabaseCilent
            .from('activity')
            .select(`
                id, name, activity_type, start_time, end_time, is_recurring, class_id,
                class:class_id ( year, class_number, major:major_id ( id, name, level ) )
            `)
            .eq('id', activityId)
            .single();

        if (error) throw error;

        const classData = activity.class;
        const majorData = classData?.major;
        const initialLevel = majorData?.level;
        const initialMajorId = majorData?.id;
        const initialYear = classData?.year;
        const initialClassId = activity.class_id;

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

        setValue('activityName', activity.name || '');
        setValue('activityType', activity.activity_type || 'activity'); // ✅ โหลดประเภทกิจกรรม
        setValue('recurringDays', activity.is_recurring ? 1 : 0);
        setValue('semester', initialSemester || '');

        if (window.flatpickr) {
            const defaultDate = initialDate ? new Date(initialDate) : null;
            window._activityDatePicker = flatpickr("#activityDate", {
                dateFormat: "d/m/Y", locale: "th", defaultDate: defaultDate
            });

            const defaultStartTime = activity.start_time ? formatTimeISO(activity.start_time) : null;
            const defaultEndTime = activity.end_time ? formatTimeISO(activity.end_time) : null;

            flatpickr("#startTime", {
                enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i",
                altInput: true, altFormat: "H:i น.", locale: "th", defaultDate: defaultStartTime
            });
            flatpickr("#endTime", {
                enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i",
                altInput: true, altFormat: "H:i น.", locale: "th", defaultDate: defaultEndTime
            });
        }

        await fetchAllMajorsAndClasses();
        setValue('level', initialLevel);
        updateDepartmentOptions(initialLevel, initialMajorId);
        updateYearOptions(initialLevel, initialYear);
        await fetchStudentClass(initialClassId);
        await loadAttendanceTable(activityId);

    } catch (err) {
        console.error('loadActivity error', err);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + err.message);
    }
}

/* ====== INIT ====== */
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. รับค่าจาก Form
            const activityType = document.getElementById('activityType').value; // ✅ รับค่าประเภท
            const activityName = document.getElementById('activityName').value.trim();
            const activityDateDisplay = document.getElementById('activityDate').value.trim();
            
            // แปลงวันที่ (ถ้า HTML required ทำงาน ค่านี้จะไม่ว่างแน่นอน)
            const isoDate = parseDisplayDateToISO(activityDateDisplay); 
            
            // ❌ ลบการเช็คเงื่อนไข if (!isoDate) ออกตามคำขอ
            
            const startTime = document.getElementById('startTime').value;
            const endTime = document.getElementById('endTime').value;
            const start_time_iso = `${isoDate}T${startTime}:00`;
            const end_time_iso = `${isoDate}T${endTime}:00`;

            const classId = document.getElementById('studentClass').value || null;
            const recurringDays = parseInt(document.getElementById('recurringDays').value || '0', 10);
            const semester = parseInt(document.getElementById('semester').value || '0', 10);
            
            // คำนวณปีการศึกษา (ใช้จากวันที่จัดกิจกรรม)
            const academicYear = isoDate ? (new Date(isoDate).getFullYear() + 543) : null;

            // ❌ ลบการเช็คเงื่อนไข if (!semester || !academicYearText) ออกตามคำขอ
            // เพราะถือว่าข้อมูลมีอยู่แล้วจากตอนสร้าง หรือ HTML required บังคับไว้

            const activityData = {
                name: activityName,
                activity_type: activityType, // ✅ ส่งค่าประเภทไปอัปเดต
                start_time: start_time_iso,
                end_time: end_time_iso,
                is_recurring: (recurringDays > 0),
                class_id: classId ? parseInt(classId, 10) : null
            };

            try {
                // 1. อัปเดต Activity
                const { error: updateError } = await supabaseCilent
                    .from('activity')
                    .update(activityData)
                    .eq('id', activityId);
                if (updateError) throw updateError;

                // 2. อัปเดต activity_check
                const rows = Array.from(document.querySelectorAll('.attendance-table tbody tr'));
                const statusMap = { present: 'Attended', absent: 'Absent', late: 'Excused' };

                for (const row of rows) {
                    const recordId = row.dataset.recordId;
                    if (!recordId) continue;

                    const checked = row.querySelector('input[type="radio"]:checked');
                    const statusValue = checked ? checked.value : null;
                    const supaStatus = statusMap[statusValue] || null;

                    const { error } = await supabaseCilent
                        .from('activity_check')
                        .update({
                            status: supaStatus,
                            date: isoDate,
                            semester: semester,
                            academic_year: academicYear
                        })
                        .eq('id', recordId);

                    if (error) throw error;
                }

                alert('แก้ไขกิจกรรมและสถานะนักศึกษาเรียบร้อยแล้ว!');
                window.location.href = 'Activity_list.html';

            } catch (err) {
                console.error('submit error', err);
                alert('เกิดข้อผิดพลาด: ' + (err.message || JSON.stringify(err)));
            }
        })

        const levelSelect = document.getElementById('level');
        const departmentSelect = document.getElementById('department');
        const studentYearSelect = document.getElementById('studentYear');

        levelSelect?.addEventListener('change', async (e) => {
            const selectedLevel = e.target.value;
            updateDepartmentOptions(selectedLevel, null);
            updateYearOptions(selectedLevel, null);
            await fetchStudentClass();
        });

        departmentSelect?.addEventListener('change', () => fetchStudentClass());
        studentYearSelect?.addEventListener('change', () => fetchStudentClass());

        await loadActivity();
    }
});