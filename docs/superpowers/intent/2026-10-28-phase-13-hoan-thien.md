# Intent: Phase 13 — Hoàn thiện trải nghiệm trước khi lên store
Author: haonq. Status: designed. Phase: 13
Design: docs/superpowers/specs/2026-10-28-phase-13-design.md

## Problem
Các lỗi nhỏ người dùng thấy được, còn lại sau phase 11: đóng kết nối vĩnh viễn (link thu hồi/phòng xoá 4410, phòng đầy 4413/1009) chỉ hiện "mất kết nối"; tài liệu có
`formatVersion` mới hơn mở lặng lẽ; bấm Cho phép ghép cặp hai lần làm hỏng ghép cặp; đọc tại chỗ (content script) luôn ghi nhãn alert tiếng Việt ("Ghi chú");
export HTML làm mất ảnh đường dẫn tương đối; test chập chờn (`ux-reading.flow`, một test extension dưới tải). (`window.alert` trên web: đã hết — chỉ kiểm lại.)

## Proposed outcome
Thông báo đúng lý do khi bị ngắt vĩnh viễn (extension + web); banner tài liệu phiên bản mới hơn; ghép cặp chịu được bấm hai lần; nhãn alert theo cài đặt;
export HTML nhúng được ảnh đường dẫn tương đối; suite ổn định.

## Constraints
8 ràng buộc khoá cứng; content script ≤ 60 KB gz, không Yjs; không thêm dependency; i18n vi + en cùng tập khoá.
