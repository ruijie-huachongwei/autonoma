# Autonoma Ruijie 测试环境部署手册

本文用于把当前仓库部署到 `https://autonoma-test.ruijie.com.cn`。

## 1. 部署范围

仓库目前没有可直接用于单机正式环境的 production Compose 文件：

- `docker-compose.dev.yaml` 会挂载源码、在每次启动时安装依赖，并使用固定的 PostgreSQL 开发密码。
- `apps/api/Dockerfile` 和 `apps/ui/Dockerfile` 假设 `dist/` 已由 CI 预先生成，不是完整的源码构建镜像。
- 完整测试执行依赖 Temporal worker 和 Kubernetes/KEDA。仅启动 API 与 UI 可以验证页面、CAS 和基础管理功能，但不能视为完整测试平台已经上线。

因此建议分两步实施：

1. 使用 `docker-compose.dev.yaml` 完成内网测试环境、HTTPS 和 CAS 联调。
2. 联调通过后，再建设 CI 镜像和 Kubernetes worker 拓扑，作为长期运行环境。

## 2. 当前阻塞项

2026-09-16 的无凭据检查结果：

| 检查项 | 当前结果 | 上线要求 |
| --- | --- | --- |
| DNS | `autonoma-test.ruijie.com.cn` 解析到 `172.16.22.64` | 保留该入口，或按实际网络方案调整 |
| 443 端口 | TCP 可访问 | 保持开放 |
| 当前站点 | `/health` 返回另一个标题为“锐捷”的 SPA 页面，不是 Autonoma 的 `{"ok":true}` | 修改 `172.16.22.64` 上该域名的 Nginx/vhost 上游 |
| TLS | 当前证书链不能通过客户端信任校验 | 配置受信任证书及完整中间证书链，验收时不得使用 `-k` |
| CAS 交换接口 | 无凭据请求返回 HTTP 500 | 部署并检查 manager-service 接口，使非法凭据返回明确的 4xx，并用真实 CAS ticket 联调 |

在这四项完成前，不应进行域名切流。

## 3. 推荐拓扑

```mermaid
flowchart LR
    B[浏览器] -->|HTTPS 443| G[172.16.22.64 Nginx 网关]
    G -->|页面和静态资源| U[应用服务器 UI 3000]
    G -->|/v1 /health 等| A[应用服务器 API 4000]
    A --> P[(PostgreSQL 5432)]
    A --> R[(Redis 6379)]
    A --> T[Temporal 7233]
    A --> S[Alibaba Cloud OSS]
    A --> C[tianshu-manager-service]
```

如果应用服务器仍是 `192.168.85.164`，网关应把 UI 流量转发到 `192.168.85.164:3000`，把 API 路径转发到 `192.168.85.164:4000`。若服务器地址已经变化，替换为实际地址。

公网或办公网只开放 `80/443`。`3000/4000` 仅允许网关访问；`5432/6379/7233/8233` 不应向普通客户端开放。当前开发 Compose 会把这些端口绑定到主机，必须通过主机防火墙限制访问。

建议控制面测试服务器从 `4 vCPU / 8 GiB RAM / 50 GiB` 磁盘起步。浏览器 worker 不包含在该容量内，每个并发浏览器任务需要单独预留 CPU 和内存。

## 4. 必要配置

在仓库根目录复制 `.env.example` 为 `.env`，然后至少配置以下内容。所有 `<...>` 都必须替换，不能原样保留。

