/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let termScoreRows = [];

async function fetchTermScore() {
    document.getElementById("score-body").innerHTML = `
        <tr><td colspan="6" style="padding: 20px; color: #666; text-align: center;">กำลังดึงข้อมูล...</td></tr>
    `;

    try {
        // 1. ดึง Role และ ID ของผู้ใช้งานปัจจุบัน
        const userRole = sessionStorage.getItem('user_role')?.toLowerCase();
        const refId = sessionStorage.getItem('ref_id');
        let userClassId = null;

        // 2. ถ้าเป็นนักเรียนหรือหัวหน้าห้อง ให้หา class_id ของตัวเอง
        if (userRole === 'student' || userRole === 'leader') {
            const { data: studentData, error: studentErr } = await supabaseClient
                .from('student')
                .select('class_id')
                .eq('id', refId)
                .single();
            
            if (!studentErr && studentData) {
                userClassId = studentData.class_id;
            }
        }

        // 3. สร้าง Query หลัก (ใช้ !inner เพื่อให้สามารถกรองผ่านตาราง student ได้)
        let query = supabaseClient
            .from('term_score')
            .select(`
                id,
                semester,
                academic_year,
                student!inner (
                    id,
                    name,
                    class_id,
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
                        status
                    )
                )
            `);

        // 4. 🔥 ถ้าเป็นนักเรียน ให้กรองเอาเฉพาะคนที่มี class_id ตรงกับตัวเอง 🔥
        if (userClassId) {
            query = query.eq('student.class_id', userClassId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // ถ้าไม่มีข้อมูลเลย
        if (!data || data.length === 0) {
            document.getElementById("score-body").innerHTML = `
                <tr><td colspan="6" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูล</td></tr>
            `;
            return;
        }

        // กรองข้อมูลซ้ำ
        const uniqueRowsMap = new Map();
        data.forEach(row => {
            const studentId = row.student?.id;
            if (studentId && !uniqueRowsMap.has(studentId)) {
                uniqueRowsMap.set(studentId, row);
            }
        });
        const uniqueData = Array.from(uniqueRowsMap.values());

        // 5. ประมวลผลข้อมูลใหม่: นับรวมเข้าด้วยกัน
        termScoreRows = uniqueData.map(row => {
            const student = row.student;
            const classInfo = student?.class;
            const major = classInfo?.major;
            const checks = student?.activity_check || [];

            // นับจำนวนทั้งหมด และ ที่เข้า (Attended)
            const totalRequired = checks.length;
            const totalAttended = checks.filter(c => c.status === 'Attended').length;

            // คำนวณเปอร์เซ็นต์
            const calcPercent = totalRequired > 0 ? (totalAttended / totalRequired) * 100 : 0;

            return {
                id: row.id,
                student_id: student?.id ?? "-",
                studentName: student?.name ?? "-",
                majorName: major?.name ?? "-",
                level: major?.level ?? "-",
                year: classInfo?.year ?? "-",
                classNumber: classInfo?.class_number ?? "-",

                // ข้อมูลสำหรับแสดงผล
                totalRequired,
                totalAttended,
                summaryText: `${totalAttended}/${totalRequired}`,
                percentTotal: parseFloat(calcPercent.toFixed(2))
            };
        });

        initFilters();
        renderFilteredTable();

    } catch (error) {
        console.error("ERROR >", error);
        document.getElementById("score-body").innerHTML = `
            <tr><td colspan="6" style="color: red; text-align: center;">เกิดข้อผิดพลาด: ${error.message}</td></tr>
        `;
    }
}

/* --- ส่วน Filter คงเดิม --- */
function initFilters() {
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");
    document.getElementById("level").addEventListener("change", () => { updateMajorDropdown(); updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("department").addEventListener("change", () => { updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("studentYear").addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber").addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput").addEventListener("input", renderFilteredTable);
    updateMajorDropdown();
    updateYearAndRoomDropdown();
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        return `
        <tr style="cursor: pointer;" onclick="openStudentModal('${row.id}')">
            <td>${row.student_id}</td>
            <td style="font-weight: bold; color: #007bff;">${row.studentName}</td>
            <td>${row.majorName}</td>
            <td>${row.year}</td>
            <td>${row.classNumber}</td>
            
            <td style="text-align:center;">
                <div style="font-weight:bold; font-size:1.1em;">${row.summaryText}</div>
                <div style="font-size:0.85em; color:#666;">(${row.percentTotal}%)</div>
            </td>     
        </tr>
        `;
    }).join("");
}

// 🔥 ฟังก์ชันเปิด Popup การ์ดใบเดียว
function openStudentModal(rowId) {
    const row = termScoreRows.find(r => r.id.toString() === rowId.toString());
    if (!row) return;

    // เปลี่ยนชื่อบนหัว Modal
    document.getElementById('modalStudentName').textContent = row.studentName;

    // ยัดข้อมูลใส่การ์ด
    document.getElementById('totalRequired').textContent = row.totalRequired;
    document.getElementById('totalAttended').textContent = row.totalAttended;
    document.getElementById('totalPercent').textContent = row.percentTotal;

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