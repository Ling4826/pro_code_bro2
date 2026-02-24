/* auth_guard.js - เช็ค Session แบบกำหนดเอง (สำหรับวิธีไม่ใช้ Auth) */

function checkAuth() {
    // เช็คว่ามีตราประทับ 'is_logged_in' ในเครื่องไหม
    const isLoggedIn = sessionStorage.getItem('is_logged_in');

    // ถ้าไม่มี -> ดีดกลับไปหน้า Login
    if (isLoggedIn !== 'true') {
        // เช็คว่าถ้าไม่ได้อยู่หน้า Login ให้เด้งออก
        if (!window.location.href.includes('index.html')) {
             alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
             window.location.href = '../index.html'; 
        }
    }
}

// สั่งทำงานทันที
checkAuth();

// ฟังก์ชัน Logout (ล้างค่าทั้งหมด)
function logout() {
    sessionStorage.clear(); // ลบความจำเครื่อง
    window.location.href = '../index.html';
}

// ผูกปุ่ม Logout อัตโนมัติ
document.addEventListener('DOMContentLoaded', () => {
    const logoutLinks = document.querySelectorAll('.logout');
    logoutLinks.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});