```dotenv
# 当前 docker-compose.dev.yaml 固定以 development 模式启动 API。
NODE_ENV=development

# 当前 Compose 内部地址。开发编排中的 PostgreSQL 密码固定为 postgres。
DATABASE_URL=postgresql://postgres:postgres@postgresql:5432/autonoma
REDIS_URL=redis://redis:6379
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=default
API_PORT=4000
NAMESPACE=autonoma-test

# 单域名 HTTPS 入口。BETTER_AUTH_URL 只能写 origin，不能追加 /v1。
APP_URL=https://autonoma-test.ruijie.com.cn
BETTER_AUTH_URL=https://autonoma-test.ruijie.com.cn
MCP_RESOURCE_URL=https://autonoma-test.ruijie.com.cn
ALLOWED_ORIGINS=https://autonoma-test.ruijie.com.cn

# 不要设为 ruijie.com.cn，否则所有该邮箱后缀用户会被当作平台内部用户，
# production cookie 也会扩大到整个公司主域。
INTERNAL_DOMAIN=autonoma-test.ruijie.com.cn

# 分别执行 openssl rand -hex 32 生成，不要复用，也不要提交到 Git。
BETTER_AUTH_SECRET=<64-hex-characters>
SCENARIO_ENCRYPTION_KEY=<64-hex-characters>

# 企业 CAS。交换密钥必须与 tianshu-manager-service 完全一致。
CAS_MANAGER_BASE_URL=https://tianshu-test.ruijie.com.cn/tianshu-manager-service
CAS_LOGIN_URL=https://sid.ruijie.com.cn/login
CAS_IDENTITY_EXCHANGE_SECRET=<shared-64-hex-secret>

# UI 构建时或 Vite 启动时读取。VITE_API_URL 变更后必须重建或重启 UI。
VITE_API_URL=https://autonoma-test.ruijie.com.cn
VITE_INTERNAL_DOMAIN=autonoma-test.ruijie.com.cn
API_PROXY_URL=http://api:4000
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=autonoma-test.ruijie.com.cn

# API 启动时强制校验。这里仍使用 S3_ 前缀，因为代码通过 OSS 的
# S3 兼容协议访问；值必须来自阿里云 OSS/RAM，不能填写 AWS 凭据。
S3_BUCKET=<oss-bucket-name>
S3_REGION=<oss-region，例如 cn-hangzhou>
S3_ENDPOINT=<例如 https://s3.oss-cn-hangzhou.aliyuncs.com>
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=<oss-ram-access-key-id>
S3_SECRET_ACCESS_KEY=<oss-ram-access-key-secret>

# 第一阶段只做 CAS 和控制面联调时使用仓库内的 GitHub 假实现。
LOCAL_DEV=true
STRIPE_ENABLED=false
PREVIEWKIT_ENV=false
```

生成密钥并保护环境文件：

```bash
openssl rand -hex 32
openssl rand -hex 32
chmod 600 .env
```

`SCENARIO_ENCRYPTION_KEY` 用于 AES-256-GCM。写入加密数据后必须保持稳定，否则旧数据无法解密。更换 `BETTER_AUTH_SECRET` 会使现有登录会话失效。

### 阿里云 OSS 准备

1. 创建私有 bucket，地域与 `S3_REGION` 保持一致。
2. 创建独立 RAM 用户或角色，只授权该 bucket 的对象上传、下载、删除和分片上传操作，不使用主账号 AccessKey。
3. 如果应用运行在同地域阿里云 VPC，优先使用内网地址，例如 `https://s3.oss-cn-hangzhou-internal.aliyuncs.com`；否则使用 S3 兼容公网地址，例如 `https://s3.oss-cn-hangzhou.aliyuncs.com`。
4. `S3_FORCE_PATH_STYLE` 保持 `false`，bucket 名称应符合 DNS 命名要求。
5. 如浏览器需要跨域读取签名 URL，在 OSS bucket CORS 中允许 `https://autonoma-test.ruijie.com.cn` 的 `GET`、`HEAD` 请求及业务实际需要的响应头。
6. 确保服务器启用 NTP。签名请求的服务器时间偏差过大会导致 `SignatureDoesNotMatch`。

阿里云自 2025-03-20 起限制中国内地部分新用户通过默认公网域名调用数据 API。如果当前账号受该策略影响，需要按 OSS 控制台提示绑定自定义域名和 HTTPS 证书，并在上线前完成真实上传、下载和签名 URL 验证。

本配置会替换 API、Web/Mobile engine 和 diffs worker 通过 `@autonoma/storage` 发起的制品读写。Previewkit 的 PostgreSQL `restore_from` 是每个预览环境单独声明的备份来源，目前仍使用它自己的 S3 配置，不读取这里的全局 OSS endpoint。

### 完整 GitHub/PR 能力

如果需要接入真实仓库和 PR 流程，将 `LOCAL_DEV=false`，并配置：

```dotenv
GITHUB_APP_ID=<app-id>
GITHUB_APP_PRIVATE_KEY=<base64-encoded-pem>
GITHUB_APP_WEBHOOK_SECRET=<webhook-secret>
GITHUB_APP_SLUG=<app-slug>
```

GitHub App webhook 地址应配置为：

```text
https://autonoma-test.ruijie.com.cn/v1/github/webhook
```

### 可暂不配置

第一阶段可以不配置 Google/GitHub/Microsoft OAuth、Stripe、PostHog、Sentry、Resend 和移动设备参数。AI 密钥不是 API 启动条件，但生成和执行测试时必须配置模型。可使用内置的 `GEMINI_API_KEY`、`GROQ_KEY`、`OPENROUTER_API_KEY`，也可统一接入公司 OpenAI-compatible 网关：

