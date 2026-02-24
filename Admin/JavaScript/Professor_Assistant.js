// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';
// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let departmentSelect;
let levelSelect;
let dataTableBody;
let studentYearSelect; 
let classNumberSelect; 
let allMajors = []; 
let allClasses = []; 
let selectedMajorId = null;

async function populateFilters() {
    console.log('Fetching initial data for filters...');
    
    // 1. ดึงข้อมูล Majors
    const { data: majors, error: majorError } = await supabaseClient
        .from('major')
        .select('id, name, level');
    if (majorError) { console.error('Error fetching majors:', majorError.message); return; }
    allMajors = majors; 

    // 2. ดึงข้อมูล Classes ทั้งหมด
    const { data: classes, error: classError } = await supabaseClient
        .from('class')
        .select('major_id, year, class_number');
    if (classError) { console.error('Error fetching classes:', classError.message); return; }
    allClasses = classes;

   // A. Populate ระดับ (Level) Filter
    const uniqueLevels = [...new Set(majors.map(m => m.level?.trim()).filter(Boolean))];

    levelSelect.innerHTML = '<option value="">เลือกระดับ</option>';

    uniqueLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelSelect.appendChild(option);
    });

    // B. ล้าง Major/Year/Class Number Filter
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    studentYearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';
    classNumberSelect.innerHTML = '<option value="">เลือกห้อง</option>';
}

/** ฟังก์ชันจัดการเมื่อ Level ถูกเปลี่ยน */
function handleLevelChange() {
    updateMajorFilter();
    updateYearFilter(); 
    updateClassNumberFilter(); 
    fetchAndRenderStudents();
}

/** ฟังก์ชันจัดการเมื่อ Major ถูกเปลี่ยน */
function handleMajorChange() {
    const selectedLevel = levelSelect.value;
    const selectedMajorName = departmentSelect.value;

    const major = allMajors.find(m => m.name === selectedMajorName && m.level?.trim().replace('.', '') === selectedLevel.trim().replace('.', '')
);
    selectedMajorId = major ? major.id : null;

    updateClassNumberFilter();
    fetchAndRenderStudents();
}

/** 1. กรองตัวเลือกชั้นปี (Year) ตามระดับที่เลือก */
function updateYearFilter() {
    const selectedLevel = levelSelect.value;
    const previousYear = studentYearSelect.value; 
    studentYearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';

    if (!selectedLevel || !allMajors.length || !allClasses.length) {
        return; 
    }

    const majorIds = allMajors
        .filter(m => m.level.trim() === selectedLevel.trim())
        .map(m => m.id);

    // ดึงปีที่ไม่ซ้ำกันที่เกี่ยวข้องกับระดับที่เลือก
    const uniqueYears = [...new Set(
        allClasses
            .filter(c => majorIds.includes(c.major_id))
            .map(c => c.year)
    )].sort((a, b) => a - b); 

    uniqueYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `ปี ${year}`;
        if (year.toString() === previousYear) {
            option.selected = true;
        }
        studentYearSelect.appendChild(option);
    });
}

/** 2. กรองตัวเลือกสาขา (Major) ตามระดับ */
function updateMajorFilter() {
    const selectedLevel = levelSelect.value;
    const previousMajor = departmentSelect.value;
    
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';

    if (selectedLevel) {
        // กรอง Majors ที่ Level ตรงกับที่เลือก
        const filteredMajors = allMajors.filter(m => 
            // ตรวจสอบทั้งค่า null/undefined และใช้ .trim()
            m.level && m.level.trim() === selectedLevel.trim()
        );
        
        // ถ้า filteredMajors เป็น 0 จะไม่แสดงอะไรเลย
        if (filteredMajors.length === 0) {
            console.warn(`No majors found for level: ${selectedLevel.trim()}`);
            return;
        }

        const uniqueMajorNames = [...new Set(filteredMajors.map(m => m.name))];

        uniqueMajorNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === previousMajor) {
                option.selected = true;
            }
            departmentSelect.appendChild(option);
        });
    }
}

/** 3. กรองตัวเลือกห้อง (Class Number) */
function updateClassNumberFilter() {
    const selectedYear = studentYearSelect.value;
    const selectedMajorName = departmentSelect.value;
    const selectedLevel = levelSelect.value;

    classNumberSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    const major = allMajors.find(m => m.name === selectedMajorName && m.level.trim() === selectedLevel.trim());
    const targetMajorId = major ? major.id : null;

    if (targetMajorId && selectedYear) {
        const filteredClasses = allClasses.filter(c => 
            c.major_id === targetMajorId && 
            c.year.toString() === selectedYear
        );

        const uniqueClassNumbers = [...new Set(filteredClasses.map(c => c.class_number))]
            .sort((a, b) => a - b); 

        uniqueClassNumbers.forEach(number => {
            const option = document.createElement('option');
            option.value = number;
            option.textContent = `ห้อง ${number}`;
            classNumberSelect.appendChild(option);
        });
    }


}


