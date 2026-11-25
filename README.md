# Handraw Official Writing Plugins Market（手绘风官方写作插件市场）

这是 [手绘风客户端（handraw-client）](https://github.com/yang0/handraw-client) 的**官方 Obsidian 兼容写作插件市场仓库**，采用统一 **Format 1** 标准，对热门写作、公众号排版、图床与知识管理插件进行中文整理、兼容等级标注，并对轻量热门插件同步国内镜像实现秒装。

## 市场订阅地址（国内镜像与 GitHub 保持一致）

| 镜像 | 仓库主页 | 市场订阅索引 (`index.json`) |
| --- | --- | --- |
| **Gitee 国内镜像（默认优先）** | https://gitee.com/yang02010/handraw-obsidian-plugins | `https://gitee.com/yang02010/handraw-obsidian-plugins/raw/main/index.json` |
| **GitHub 官方原仓** | https://github.com/yang0/handraw-obsidian-plugins | `https://raw.githubusercontent.com/yang0/handraw-obsidian-plugins/main/index.json` |

## 当前精选插件（共 18 个，其中 16 个已启用国内镜像直下加速）

| ID | 名称 | 分类 | 兼容等级 | 国内镜像加速 |
| --- | --- | --- | --- | --- |
| `note-to-mp` | NoteToMP 公众号排版 | `wechat` | 🟢 实测兼容 | GitHub Release |
| `mp-preview` | MP Preview 公众号预览 | `wechat` | 🟢 实测兼容 | ✅ 已加速 |
| `wechat-public-platform` | 微信公众号发布助手 | `wechat` | 🟢 实测兼容 | ✅ 已加速 |
| `wechatpb` | WeChatPB 公众号多主题排版 | `wechat` | 🟢 实测兼容 | ✅ 已加速 |
| `obsidian-image-auto-upload-plugin` | Image Auto Upload 图床上传 | `media` | 🟢 实测兼容 | ✅ 已加速 |
| `obsidian-linter` | Linter 文档排版规范 | `writing` | 🟢 实测兼容 | ✅ 已加速 |
| `editing-toolbar` | Editing Toolbar 富文本工具栏 | `writing` | 🟡 部分兼容 | ✅ 已加速 |
| `obsidian-outliner` | Outliner 大纲列表增强 | `writing` | 🟢 实测兼容 | ✅ 已加速 |
| `better-word-count` | Better Word Count 字数统计 | `writing` | 🟢 实测兼容 | ✅ 已加速 |
| `obsidian-auto-link-title` | Auto Link Title 链接自动抓标题 | `writing` | 🟢 实测兼容 | ✅ 已加速 |
| `table-editor-obsidian` | Advanced Tables 高级表格 | `writing` | 🟢 实测兼容 | ✅ 已加速 |
| `obsidian-style-settings` | Style Settings 主题样式微调 | `writing` | 🟡 部分兼容 | ✅ 已加速 |
| `dataview` | Dataview 笔记数据库查询 | `knowledge` | 🟡 部分兼容 | ✅ 已加速 |
| `templater-obsidian` | Templater 智能写作模板 | `knowledge` | 🟡 部分兼容 | ✅ 已加速 |
| `recent-files-obsidian` | Recent Files 最近编辑文档 | `knowledge` | 🟢 实测兼容 | ✅ 已加速 |
| `tag-wrangler` | Tag Wrangler 标签批量管理 | `knowledge` | 🟢 实测兼容 | ✅ 已加速 |
| `obsidian-excalidraw-plugin` | Excalidraw 手绘白板图解 | `media` | 🟡 部分兼容 | GitHub Release |
| `calendar` | Calendar 日历日记视图 | `knowledge` | 🟢 实测兼容 | ✅ 已加速 |

## 社区 PR 投稿与校验

```bash
node scripts/validate.mjs --check-remote
```

欢迎提交 PR 推荐新的写作插件、补充中文说明或更新兼容性评级，详见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [docs/spec.md](docs/spec.md)。
