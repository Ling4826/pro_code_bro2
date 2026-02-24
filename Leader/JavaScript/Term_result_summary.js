/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';

let termScoreRows = [];
let leaderClassInfo = null; // 🔥 ตัวแปรสำหรับเก็บข้อมูล Class ของผู้ใช้

// === HELPER FUNCTION: ดึงข้อมูล Class ของผู้ใช้ปัจจุบัน ===
async function getLeaderClassInfo(leaderRefId) {
    if (!leaderRefId) return null;

    const { data: studentData, error: studentError } = await supabaseClient
        .from('student')
        .select(`
            class:class_id (
                year,
                class_number, 
                major:major_id (
                    name,
                    level
                )
            )
        `)
        .eq('id', leaderRefId)
        .single(); // คาดว่า 1 user มี 1 student record

    if (studentError) {
        console.error('Error fetching leader student data:', studentError.message);
        return null;
    }

    if (studentData?.class?.major) {
        return {
            level: studentData.class.major.level,
            majorName: studentData.class.major.name,
            year: studentData.class.year.toString(),
            classNumber: studentData.class.class_number.toString()
        };
    }
    return null;
}

// === MAIN FETCH FUNCTION ===
async function fetchTermScore() {
    document.getElementById("score-body").innerHTML = `
        <tr><td colspan="8" style="padding: 20px; color: #666; text-align:center;">กำลังดึงข้อมูล...</td></tr>
    `;

    // 1. 🔥 ดึง Ref ID และหา Class Info ของห้องเรียนของผู้ใช้ (เพื่อใช้เป็นค่า Default Filter)
    const refId = sessionStorage.getItem('ref_id');
    leaderClassInfo = await getLeaderClassInfo(refId);

    if (!leaderClassInfo) {
        // หากหาข้อมูลผู้ใช้ไม่เจอ ให้ Log แต่ยังคงดึงข้อมูลทั้งหมดมาแสดงได้
        console.warn("Could not determine leader's class information. Displaying all data with default filter.");
    }

    // 2. ดึงข้อมูลนักเรียนทั้งหมด (ตามที่คุณต้องการ "ดึงมาทั้งหมด")
    const { data, error } = await supabaseClient
        .from('term_score')
        .select(`
            id,
            semester,
            academic_year,
            student:student_id (
                id,
                name,
                class:class_id (
                    id,
                    year,
                    class_number, 
                    major:major_id (
                        id,
                        name,
                        level
                    )
                ),
                activity_check (
                    id,
                    status,
                    activity:activity_id ( 
                        activity_type 
                    )
                )
            )
        `);

    if (error) {
        console.error("ERROR >", error);
        document.getElementById("score-body").innerHTML = `
            <tr><td colspan="8" style="color: red; text-align:center;">เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}</td></tr>
        `;
        return null;
    }
    data.sort((a, b) => {
        // b.academic_year.localeCompare(a.academic_year) จะทำให้ปีล่าสุดมาก่อน
        if (a.academic_year !== b.academic_year) {
            return b.academic_year.localeCompare(a.academic_year);
        }
        // ถ้าปีการศึกษาเท่ากัน ให้เรียงตาม semester (เทอมสูงสุดมาก่อน)
        return b.semester - a.semester;
    });

    const uniqueRowsMap = new Map();
data.forEach(row => {
        const studentId = row.student?.id;
        // หาก Student ID นี้ยังไม่ถูกบันทึกใน Map (หมายความว่าเป็นเทอมล่าสุดที่เจอ) ให้บันทึกไว้
        if (studentId && !uniqueRowsMap.has(studentId)) {
            uniqueRowsMap.set(studentId, row);
        }
    });
const uniqueData = Array.from(uniqueRowsMap.values());
    // 3. ประมวลผลข้อมูล (Logic เดิม)
    termScoreRows = uniqueData.map(row => {// 💡 เปลี่ยน data.map เป็น uniqueData.map
        const student = row.student;
        const classInfo = student?.class;
        const major = classInfo?.major;
        const checks = student?.activity_check || [];

        // 1. นับจำนวน (Counts)
        const flagList = checks.filter(c => c.activity?.activity_type === 'flag_ceremony');
        const flagTotal = flagList.length;
        const flagAttended = flagList.filter(c => c.status === 'Attended').length;

        const deptList = checks.filter(c => c.activity?.activity_type === 'activity');
        const deptTotal = deptList.length;
        const deptAttended = deptList.filter(c => c.status === 'Attended').length;

        // 2. คำนวณเปอร์เซ็นต์เองใน JS (เพื่อให้เป็นปัจจุบันที่สุด)
        const calcFlagPercent = flagTotal > 0 ? (flagAttended / flagTotal) * 100 : 0;
        const calcDeptPercent = deptTotal > 0 ? (deptAttended / deptTotal) * 100 : 0;

        // 3. คำนวณผลการผ่านเอง (เกณฑ์ 80%)
        const isPassedCalc = (calcFlagPercent >= 80) && (calcDeptPercent >= 80);

        return {
            id: row.id,
            student_id: student?.id ?? "-",
            studentName: student?.name ?? "-",
            majorName: major?.name ?? "-",
            level: major?.level ?? "-",
            year: classInfo?.year ?? "-",
            classNumber: classInfo?.class_number ?? "-",

            flagText: `${flagAttended}/${flagTotal}`,
            deptText: `${deptAttended}/${deptTotal}`,

            flagAttended, flagTotal,
            deptAttended, deptTotal,

            percentFlag: parseFloat(calcFlagPercent.toFixed(2)),
            percentActivity: parseFloat(calcDeptPercent.toFixed(2)),
            isPassed: isPassedCalc
        };
    });

    initFilters();
    // 💡 renderFilteredTable ถูกเรียกใน initFilters() แล้ว
}