```dotenv
AI_PROVIDER=openai-compatible
AI_COMPATIBLE_BASE_URL=https://<内部模型网关>/v1
AI_COMPATIBLE_API_KEY=<网关密钥>
AI_COMPATIBLE_MODEL=<支持视觉、结构化输出和工具调用的模型 ID>
```

如单个模型不能覆盖全部能力，可再配置 `AI_COMPATIBLE_FAST_VISUAL_MODEL`、`AI_COMPATIBLE_SMART_VISUAL_MODEL`、`AI_COMPATIBLE_FAST_TEXT_MODEL` 和 `AI_COMPATIBLE_POINTER_MODEL`。这些变量必须注入实际执行 web/mobile 测试的 worker，不能只配置在 API 容器。

## 5. CAS 配套配置

在 `tianshu-manager-service` 配置同一个交换密钥和回调地址：

```dotenv
CAS_IDENTITY_EXCHANGE_SECRET=<与 Autonoma 完全相同的值>
AUTONOMA_CAS_CALLBACK_URL=https://autonoma-test.ruijie.com.cn/v1/enterprise-auth/cas/callback
```

同时在 CAS/SID 服务端登记该 HTTPS callback。Autonoma 登录时会在 callback 上增加动态 `state` 查询参数，服务白名单需要允许这一合法查询参数。

API 容器必须能访问：

```text
https://sid.ruijie.com.cn/login
https://tianshu-test.ruijie.com.cn/tianshu-manager-service/v1/auth/exchange-cas-ticket
```

`CAS_IDENTITY_EXCHANGE_SECRET` 只存在于两个服务端，不能使用 `VITE_*` 名称，也不能进入浏览器构建产物、日志或文档。

## 6. 首次部署步骤

以下命令在 Linux 应用服务器的仓库根目录执行。建议使用 Node.js 24、仓库锁定的 pnpm 版本、Docker Engine 和 Docker Compose v2。

### 6.1 准备代码和配置

```bash
git clone <repository-url> /opt/autonoma
cd /opt/autonoma
corepack enable
cp .env.example .env
chmod 600 .env
# 编辑 .env，填入第 4 节参数
```

先验证 Compose 文件，不打印展开后的敏感配置：

```bash
docker compose -f docker-compose.dev.yaml config --quiet
```

### 6.2 启动基础设施

```bash
docker compose -f docker-compose.dev.yaml up -d postgresql redis temporal
docker compose -f docker-compose.dev.yaml ps
```

确认 PostgreSQL、Redis 和 Temporal 健康后再执行迁移。

### 6.3 执行数据库迁移

生产或共享环境只执行 `prisma migrate deploy`，不要执行会创建新迁移的 `prisma migrate dev`：

```bash
docker compose -f docker-compose.dev.yaml run --rm api sh -lc \
  'corepack enable && pnpm install --frozen-lockfile && cd packages/db && pnpm exec prisma migrate deploy'
```

### 6.4 启动 API 和 UI

```bash
docker compose -f docker-compose.dev.yaml up -d api ui temporal-ui
docker compose -f docker-compose.dev.yaml ps
docker compose -f docker-compose.dev.yaml logs --tail=200 api ui
```

先在应用服务器本机验证：

```bash
curl --fail --show-error http://127.0.0.1:4000/health
curl --fail --show-error --head http://127.0.0.1:3000/
```

第一条必须返回 `{"ok":true}`。第二条必须返回 HTTP 200。

## 7. Nginx 网关配置

下面配置假设 TLS 在 `172.16.22.64` 终止，应用服务器是 `192.168.85.164`。证书路径和应用服务器地址按实际情况替换。

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

upstream autonoma_test_ui {
    server 192.168.85.164:3000;
    keepalive 16;
}

upstream autonoma_test_api {
    server 192.168.85.164:4000;
    keepalive 16;
}

