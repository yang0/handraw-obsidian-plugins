# 手绘风写作插件市场规范（Format 1）

- 顶层 `format` 固定为 `1`，`plugins` 为非空数组。
- 每条插件须包含：`id`、`name`、`author`、`description`、`repo`（`owner/repo`）、`categories`、`compatLevel`（`verified` | `partial`）。
- 若提供 `downloadMirrors`（如 `{ "gitee": "https://.../dist/<id>/", "github": "https://.../dist/<id>/" }`）与 `files`（至少含 `manifest.json` 与 `main.js`），客户端将优先走用户选定镜像直下秒装，失败再回退 GitHub Release。
- 预留可选商业化字段：`pricing`（`free` | `pro` | `credits` | `paid`）与 `delivery`（`none` | `handraw-account`）。