/* ====== FILTER LOGIC & RENDERING (แก้ไข initFilters) ====== */

function initFilters() {
    // 1. สร้าง Dropdowns โดยใช้ข้อมูลทั้งหมดที่ดึงมา
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");

    // 2. 🔥🔥🔥 กำหนดค่าเริ่มต้นตามข้อมูลคนที่ล็อกอิน 🔥🔥🔥
    if (leaderClassInfo) {
        const initialLevel = leaderClassInfo.level;
        const initialMajor = leaderClassInfo.majorName;
        const initialClassNumber = leaderClassInfo.classNumber;

        // a. ตั้งค่า Level ก่อน
        const levelSelect = document.getElementById("level");
        if (uniqueLevels.includes(initialLevel)) {
            levelSelect.value = initialLevel;
        }

        // b. อัปเดต Major Dropdown และตั้งค่า Major
        updateMajorDropdown();
        const departmentSelect = document.getElementById("department");
        if (departmentSelect && [...departmentSelect.options].map(o => o.value).includes(initialMajor)) {
            departmentSelect.value = initialMajor;
        }

        // c. อัปเดต Year/Room Dropdowns และตั้งค่า Room
        updateYearAndRoomDropdown();
        const classNumberSelect = document.getElementById("classNumber");
        if (classNumberSelect && [...classNumberSelect.options].map(o => o.value).includes(initialClassNumber)) {
            classNumberSelect.value = initialClassNumber;
        }

        // d. หากมี Year ที่ต้องการกรองเพิ่มเติม (ถ้ามี)
        // const studentYearSelect = document.getElementById("studentYear");
        // if (studentYearSelect && [...studentYearSelect.options].map(o => o.value).includes(leaderClassInfo.year)) {
        //     studentYearSelect.value = leaderClassInfo.year;
        // }

    }
    // 🔥🔥🔥 สิ้นสุดการกำหนดค่าเริ่มต้น 🔥🔥🔥

    // 3. ตั้งค่า Event Listeners
    document.getElementById("level").addEventListener("change", () => { updateMajorDropdown(); updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("department").addEventListener("change", () => { updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("studentYear").addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber").addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput").addEventListener("input", renderFilteredTable);

    // 4. เรียก Render ครั้งสุดท้าย (เพื่อแสดงผลที่ถูก Filter ตามค่าเริ่มต้น/ค่าล็อกอิน)
    renderFilteredTable();
}

function updateMajorDropdown() {
    const levelSelect = document.getElementById("level");
    const filteredRows = levelSelect.value ? termScoreRows.filter(r => r.level === levelSelect.value) : termScoreRows;
    const uniqueMajors = [...new Set(filteredRows.map(r => r.majorName))].sort();
    fillSelect("department", uniqueMajors, "ทุกสาขาวิชา");
}

function updateYearAndRoomDropdown() {
    const level = document.getElementById("level").value;
    const major = document.getElementById("department").value;
    let filteredRows = termScoreRows;
    if (level) filteredRows = filteredRows.filter(r => r.level === level);
    if (major) filteredRows = filteredRows.filter(r => r.majorName === major);

    const uniqueYears = [...new Set(filteredRows.map(r => r.year))].sort((a, b) => a - b);
    const uniqueRooms = [...new Set(filteredRows.map(r => r.classNumber))].sort((a, b) => a - b);

    fillSelect("studentYear", uniqueYears, "ทุกชั้นปี", "ปี ");
    fillSelect("classNumber", uniqueRooms, "ทุกห้อง", "ห้อง ");
}

function fillSelect(elementId, items, placeholder, prefix = "") {
    const select = document.getElementById(elementId);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        if (item !== "-" && item != null) {
            const option = document.createElement("option");
            option.value = item;
            option.textContent = prefix + item;
            select.appendChild(option);
        }
    });
    if (items.includes(Number(currentVal)) || items.includes(currentVal)) select.value = currentVal;
}

function getFilteredRows() {
    let rows = [...termScoreRows];
    const level = document.getElementById("level").value;
    const department = document.getElementById("department").value;
    const year = document.getElementById("studentYear").value;
    const room = document.getElementById("classNumber").value;
    const searchName = document.getElementById("searchInput").value.toLowerCase();

    if (level) rows = rows.filter(r => r.level === level);
    if (department) rows = rows.filter(r => r.majorName === department);
    if (year) rows = rows.filter(r => r.year == year);
    if (room) rows = rows.filter(r => r.classNumber == room);
    if (searchName) rows = rows.filter(r => r.studentName.toLowerCase().includes(searchName));
    return rows;
}

/* ====== RENDER TABLE & POPUP ====== */

function renderFilteredTable() {
    const filtered = getFilteredRows();
    const tbody = document.getElementById("score-body");

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        // ใช้ row.isPassed ที่เราคำนวณใหม่
        const passBadge = row.isPassed
            ? '<span class="status-badge status-pass">ผ่าน</span>'
            : '<span class="status-badge status-fail">ไม่ผ่าน</span>';

        return `
        <tr style="cursor: pointer;" onclick="openStudentModal('${row.id}')">
            <td>${row.student_id}</td>
            <td style="font-weight: bold; color: #007bff;">${row.studentName}</td>
            <td>${row.majorName}</td>
            <td>${row.year}</td>
            <td>${row.classNumber}</td>
            
            <td style="text-align:center;">
                <div style="font-weight:bold; font-size:1.1em;">${row.flagText}</div>
                <div style="font-size:0.85em; color:#666;">(${row.percentFlag}%)</div>
            </td>     
            
            <td style="text-align:center;">
                <div style="font-weight:bold; font-size:1.1em;">${row.deptText}</div>
                <div style="font-size:0.85em; color:#666;">(${row.percentActivity}%)</div>
            </td> 

            <td>${passBadge}</td>
        </tr>
        `;
    }).join("");
}

