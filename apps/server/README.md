# DERIT Backend

REST API cho hệ thống thi lập trình trực tuyến **DERIT**, xây dựng bằng Node.js + Express + MongoDB.

---

## Yêu cầu

| Công cụ | Phiên bản tối thiểu |
| ------- | ------------------- |
| Node.js | 18+                 |
| pnpm    | 10+                 |
| MongoDB | 6+                  |
| Docker  | 20+                 |

> Docker cần đang chạy để thực thi code của sinh viên trong sandbox container.

---

## Cài đặt

```bash
# Clone repo (nếu chưa có)
git clone https://github.com/LieuTuanKiet/derit-be.git
cd derit-be

# Cài dependencies
pnpm install
```

---

## Cấu hình môi trường

Tạo file `.env` ở thư mục gốc `derit-be/`:

```env
# Server
PORT=5001
NODE_ENV=development

# MongoDB
MONGODB_CONNECTIONSTRING=mongodb://localhost:27017/

# Google OAuth
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
CALLBACK_URL=http://localhost:5001/auth/google/callback

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Hướng dẫn lấy Google OAuth credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project sẵn có
3. Vào **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Loại: **Web application**
5. Thêm Authorized redirect URIs: `http://localhost:5001/auth/google/callback`
6. Sao chép **Client ID** và **Client Secret** vào `.env`

---

## Khởi động

```bash
# Development (có hot-reload)
pnpm dev

# Production
pnpm start
```

Server khởi động tại: `http://localhost:5001`

---

## Docker - Sandbox thực thi code

Backend sử dụng Docker để chạy code của sinh viên trong môi trường cô lập (Java). Container pool được quản lý tự động.

```bash
# Build image sandbox (chỉ cần build 1 lần)
docker build -t derit-java-runner .
```

> Đảm bảo Docker Desktop đang chạy trước khi khởi động server.

---

## Cấu trúc thư mục

```
derit-be/
├── index.js              # Entry point
├── dockerfile            # Sandbox image (Java runner)
├── app/
│   ├── config/
│   │   ├── db.js         # Kết nối MongoDB
│   │   ├── passport.js   # Cấu hình Google OAuth
│   │   └── swagger.js    # Cấu hình Swagger
│   ├── middleware/
│   │   └── middlewareAuth.js
│   ├── route/            # Định nghĩa các route
│   ├── schema/           # Mongoose models
│   └── services/
│       ├── codeExecutor.js   # Quản lý thực thi code
│       └── dockerExecutor.js # Giao tiếp với Docker
├── temp/
│   ├── pool/             # Container pool
│   └── submissions/      # File code tạm thời
└── uploads/
    └── pdfs/             # File đề thi PDF
```

---

## API Endpoints

| Method | Path              | Mô tả                          |
| ------ | ----------------- | ------------------------------ |
| GET    | `/`               | Health check                   |
| `*`    | `/auth`           | Xác thực (Google OAuth)        |
| `*`    | `/exam-templates` | Quản lý đề thi                 |
| `*`    | `/exam-sessions`  | Quản lý buổi thi               |
| `*`    | `/submissions`    | Nộp bài                        |
| `*`    | `/results`        | Kết quả thi                    |
| `*`    | `/upload`         | Upload file PDF                |
| GET    | `/api-docs`       | Swagger UI (chỉ ở development) |

Xem chi tiết API tại `http://localhost:5001/api-docs` sau khi khởi động server ở môi trường development.

---

## Các vấn đề thường gặp

**`MongooseError: MONGODB_CONNECTIONSTRING is not set`**
→ Kiểm tra file `.env` đã tạo đúng chưa.

**`Error: connect ENOENT /var/run/docker.sock`**
→ Docker chưa chạy. Mở Docker Desktop và thử lại.

**Google OAuth lỗi `redirect_uri_mismatch`**
→ `CALLBACK_URL` trong `.env` phải khớp với URI đã đăng ký trên Google Cloud Console.
