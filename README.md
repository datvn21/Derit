# DERIT

DERIT là hệ thống tổ chức và chấm thi lập trình trực tuyến, gồm frontend React Router và backend Node.js/Express sử dụng MongoDB. Bài nộp được biên dịch và chạy trong sandbox `nsjail`.

## Công nghệ

- Frontend: React 19, React Router 7, TypeScript, Vite
- Backend: Node.js 18+, Express 5, Mongoose
- Cơ sở dữ liệu: MongoDB 7 (Docker)
- Code execution: nsjail, Java 11 và Python 3

## Yêu cầu

- Node.js 18 trở lên
- npm 9 trở lên
- Docker Desktop với WSL 2 integration nếu dùng Windows/WSL
- Java 11, Python 3 và nsjail nếu chạy backend trực tiếp trên máy

## Cài đặt

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Mở `apps/server/.env` và cập nhật tối thiểu các biến sau:

```env
PORT=5001
NODE_ENV=development
MONGODB_CONNECTIONSTRING=mongodb://localhost:27017/derit
SESSION_SECRET=dev-secret
FRONTEND_URL=http://localhost:5173
```

Google OAuth là tùy chọn cho môi trường local. Nếu bật đăng nhập Google, điền `CLIENT_ID`, `CLIENT_SECRET` và bảo đảm `CALLBACK_URL` đã được đăng ký trên Google Cloud:

```env
CALLBACK_URL=http://localhost:5001/auth/google/callback
```

## Chạy bằng Docker Compose

Đây là cách chạy đầy đủ frontend, backend và MongoDB trong môi trường development:

```bash
docker compose up --build
```

Truy cập:

- Web: <http://localhost:5173>
- API: <http://localhost:5001>
- Swagger: <http://localhost:5001/api-docs>
- MongoDB: `mongodb://localhost:27017/derit`

Chạy ở background hoặc dừng hệ thống:

```bash
docker compose up -d
docker compose down
```

`docker-compose.yml` là cấu hình development mặc định và khởi chạy đầy đủ MongoDB, backend, frontend. Cấu hình production nằm riêng trong `docker-compose.prod.yml`.

> Không cần dùng `docker-compose.dev.yml`; file này đã được loại bỏ vì trùng với cấu hình development mặc định.

## Chạy trực tiếp trên máy

Khởi động MongoDB trước, sau đó chạy hai ứng dụng ở hai terminal:

```bash
# Terminal 1 - backend
npm --workspace apps/server run dev

# Terminal 2 - frontend
npm --workspace apps/web run dev -- --host 0.0.0.0
```

Frontend chạy tại <http://localhost:5173>, backend tại <http://localhost:5001>.

Nếu chưa cài nsjail và các runtime cần thiết trên Ubuntu/Debian:

```bash
chmod +x scripts/setup-nsjail.sh
./scripts/setup-nsjail.sh
mkdir -p temp/nsjail-workspace
```

## Kiểm thử

```bash
npm run test:unit         # Unit tests backend
npm run test:integration  # Integration tests backend
npm run test:web          # Unit tests frontend
npm run typecheck:web     # TypeScript check
npm run test:all          # Unit + integration backend
npm run test:e2e          # E2E frontend
```

## Cấu trúc thư mục

```text
.
├── apps/
│   ├── server/            # Express API, models, routes và nsjail executor
│   └── web/               # React Router frontend
├── scripts/               # Script cài đặt nsjail
├── docker-compose.yml     # Cấu hình development mặc định
├── docker-compose.prod.yml # Cấu hình production
└── package.json           # Workspace scripts
```

## Một số lỗi thường gặp

### Docker không khả dụng trong WSL 2

Mở Docker Desktop → **Settings → Resources → WSL Integration** và bật distro đang sử dụng, sau đó kiểm tra:

```bash
docker version
```

### Không kết nối được MongoDB

Kiểm tra MongoDB đang chạy và `MONGODB_CONNECTIONSTRING` trỏ tới đúng địa chỉ. Với Compose development, backend dùng hostname `mongodb` bên trong network Docker.

### Lỗi thực thi code

Kiểm tra `NSJAIL_PATH`, `NSJAIL_CONFIG_DIR`, `JAVA_HOME`, `PYTHON_BIN` và quyền truy cập cgroup. Khi dùng Compose development, service backend đã được cấu hình các capability cần thiết cho nsjail.

## Production

Trước khi chạy production, tạo `apps/server/.env` và đặt ít nhất:

```env
NODE_ENV=production
SESSION_SECRET=thay-bang-secret-ngau-nhien
CLIENT_ID=your-google-client-id
CLIENT_SECRET=your-google-client-secret
CALLBACK_URL=https://your-domain.example/auth/google/callback
```

Build và chạy cấu hình production:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Web được expose tại cổng `80`; backend chỉ có thể truy cập nội bộ qua Nginx tại `/api`. Reverse proxy cũng chuyển tiếp `/uploads/*` tới backend để frontend tải được PDF.

Với domain thật, cập nhật các giá trị sau:

```yaml
# docker-compose.prod.yml
FRONTEND_URL: https://your-domain.example

# build.args của service web
VITE_BACKEND_URL: /api
```

Trong `apps/server/.env`, đặt callback OAuth là `https://your-domain.example/api/auth/google/callback` và đăng ký đúng URL này trên Google Cloud. `VITE_BACKEND_URL` là biến build-time của Vite nên cần build lại image web sau khi thay đổi.

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down
```

Production yêu cầu `SESSION_SECRET` hợp lệ; không sử dụng secret mặc định. HTTPS cần được cấu hình bằng reverse proxy hoặc certificate riêng.