// 🔥 ฟังก์ชันเปิด Popup
function openStudentModal(rowId) {
    const row = termScoreRows.find(r => r.id.toString() === rowId.toString());
    if (!row) return;

    document.getElementById('modalStudentName').textContent = row.studentName;

    // --- การ์ดซ้าย: หน้าเสาธง ---
    document.getElementById('flagTotal').textContent = `${row.flagTotal} ครั้ง`;
    document.getElementById('flagAttended').textContent = `${row.flagAttended} ครั้ง`;
    document.getElementById('flagPercent').textContent = `${row.percentFlag}%`;

    const flagIcon = document.getElementById('flagIcon');
    const flagCard = document.getElementById('flagCard');
    if (row.percentFlag >= 80) {
        flagIcon.className = "fas fa-check";
        flagCard.className = "card-detail card-blue";
    } else {
        flagIcon.className = "fas fa-times";
        flagCard.className = "card-detail card-red";
    }

    // --- การ์ดขวา: กิจกรรม ---
    document.getElementById('deptTotal').textContent = `${row.deptTotal} ครั้ง`;
    document.getElementById('deptAttended').textContent = `${row.deptAttended} ครั้ง`;
    document.getElementById('deptPercent').textContent = `${row.percentActivity}%`;

    const deptIcon = document.getElementById('deptIcon');
    const deptCard = document.getElementById('deptCard');
    if (row.percentActivity >= 80) {
        deptIcon.className = "fas fa-check";
        deptCard.className = "card-detail card-blue";
    } else {
        deptIcon.className = "fas fa-times";
        deptCard.className = "card-detail card-red";
    }

    document.getElementById('studentModal').style.display = 'flex';
}

function closeStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
}

window.onclick = function (event) {
    const modal = document.getElementById('studentModal');
    if (event.target == modal) {
        closeStudentModal();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTermScore();
});