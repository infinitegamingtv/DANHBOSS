# CLASS BOSS BATTLE — Firebase Realtime Web Game

Trò chơi giáo dục nhiều người chơi cùng lúc dành cho lớp học online. Phiên bản Production-Ready với hình ảnh và âm thanh hoàn thiện.

- Giáo viên tạo phòng và nhận mã phòng 6 ký tự.
- Học sinh đăng nhập ẩn danh, nhập mã phòng và tên để tham gia.
- Cả lớp trả lời câu hỏi để cùng gây sát thương lên boss.
- Điểm, trạng thái online, HP boss và bảng xếp hạng cập nhật real-time.
- Mỗi phòng có dữ liệu độc lập tại `rooms/{ROOM_CODE}`.

## 1. Cấu trúc thư mục

```text
realtime-boss-battle/
├── index.html
├── style.css
├── script.js
├── questions.js               # Chứa toàn bộ câu hỏi và giải thích
├── database.rules.json
├── firebase.json
├── README.md
├── CHANGELOG.md
├── TEST_REPORT.md
└── assets/
    ├── arena-bg.png
    ├── boss-dragon.png
    ├── boss-robot.png
    ├── boss-slime.png
    └── avatars/
        ├── 1.png
        ├── 2.png
        ...
        └── 8.png
```

## 2. Thiết lập Firebase

### Bước 1 — Tạo Firebase project

1. Truy cập Firebase Console.
2. Chọn **Create a project**.
3. Đặt tên dự án, ví dụ `class-boss-battle`.
4. Google Analytics là tùy chọn, game này không bắt buộc dùng.

### Bước 2 — Đăng ký Web App và lấy config

1. Trong **Project Overview**, bấm biểu tượng Web `</>`.
2. Đặt nickname cho app, ví dụ `Boss Battle Web`.
3. Bấm **Register app**.
4. Sao chép object `firebaseConfig`.
5. Mở `script.js`, thay object mẫu ở đầu file bằng config thật.

Đặc biệt, hãy dùng đúng `databaseURL` Firebase cung cấp. URL thay đổi theo khu vực database.

### Bước 3 — Bật Anonymous Authentication

1. Mở **Build > Authentication**.
2. Bấm **Get started**.
3. Vào tab **Sign-in method**.
4. Chọn **Anonymous**.
5. Bật **Enable** và lưu.

Game dùng Anonymous Auth để mỗi trình duyệt có một UID riêng mà học sinh không cần tạo tài khoản.

### Bước 4 — Tạo Realtime Database

1. Mở **Build > Realtime Database**.
2. Bấm **Create Database**.
3. Chọn khu vực gần học sinh. Với lớp học ở Việt Nam, thường ưu tiên khu vực châu Á nếu console cung cấp.
4. Có thể chọn **Locked mode** vì rules sẽ được thay ở bước tiếp theo.

### Bước 5 — Cài Database Rules

Cách nhanh trong Console:

1. Vào **Realtime Database > Rules**.
2. Sao chép toàn bộ nội dung `database.rules.json`.
3. Dán vào trình chỉnh sửa Rules.
4. Bấm **Publish**.

Rules này đảm bảo:

- Chỉ người dùng đã Anonymous Auth mới đọc được phòng.
- Chỉ UID giáo viên tạo phòng mới sửa `meta` và điều khiển trận đấu.
- Học sinh chỉ sửa `profile`, `presence`, `stats` của chính UID đó.
- Mỗi lần trả lời đúng chỉ được tăng tối đa 60 damage.
- Giáo viên được reset stats cho cả lớp.

## 3. Chạy thử ở máy tính

Vì sử dụng JavaScript module, bạn không thể mở trực tiếp bằng `file://` mà cần một HTTP server nội bộ.

Một trong hai cách:

```bash
# Cách 1: Python
python -m http.server 5500
```

Mở `http://localhost:5500`.

Hoặc:

```bash
# Cách 2: Node.js
npx serve .
```

Để test nhiều người:

1. Cửa sổ thường: tạo phòng với vai trò giáo viên.
2. Cửa sổ ẩn danh hoặc trình duyệt khác: nhập mã với vai trò học sinh.
3. Mở thêm các cửa sổ ẩn danh/trình duyệt khác để mô phỏng nhiều học sinh.

## 4. Deploy lên Firebase Hosting

Cài Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
```

Trong thư mục dự án:

```bash
firebase init
```

Chọn:

- **Realtime Database**
- **Hosting**
- **Use an existing project**
- Chọn Firebase project vừa tạo
- Database rules file: `database.rules.json`
- Public directory: `.`
- Configure as a single-page app: `Yes`
- Không ghi đè `index.html` hiện có

Sau đó deploy:

```bash
firebase deploy --only hosting,database
```

CLI sẽ trả về URL dạng:

```text
https://YOUR_PROJECT_ID.web.app
```

Giáo viên mở URL đó để tạo phòng; học sinh mở cùng URL hoặc link mời có `?room=ABC123`.

## 5. Cơ chế real-time

Data model chính:

```text
rooms/
  ABC123/
    meta/
    players/
      UID_1/
        profile/
        presence/
        stats/
```

Mỗi máy lắng nghe `rooms/{roomCode}/meta` và `rooms/{roomCode}/players` bằng `onValue()`.
HP boss được tính toán tại Client thay vì lưu trực tiếp để tránh race conditions. Khi học sinh trả lời đúng, chỉ số `damage` được cập nhật riêng biệt thông qua Firebase Transaction.

## 6. Thay bộ câu hỏi

Mở `questions.js`, bạn sẽ thấy mảng `QUESTION_BANK`.

Mỗi câu có dạng:

```js
{
  category: "Grammar",
  question: "My brother ___ football every Sunday.",
  answers: ["play", "plays", "playing", "is play"],
  correctIndex: 1,
  explanation: "With 'he/she/it' and singular nouns in Present Simple, we add 's' or 'es' to the verb."
}
```

- `correctIndex` (0 đến 3) tương ứng với A, B, C, D.
- `explanation` giải thích ngắn gọn đáp án hiển thị sau khi người chơi trả lời.

## 7. Assets và Âm Thanh
- Hình ảnh hiển thị (Boss, Hình nền, Avatar) đã được AI sinh hoàn chỉnh. 
- Âm thanh được xử lý hoàn toàn theo cú pháp "Procedural Audio" sử dụng API Web Audio để tiết kiệm dung lượng truyền tải mạng và không bị vi phạm bản quyền.

## 8. Lưu ý bảo mật khi dùng thật

Bản này phù hợp cho lớp học và MVP. Vì câu hỏi/đáp án nằm ở trình duyệt, học sinh có kiến thức kỹ thuật vẫn có thể xem mã nguồn hoặc cố gửi request giả.
Để chống gian lận, nên chuyển logic chấm đáp án và tính damage sang Cloud Functions.
