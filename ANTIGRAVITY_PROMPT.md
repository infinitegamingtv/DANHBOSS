# MASTER PROMPT CHO GOOGLE ANTIGRAVITY

Bạn là Lead Full-stack Game Developer, Game UI/UX Designer, Technical Artist và Audio Designer. Hãy mở toàn bộ project hiện tại `realtime-boss-battle`, đọc kỹ `index.html`, `style.css`, `script.js`, `database.rules.json`, `firebase.json` và `README.md`, sau đó trực tiếp hoàn thiện project thành một web game giáo dục nhiều người chơi có chất lượng production demo.

## Mục tiêu sản phẩm

Tạo game **CLASS BOSS BATTLE** cho lớp học online:

- Giáo viên tạo phòng và nhận Room Code duy nhất.
- Học sinh nhập Room Code + tên để tham gia.
- Mỗi phòng hoàn toàn độc lập.
- Nhiều học sinh trả lời câu hỏi cùng lúc để đánh một boss chung.
- Trả lời đúng gây damage; combo cao tăng damage; có critical hit.
- Boss HP, player damage, presence và leaderboard phải cập nhật real-time trên tất cả thiết bị trong cùng phòng.
- Người gây nhiều damage nhất là người thắng khi boss bị hạ.
- Giáo viên có Start, Pause/Resume, Reset, End và Lock Room.
- Giao diện responsive tốt trên desktop, tablet và điện thoại.

## Ràng buộc kỹ thuật quan trọng

1. Giữ kiến trúc Firebase Realtime Database và Anonymous Authentication hiện có.
2. Không làm mất cơ chế room isolation tại `rooms/{roomCode}`.
3. Không đổi sang việc cho mọi client cùng ghi trực tiếp boss HP. Boss HP phải tiếp tục được suy ra từ tổng damage của từng player để tránh race condition.
4. Học sinh chỉ được ghi stats của UID chính mình; giáo viên host được điều khiển meta và reset stats.
5. Không hard-code Firebase config thật vào commit công khai. Giữ vùng config dễ thay thế và hướng dẫn rõ trong README.
6. Không dùng framework nặng nếu không cần. Ưu tiên HTML, CSS và vanilla JavaScript module như project hiện có.
7. Không dùng asset có bản quyền hoặc sao chép nhân vật/thương hiệu nổi tiếng. Tất cả hình ảnh và âm thanh phải là bản gốc.
8. Không xóa chức năng fallback. Nếu asset/audio ngoài bị thiếu, game vẫn phải chạy với SVG và procedural Web Audio.

## Nhiệm vụ lập trình

- Audit toàn bộ code, sửa lỗi runtime, lỗi logic, lỗi race condition và lỗi responsive.
- Kiểm tra luồng tạo phòng, join phòng, reload khôi phục session, rời phòng, presence online/offline.
- Kiểm tra Start, Pause, Resume, Reset, End và tự kết thúc khi boss HP bằng 0.
- Bảo đảm leaderboard sắp xếp theo damage, sau đó correct answers, sau đó joinedAt.
- Thêm loading state, empty state, error state và toast rõ ràng.
- Thêm animation mượt nhưng nhẹ: boss idle, boss hit, critical hit, HP transition, rank movement, victory confetti.
- Tối ưu accessibility: focus state, keyboard navigation, aria-label, contrast và prefers-reduced-motion.
- Tối ưu mobile để học sinh có thể trả lời nhanh bằng một tay.
- Không để XSS từ tên học sinh hoặc dữ liệu room.
- Không để học sinh bấm liên tục gửi nhiều transaction ngoài cooldown.
- Kiểm tra `database.rules.json` bằng Firebase Emulator hoặc Rules Playground; sửa rules nếu cú pháp/logic chưa hợp lệ.
- Thêm test checklist hoặc automated smoke test phù hợp.

## Tự tạo visual assets

Hãy dùng công cụ tạo ảnh/asset hiện có của Antigravity để tự tạo bộ asset gốc, đồng nhất, thân thiện với trẻ em. Nếu môi trường không thể tạo PNG/WebP trực tiếp, hãy tự vẽ SVG chất lượng cao và lưu đúng đường dẫn.

Art direction:

- 2D flat cartoon game art.
- Hình khối tròn, đáng yêu, năng động.
- Màu sáng, tương phản tốt, không viền đen dày.
- Không quá trẻ con; phù hợp học sinh 8–14 tuổi.
- Ánh sáng mềm, ít chi tiết thừa, đọc rõ trên màn hình nhỏ.
- Nền trong suốt cho boss và icon nhân vật.

Tạo tối thiểu:

1. `assets/boss-dragon.svg` hoặc `.webp`: Rồng Lửa, mạnh nhưng đáng yêu.
2. `assets/boss-robot.svg` hoặc `.webp`: Robot Khổng Lồ, sci-fi thân thiện.
3. `assets/boss-slime.svg` hoặc `.webp`: Slime Vũ Trụ, vui nhộn.
4. Mỗi boss nên có state idle, hurt, low-HP và defeated. Có thể dùng sprite sheet, nhiều file hoặc CSS/SVG animation.
5. `assets/arena-bg.webp`: đấu trường fantasy classroom, bố cục sạch, không che boss và UI.
6. Bộ 8 avatar học sinh đa dạng, phong cách thống nhất.
7. Icon crown, sword, shield, lightning, combo, correct, wrong, room, teacher, student.
8. Particle/confetti asset nhẹ hoặc tự vẽ bằng CSS/canvas.

Hãy tự đặt tên file nhất quán, cập nhật code để dùng asset mới và vẫn có fallback khi asset không load.

## Tự tạo BGM và SFX

Hãy dùng công cụ audio generation hiện có để tạo audio gốc, không bản quyền, seamless và tối ưu dung lượng. Nếu không có audio generator, hãy nâng cấp procedural Web Audio để đạt hiệu ứng tương tự và ghi rõ giới hạn.

Tạo:

- `assets/audio/lobby-loop.mp3`: 45–60 giây, seamless loop, vui tươi, nhẹ nhàng, 100–110 BPM, marimba/pluck/synth mềm, không vocal.
- `assets/audio/battle-loop.mp3`: 60–90 giây, seamless loop, năng lượng tích cực, 125–135 BPM, percussion nhẹ, brass/synth hero, không đáng sợ, không vocal.
- `assets/audio/hit.mp3`: impact ngắn 150–250 ms, punchy nhưng thân thiện.
- `assets/audio/correct.mp3`: sparkle/chime đi lên 300–500 ms.
- `assets/audio/wrong.mp3`: soft descending tone 300–500 ms, không gây khó chịu.
- `assets/audio/victory.mp3`: fanfare 2–4 giây, vui và hoành tráng.
- `assets/audio/click.mp3`: UI click mềm 50–100 ms.
- Có volume balance hợp lý, tránh clipping, normalize vừa phải.
- BGM phải loop không có khoảng trống.
- Tôn trọng browser autoplay policy: chỉ phát sau tương tác đầu tiên của người dùng.
- Có nút mute/unmute; lưu lựa chọn âm thanh trong localStorage.
- Duck BGM nhẹ khi phát victory hoặc correct/critical SFX.

Sau khi tạo đủ audio, đổi `USE_GENERATED_AUDIO` thành `true`, nhưng giữ fallback procedural audio.

## Question system

- Giữ question bank mẫu hiện tại.
- Tách question bank hoặc bổ sung cấu trúc dễ thay theo Unit/Level/Topic.
- Hỗ trợ ít nhất category, question, 4 answers, correctIndex, explanation, difficulty và optional image.
- Không gửi `correctIndex` lên Firebase.
- Shuffle câu hỏi và lựa chọn nhưng vẫn bảo toàn đáp án đúng.
- Tránh lặp lại ngay câu vừa xuất hiện.
- Có feedback đúng/sai rõ, sau đó tự chuyển câu tiếp theo.

## Kiểm thử bắt buộc

Hãy chạy và xác minh ít nhất các case sau bằng browser automation nếu có:

1. Giáo viên tạo phòng thành công và mã có 6 ký tự.
2. Hai học sinh ở hai browser context cùng join một phòng.
3. Một học sinh ở phòng khác không xuất hiện trong leaderboard phòng đầu.
4. Khi học sinh A trả lời đúng, damage của A và boss HP cập nhật ở màn hình giáo viên và học sinh B.
5. Hai học sinh trả lời gần như đồng thời, không mất damage.
6. Pause chặn gửi đáp án; Resume hoạt động lại.
7. Lock Room chặn người mới nhưng không đẩy người đang ở trong phòng ra.
8. Reset đưa toàn bộ stats về 0.
9. Boss HP về 0 thì hiện victory và leaderboard cuối.
10. Reload trang vẫn khôi phục đúng role/session khi UID còn hợp lệ.
11. Tên chứa ký tự HTML không được thực thi.
12. Layout không tràn ngang ở 360px, 768px và 1440px.
13. Không có console error nghiêm trọng.

## Kết quả phải bàn giao

- Toàn bộ code đã sửa trực tiếp trong project.
- Asset và audio đã lưu đúng thư mục.
- `README.md` được cập nhật với hướng dẫn Firebase, local run, deploy và thay question bank.
- Một file `CHANGELOG.md` tóm tắt thay đổi.
- Một file `TEST_REPORT.md` ghi case đã test, kết quả pass/fail và lỗi còn lại.
- Không chỉ mô tả. Hãy thực sự tạo file, chạy project, kiểm tra trong browser và sửa đến khi luồng chính hoạt động.