server {
    listen 80;
    server_name autonoma-test.ruijie.com.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name autonoma-test.ruijie.com.cn;

    ssl_certificate /etc/nginx/certs/autonoma-test.fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/autonoma-test.key;

    client_max_body_size 50m;
    large_client_header_buffers 4 32k;
    proxy_buffer_size 32k;
    proxy_buffers 8 32k;
    proxy_busy_buffers_size 64k;

    location ~ ^/(health$|llms\.txt$|v1/|rs/|flags/|\.well-known/ai-catalog\.json$|\.well-known/oauth-) {
        proxy_pass http://autonoma_test_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
    }

    location / {
        proxy_pass http://autonoma_test_ui;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

应用配置后执行：

```bash
nginx -t
systemctl reload nginx
```

不要让 `/v1` 进入另一个 SPA 的 fallback，也不要让 `/health` 返回 HTML。两者都必须直接到 Autonoma API。

## 8. 上线验收

### 8.1 DNS、TLS 和路由

```bash
nslookup autonoma-test.ruijie.com.cn
curl --fail --show-error https://autonoma-test.ruijie.com.cn/health
curl --fail --show-error --head https://autonoma-test.ruijie.com.cn/
```

验收要求：

- 全程不使用 `curl -k`。
- `/health` 的 Content-Type 是 JSON，响应为 `{"ok":true}`。
- `/` 返回 Autonoma UI，而不是旧的“锐捷”页面。
- 浏览器控制台没有 CORS、mixed content 或 WebSocket host 错误。

### 8.2 CAS 登录

1. 打开 `https://autonoma-test.ruijie.com.cn/login`。
2. 确认显示企业 CAS 登录入口。
3. 登录后应跳到 SID，再回到 `/v1/enterprise-auth/cas/callback`，最终返回 Autonoma 页面。
4. 确认回调不是 404/500，并且浏览器得到有效会话。
5. 检查 API 日志中出现 `CAS sign-in completed`，且没有记录 ticket、共享密钥或会话令牌。

如果失败，按顺序检查公网 callback、Redis 中的短期 state、manager-service 交换接口、两个服务的共享密钥是否一致。

### 8.3 基础设施

```bash
docker compose -f docker-compose.dev.yaml exec postgresql pg_isready -U postgres
docker compose -f docker-compose.dev.yaml exec redis redis-cli ping
docker compose -f docker-compose.dev.yaml exec temporal \
  temporal operator cluster health --address temporal:7233
```

## 9. 备份和更新

每次升级和数据库迁移前先备份：

```bash
mkdir -p /opt/autonoma-backups
docker compose -f docker-compose.dev.yaml exec -T postgresql \
  pg_dump -U postgres -d autonoma | gzip > "/opt/autonoma-backups/autonoma-$(date +%Y%m%d-%H%M%S).sql.gz"
```

更新流程：

```bash
cd /opt/autonoma
git pull --ff-only
docker compose -f docker-compose.dev.yaml run --rm api sh -lc \
  'corepack enable && pnpm install --frozen-lockfile && cd packages/db && pnpm exec prisma migrate deploy'
docker compose -f docker-compose.dev.yaml up -d --remove-orphans api ui
curl --fail --show-error https://autonoma-test.ruijie.com.cn/health
```

数据库迁移通常不能通过简单回退代码撤销。回滚前先确认目标版本与新 schema 兼容，必要时从备份恢复。

## 10. 完整测试执行所需组件

第一阶段部署不包含完整测试执行。完整 Web 测试至少还需要：

| 组件 | 运行方式 | 主要依赖 |
| --- | --- | --- |
| `worker-general` | 常驻 Temporal worker | PostgreSQL、Temporal、GitHub App、场景加密密钥、Kubernetes RBAC |
| `worker-diffs` | 常驻 Temporal worker | PostgreSQL、Temporal、S3、GitHub App、AI 模型密钥 |
| `worker-web` | 每个 activity 执行一次后退出 | Playwright、Temporal、PostgreSQL、S3、AI 模型密钥 |
| Previewkit | Kubernetes Job | Kubernetes、镜像仓库、BuildKit、Secrets Manager 等 |

仓库的设计是使用 Kubernetes 和 KEDA 根据 Temporal 队列启动 `worker-web`。在单机 Compose 中把它当普通常驻容器会在每次任务完成或空闲两分钟后退出，因此需要额外的重启与并发调度设计。完成 CI 镜像、Kubernetes manifests、RBAC、KEDA ScaledJob 和密钥管理前，只验收控制面与 CAS，不触发正式测试任务。

## 11. 长期运行前必须整改

- 不再使用 `docker-compose.dev.yaml` 的固定 PostgreSQL 密码。
- API/UI 镜像在 Linux CI 中完成依赖安装、构建、扫描和推送，服务器只拉取不可变版本标签。
- PostgreSQL、Redis、Temporal 和 OSS 建立持久化、备份、监控和恢复演练。
- 所有密钥进入服务器密钥管理系统，不放入镜像、Git 或 Nginx 配置。
- 为 API、UI 和 worker 设置资源限制、健康检查、滚动升级及日志采集。
- 外部只开放 80/443；数据库、Redis、Temporal 和 Temporal UI 保持内网访问。