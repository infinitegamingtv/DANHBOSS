# Assets

Game đã có SVG boss mẫu và âm thanh tổng hợp bằng Web Audio API nên chạy được ngay.

Khi dùng Google Antigravity để tạo asset đẹp hơn, đặt file theo cấu trúc:

assets/
  boss-dragon.svg
  boss-robot.svg
  boss-slime.svg
  arena-bg.webp (tùy chọn)
  audio/
    lobby-loop.mp3
    battle-loop.mp3
    hit.mp3
    correct.mp3
    wrong.mp3
    victory.mp3
    click.mp3

Sau khi có đủ file audio, đổi `USE_GENERATED_AUDIO` trong `script.js` thành `true`.
