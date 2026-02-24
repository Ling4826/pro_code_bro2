/* JavaScript/Login.js */
const SUPABASE_URL = 'https://dxfwnsfdgnazzwkbvjmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1-4QXvDbZ5F3a7TcWN6rVA_VkQHcXtl';

// ฟังก์ชันหลักดึงข้อมูล (ทำงานตลอดทุก 3 วินาที)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm = document.getElementById('login');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); 

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const submitBtn = loginForm.querySelector('button');

    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'กำลังตรวจสอบ...';
    submitBtn.disabled = true;

    try {
        let userRole = '';
        let userName = '';
        let refId = '';

        // 📌 ทางเดินที่ 1: เช็คว่าเป็น "นักเรียน" หรือไม่?
        // (ดูจากตาราง student โดยตรง: ใช้รหัสนักศึกษา + เลขบัตรประชาชน)
        const { data: studentData, error: studentError } = await supabaseClient
            .from('student') //
            .select('*')
            .eq('id', usernameInput)          // ช่อง Username คือ รหัสนักศึกษา
            .eq('citizen_id', passwordInput)  // ช่อง Password คือ เลขบัตรประชาชน
            .single();

        if (studentData) {
            // ✅ เจอนักเรียน!
            userRole = studentData.role; // ได้ค่า 'Leader' หรือ 'Student' ของจริง
            userName = studentData.name;
            refId = studentData.id;
        } else {
         // 📌 ทางเดินที่ 2: ถ้าไม่ใช่นักเรียน ลองเช็คว่าเป็น "อาจารย์/เจ้าหน้าที่" ไหม?
            // (ดูจากตาราง user_account: ใช้ชื่อผู้ใช้ + ref_id)
            const { data: accountData, error: accountError } = await supabaseClient
                .from('user_account')
                .select('*')
                .eq('username', usernameInput)  // เช็คชื่อผู้ใช้
                .eq('ref_id', passwordInput)    // 🔥 แก้ตรงนี้: เช็ค Password กับ ref_id
                .single();

            if (accountData) {
                // ✅ เจออาจารย์/เจ้าหน้าที่!
                userRole = accountData.role;
                userName = accountData.username;
                refId = accountData.ref_id;
            } else {
                // ❌ ไม่เจอทั้งสองที่
                throw new Error("ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ รหัสนักศึกษา/ชื่อผู้ใช้ หรือ รหัสผ่าน");
            }
        }

        // --- ผ่านการตรวจสอบแล้ว บันทึกข้อมูลลง Session ---
        sessionStorage.setItem('is_logged_in', 'true'); 
        sessionStorage.setItem('user_role', userRole); 
        sessionStorage.setItem('user_name', userName);
        if (refId) sessionStorage.setItem('ref_id', refId);

        // --- แยกย้ายไปตามหน้า (Routing) ---
        const roleCheck = userRole.toLowerCase();

        if (roleCheck === 'admin') {
            window.location.href = 'Admin/Home.html';
        } else if (roleCheck === 'teacher') {
            window.location.href = 'Teacher/Home.html';
        } else if (roleCheck === 'leader') {
            window.location.href = 'Leader/Home.html'; 
        } else { 
            // 🟢 นักเรียนทั่วไป
            window.location.href = 'Student/Home.html';
        }

    } catch (err) {
        // console.error(err); // เปิดบรรทัดนี้ถ้าอยากดู error เต็มๆ ใน Console
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});