# dsh-plugin-model-quota

一个只读的 DeepSeek Harness Web 插件，通过 CLIProxyAPI Management API 动态发现账号，并在会话输入框下方显示 Codex 与 Kimi 订阅额度。

[English](./README.md)

## 功能

- 动态读取 `GET /v0/management/auth-files`，不写死账号。
- 通过固定的 `POST /v0/management/api-call` 查询 Codex 与 Kimi 额度。
- 在 `conversation.composer.dock` 显示单行账号状态和可展开详情。
- 页面可见时每 60 秒刷新；模型运行结束后延迟 3 秒刷新。
- 提供 DSH 插件设置卡，可配置 CLIProxyAPI Base URL、Management Key 和刷新时间。
- Management Key 使用 DSH write-only secret，不返回浏览器。
- 中文和英文界面，支持桌面与移动端布局。

## 兼容性

- DeepSeek Harness `0.1.0-rc.8`
- CLIProxyAPI `v7.2.137`
- Node.js 22 或更高版本
- V1 Provider：Codex、Kimi

## 安装

在 DSH Web profile 中安装本包，然后把插件加入 Cordis composition。包内的 `cordis.patch.yml` 提供默认 loader row。

从 GitHub 源码安装：

```bash
git clone https://github.com/lyq3/dsh-plugin-model-quota.git
cd dsh-plugin-model-quota
pnpm install --frozen-lockfile
pnpm build
pnpm --dir ~/.dsh/profiles/web add "$PWD"
systemctl --user restart dsh-web.service
```

本地开发目录也可以在完成 `pnpm install && pnpm build` 后，通过同样的 `pnpm --dir ~/.dsh/profiles/web add /path/to/dsh-plugin-model-quota` 方式安装。

不要启动另一个 DSH Web 服务；应重启实际提供页面的现有服务。

## 配置

在 DSH 主机的 loopback 页面打开：

```text
Settings → Plugins → Plugin configuration → Model Quota
```

默认配置：

| 字段 | 默认值 |
| --- | --- |
| CLIProxyAPI Base URL | `http://127.0.0.1:8317` |
| Refresh interval | `60` 秒 |
| Post-turn refresh delay | `3` 秒 |
| Request timeout | `10` 秒 |

Management Key 输入框是只写字段：保存后仍保持空白，以 `Configured` 标记表示已配置。

### 远程浏览器限制

DSH `0.1.0-rc.8` 将 `settings.describe`、`settings.mutate` 和 credential API 限制为 loopback same-origin。通过公网域名或局域网地址打开 DSH 时，Models 和插件设置可能显示：

```text
settings are unavailable in this browser
```

这是 DSH 的安全边界，不是本插件故障。请在 DSH 主机的 `127.0.0.1` 页面完成配置；配置完成后，额度栏可在远程会话页面只读显示。

## 网络规则

- CLIProxyAPI Base URL 必须使用 loopback hostname：`localhost`、`127.0.0.0/8` 或 `[::1]`。
- loopback HTTP 与 HTTPS 均可用，默认值为 `http://127.0.0.1:8317`。
- URL 不允许 userinfo、query、fragment、路径穿越、危险编码或重定向。
- `0.1.x` 明确拒绝远程 CLIProxyAPI authority，避免 Host 因 SSRF、DNS rebinding 或目标误配泄露 Management Key。若网关运行在其他机器，请先通过受认证的反向代理或隧道将端点安全地绑定到 DSH 主机 loopback。

## 浏览器安全边界

浏览器只能调用以下固定同源路由：

```text
GET  /api/model-quota
POST /api/model-quota/test-connection
```

浏览器不能提供上游 URL、HTTP method、headers、provider 或 auth index，也不会收到：

- CLIProxyAPI Management Key
- OAuth token
- 原始 auth index
- 上游 Authorization header
- 原始上游响应正文

账号 ID 是 Host 端生成的稳定不透明哈希；账号标签和脱敏额度 DTO 会返回页面用于显示。

## 开发与验证

```bash
pnpm install
pnpm verify
```

`pnpm verify` 会运行类型检查、单元测试、Host/Client 构建、lazy-CJS 包校验和 tarball 检查。

## 已知限制

- V1 只解析 Codex 与 Kimi。
- New Session 欢迎页不会渲染 `conversation.composer.dock`；创建或打开会话后才显示额度栏。
- 远程浏览器不能修改 DSH settings，见上文说明。
- 本插件不管理 CLIProxyAPI 账号，不保存额度历史，也不提供数据库或后台任务。

## 安全报告

请阅读 [SECURITY.md](./SECURITY.md)。

## 许可证

MIT