async function fetchAndRenderStudents() {
    const selectedMajorName = departmentSelect.value;
    const selectedLevel = levelSelect.value;
    const selectedYear = studentYearSelect.value; 
    const selectedClassNumber = classNumberSelect.value; 

    // ใช้ชื่อ Foreign Key 'class_id' และ 'major_id' ในการ Join
    let classSelectString = `class_id!inner( 
        year, 
        class_number, 
        major_id!inner (name, level) 
    )`; 
    
    let query = supabaseClient
        .from('student')
        .select(`id, name, role, ${classSelectString}`);

    // กรองตามเงื่อนไข
    if (selectedMajorName) {
        query = query.eq('class_id.major_id.name', selectedMajorName); 
    }
    if (selectedLevel) {
        query = query.like('class_id.major_id.level', selectedLevel.trim().replace('.', '') + '%');


    }
    if (selectedYear) {
        query = query.eq('class_id.year', parseInt(selectedYear));
    }
    if (selectedClassNumber) {
        query = query.eq('class_id.class_number', parseInt(selectedClassNumber));
    }

    const { data: students, error } = await query.order('id', { ascending: true }); 

    if (error) {
        console.error('Error fetching student data:', error.message);
        dataTableBody.innerHTML = `<tr><td colspan="6">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}</td></tr>`; 
        return;
    }

    // Render Data
    dataTableBody.innerHTML = ''; 

    if (students.length === 0) {
        dataTableBody.innerHTML = '<tr><td colspan="6">ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก</td></tr>'; 
        return;
    }

    const roleMap = { 'Student': 'นักเรียน', 'Leader': 'ผู้ช่วยอาจารย์' };
    const availableRoles = ['Student', 'Leader'];

    students.forEach(student => {
        const classData = student.class_id; 
        
        // ตรวจสอบความสมบูรณ์ของข้อมูลก่อน Render
        if (!classData || !classData.major_id) { 
            console.warn(`Student ID ${student.id} has incomplete class or major data and was skipped.`);
            return;
        }

        const majorData = classData.major_id; 
        const row = dataTableBody.insertRow();
        
        // 1. ชื่อ
        row.insertCell().textContent = student.name;
        // 2. ระดับ
        row.insertCell().textContent = majorData.level; 
        // 3. ชั้นปี 
        row.insertCell().textContent = classData.year;
        // 4. ห้อง 
        row.insertCell().textContent = classData.class_number; 
        // 5. รหัสนักศึกษา
        row.insertCell().textContent = student.id; 

        // 6. บทบาท (Role Select Dropdown)
        const roleCell = row.insertCell();
        const roleSelect = document.createElement('select');
        roleSelect.className = 'role-select';
        roleSelect.dataset.studentId = student.id; 

        availableRoles.forEach(roleKey => {
            const option = document.createElement('option');
            option.value = roleKey;
            option.textContent = roleMap[roleKey] || roleKey; 
            if (roleKey === student.role) {
                option.selected = true;
            }
            roleSelect.appendChild(option);
        });

        roleSelect.addEventListener('change', handleRoleUpdate);
        roleCell.appendChild(roleSelect);
    });

    console.log(`Students loaded successfully: ${students.length} items`);
}

/** ฟังก์ชันจัดการเมื่อมีการเปลี่ยนบทบาท (Role) */
async function handleRoleUpdate(event) {
    const selectElement = event.target;
    const studentId = selectElement.dataset.studentId;
    const newRole = selectElement.value;

    if (!confirm(`แน่ใจที่จะเปลี่ยนบทบาทของรหัส ${studentId} เป็น ${selectElement.options[selectElement.selectedIndex].textContent} หรือไม่?`)) {
        await fetchAndRenderStudents(); 
        return;
    }
try {
        const { error: studentUpdateError } = await supabaseClient
            .from('student')
            .update({ role: newRole })
            .eq('id', studentId);

       if (studentUpdateError) {
            console.error('Error updating student role:', studentUpdateError.message);
            if (studentUpdateError.message.includes('Cannot have more than 2 Leaders per class')) {
                alert(`ไม่สามารถอัปเดตบทบาทได้: ห้องเรียนนี้เต็มโควต้าหัวหน้า (จำกัด 2 คน)`);
            } else {
                alert(`ไม่สามารถอัปเดตบทบาทได้: ${studentUpdateError.message}`);
            }
            await fetchAndRenderStudents();
            return;
        }
        alert(`อัปเดตบทบาทของรหัส ${studentId} สำเร็จเป็น ${selectElement.options[selectElement.selectedIndex].textContent}`);
    } catch (e) {
        console.error('Update Error:', e);
        alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    departmentSelect = document.getElementById('department');
    levelSelect = document.getElementById('level');
    studentYearSelect = document.getElementById('studentYear'); 
    classNumberSelect = document.getElementById('classNumber'); 
    dataTableBody = document.querySelector('.data-table tbody');

    if (!departmentSelect || !levelSelect || !studentYearSelect || !classNumberSelect || !dataTableBody) { 
        console.error("Critical Error: One or more required DOM elements were not found.");
        return; 
    }

    populateFilters();
    fetchAndRenderStudents(); 

    levelSelect.addEventListener('change', handleLevelChange);
    departmentSelect.addEventListener('change', handleMajorChange);
    studentYearSelect.addEventListener('change', () => {
        updateClassNumberFilter();
        fetchAndRenderStudents();
    });
    classNumberSelect.addEventListener('change', fetchAndRenderStudents);
});