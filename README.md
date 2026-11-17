<div align="center">
  <img width="112" height="112" src="./assets/logo.png" alt="Danmaku Anywhere logo">
  <h1>弹幕任何地方 · WuLinLee Fork</h1>
  <p><em>Danmaku Anywhere — Smart Danmaku Density Edition</em></p>
  <p>
    <a href="https://github.com/Danmaku-Anywhere/danmaku-anywhere">上游项目</a> ·
    <a href="https://docs.danmaku.weeblify.app/">项目文档</a> ·
    <a href="https://github.com/WuLinLee/danmaku-anywhere/releases/tag/smart-danmaku-density-preview">本仓库预览版</a>
  </p>
  <p>
    <img alt="Upstream sync" src="https://img.shields.io/github/actions/workflow/status/WuLinLee/danmaku-anywhere/weekly-smart-density-sync.yml?branch=master&label=upstream%20sync">
    <img alt="Preview build" src="https://img.shields.io/github/actions/workflow/status/WuLinLee/danmaku-anywhere/smart-density-build.yml?branch=danmaku-customizations&label=preview%20build">
    <img alt="License" src="https://img.shields.io/badge/extension-AGPL--3.0-blue">
  </p>
</div>

> 给原本没有弹幕的视频网站加上弹幕，并在弹幕密集时自动减少视觉拥挤。

这是 [Danmaku Anywhere 官方项目](https://github.com/Danmaku-Anywhere/danmaku-anywhere) 的个人定制 fork。它保留上游的浏览器扩展、弹幕来源和 Web 应用，同时加入了**智能弹幕密度控制**，并围绕弹幕合并、过滤反馈、样式和操作体验做了一系列调整。

本仓库不是独立开发的替代品。上游负责项目主体和持续开发；本仓库负责维护自己的定制代码、预览构建和上游同步自动化。

## 目录

- [先安装哪个版本](#先安装哪个版本)
- [本仓库增加了什么](#本仓库增加了什么)
- [智能弹幕密度如何工作](#智能弹幕密度如何工作)
- [上游功能与项目组成](#上游功能与项目组成)
- [分支说明](#分支说明)
- [每周上游同步与当前状态](#每周上游同步与当前状态)
- [本地开发与构建](#本地开发与构建)
- [许可证与致谢](#许可证与致谢)

## 先安装哪个版本

### 日常使用：官方稳定版

普通使用建议优先安装上游正式发布的版本。它的更新不依赖本仓库的定制同步任务：

| 浏览器 | 安装地址 |
| --- | --- |
| Chrome | [Chrome 网上应用店](https://chromewebstore.google.com/detail/danmaku-anywhere/jnflbkkmffognjjhibkjnomjedogmdpo?hl=zh) |
| Edge | [Microsoft Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/danmaku-anywhere/alcoddhlgdbhlljlnhckhomdcgbnmanf) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/danmaku-anywhere/) |
| Android | 可使用支持扩展的浏览器，安装方式见[上游下载说明](https://docs.danmaku.weeblify.app/downloads/) |

### 体验本仓库的定制版

本仓库提供一个 Chrome 扩展预览包：

**[下载 Smart Danmaku Density Preview（Chrome ZIP）](https://github.com/WuLinLee/danmaku-anywhere/releases/download/smart-danmaku-density-preview/smart-danmaku-density-chrome.zip)**

[查看预览版 Release](https://github.com/WuLinLee/danmaku-anywhere/releases/tag/smart-danmaku-density-preview)

安装方式：

1. 下载 ZIP 并解压到一个固定文件夹。
2. 打开 Chrome 或 Chromium 内核浏览器的扩展管理页面。
3. 开启“开发者模式”。
4. 选择“加载已解压的扩展程序”，指向解压后的文件夹。

这个预览包由 `danmaku-customizations` 分支构建，当前发布渠道是 **Chrome ZIP**，不是上游商店正式版。由于本仓库的每周上游同步目前存在合并失败，预览包可能落后于官方上游和当前源码；下载前请查看 [预览构建记录](https://github.com/WuLinLee/danmaku-anywhere/actions/workflows/smart-density-build.yml)。

## 本仓库增加了什么

### 1. 智能弹幕密度控制

在弹幕设置中增加 0–100 的 **Smart Danmaku Density** 滑块。它根据某一时间段内弹幕的估算视觉负载，平滑地减少拥挤片段中的部分弹幕，而不是简单地限制每秒最多显示多少条。

- **100：** 不启用密度过滤，保留全部候选弹幕。
- **数值越低：** 越倾向于清爽画面，密集片段过滤得越多。
- **稀疏片段：** 不会因为滑块较低就机械地删掉弹幕。
- **内容保护：** 白名单弹幕和合并弹幕组的代表弹幕不会被密度算法删除。
- **不会补播：** 被过滤的弹幕不会排队，也不会在之后重新出现。

密度过滤会与原有文本过滤、白名单、重复去重和弹幕合并流程共同工作。详情见下方[算法说明](#智能弹幕密度如何工作)。

### 2. 更完整的重复弹幕归一化与合并

用于自动合并相似弹幕的文本归一化增加了以下处理：

- 统一全角与半角字符，例如将全角数字转换为普通数字。
- 忽略空格和标点差异。
- 压缩连续重复字符，降低“哈哈哈哈哈”“哈哈哈”这类重复刷屏的差异。

原有的规则合并、自动合并、合并数量显示和白名单机制仍然保留。

### 3. 评论列表显示弹幕处理原因

弹幕评论列表会复用渲染侧的编译/判定逻辑，显示评论为什么没有按普通弹幕显示，例如：

- 被文本或正则规则屏蔽
- 命中白名单
- 与其他弹幕重复
- 被合并进某个弹幕组
- 被智能密度过滤

这样可以区分“弹幕没有获取到”和“弹幕已获取，但被显示规则处理”。

### 4. 播放器与设置体验调整

此外还包含以下修改：

- **恢复默认设置：** 扩展弹出窗口和视频悬浮控制栏都增加带确认提示的恢复默认设置入口。
- **自定义 CSS：** 弹幕播放器重新挂载或重建后，会重新应用自定义 CSS。
- **合并弹幕外观：** 调整胶囊背景、边框、文字和计数器样式。
- **文字描边：** 为弹幕底部增加测量留白，减少描边被裁切的问题。
- **提示时长：** 普通信息/成功提示默认显示 1 秒；警告/错误提示默认显示 3.5 秒；显式指定的时长优先。

## 智能弹幕密度如何工作

密度算法位于 `packages/danmaku-engine/src/density.ts`，由弹幕引擎的编译流程调用。

它不是“屏幕上最多显示 N 条”或“每秒最多显示 N 条”的硬性数量上限。算法会综合考虑：

1. **时间窗口内的弹幕负载：** 使用弹幕显示时长附近的时间窗口估算同一时段的拥挤程度。
2. **文字长度：** 较长的文字通常占用更多画面空间，因此负载权重更高。
3. **字体大小：** 字号越大，估算的视觉成本越高。
4. **弹幕类型：** 顶部和底部固定弹幕使用不同的负载权重。
5. **显示区域：** 用户缩小弹幕显示区域时，可用空间减少，过滤会相应变得更积极。
6. **文本信息特征：** 算法会适度优先保留字符更丰富的内容，降低连续重复字符或纯符号刷屏弹幕的保留优先级。

算法使用稳定的哈希判定，避免同一批弹幕在相同配置下因为随机数而反复变化。它只对负载过高的片段进行软过滤，不会为了达到某个固定数量而过滤自然稀疏的片段。

密度过滤位于编译流程的后段：先处理屏蔽规则、白名单、相同文本去重和合并分组，再评估普通弹幕。白名单弹幕与合并组代表弹幕会计入局部负载，但不会被密度算法丢弃。

相关测试位于 `packages/danmaku-engine/src/density.test.ts`，覆盖文本归一化、100 不过滤、稀疏片段保留、低密度比高密度过滤更多，以及白名单/合并代表保护等行为。

## 上游功能与项目组成

本仓库继承了 Danmaku Anywhere 的主体能力。具体网站能否正常播放和显示弹幕，仍取决于网站播放器结构、站点配置、弹幕源和浏览器权限。

### 浏览器扩展

扩展通过浏览器内容脚本识别网页中的视频，并在视频区域叠加弹幕，不要求额外安装桌面客户端。上游项目提供的功能包括：

- 在自托管媒体服务器和视频网站上使用弹幕，例如 Plex、Emby、Jellyfin、YouTube 等。
- 从弹弹 play、B 站、腾讯、MacCMS/Vod 等弹幕来源获取内容，也支持兼容弹弹 play API 的服务。
- 导入本地 XML 弹幕文件，并导出已获取的弹幕。
- 根据视频信息搜索、匹配弹幕，也可使用自定义匹配规则和 AI 匹配能力。
- 配置弹幕速度、字号、透明度、显示区域、过滤规则、特殊弹幕等显示选项。
- 使用自定义 CSS 调整弹幕外观。

### Web 应用

在线地址：[danmaku.weeblify.app](https://danmaku.weeblify.app/)

这是一个基于 Kazumi 规则的实验性 Web 看番应用，支持浏览规则来源、搜索和播放视频，也提供本地视频播放与 PWA 能力。**完整使用需要安装 Danmaku Anywhere 浏览器扩展。**

### 代码仓库结构

本项目采用 pnpm workspace，多包协作：

| 目录 | 作用 |
| --- | --- |
| `packages/danmaku-anywhere` | 浏览器扩展主体：后台服务、网页注入、播放器、悬浮控制器和弹出窗口 |
| `packages/danmaku-engine` | 弹幕编译、过滤、合并与渲染逻辑；本仓库智能密度算法位于此处 |
| `packages/danmaku-converter` | 弹幕格式解析、转换与规范化 |
| `packages/danmaku-provider` | 弹幕来源及其 API 适配 |
| `packages/web-scraper` | 网页与媒体信息抓取 |
| `packages/bangumi-api` | Bangumi API 类型与数据结构 |
| `packages/integration-policy` | 站点集成策略相关结构 |
| `packages/result` | 通用 Result 类型工具 |
| `app/web` | Kazumi 规则 Web 应用（Angular） |
| `app/release-manager` | Tauri 桌面发布管理工具 |
| `backend/proxy` | Cloudflare Worker 代理服务 |
| `docs` | Astro / Starlight 项目文档 |

注意：上游正在调整仓库边界，部分后端能力已迁移到独立仓库；本 fork 的定制分支仍保留自己的 monorepo 快照。请以对应分支的实际文件为准。

## 分支说明

| 分支 | 用途 | 是否作为当前开发入口 |
| --- | --- | --- |
| `master` | 默认分支，维护 fork 自己的 GitHub Actions、上游同步和通知工作流 | 否 |
| `danmaku-customizations` | 定制功能所在分支，也是智能密度 Chrome 预览版的构建来源 | **是** |
| `smart-danmaku-density` | 保留的旧版定制代码/回滚备份；已关闭自动预览发布 | 否 |

如果要继续开发智能密度功能，请从 `danmaku-customizations` 分支开始，不要把 `master` 当成最新定制源码分支。

## 每周上游同步与当前状态

本仓库在 `master` 分支配置了 `Sync Official Upstream`：

1. 每周一由 GitHub Actions 定时运行，也可以手动触发。
2. 从官方仓库 `Danmaku-Anywhere/danmaku-anywhere` 拉取最新 `master`。
3. 读取 `.github/upstream-sync-commit` 记录的上次同步提交，将上游代码合入 `danmaku-customizations`。
4. 保留定制分支自己的 `.github/workflows`，不把官方工作流覆盖到 fork。
5. 仅当同步产生源码变化时，推送定制分支并启动预览构建。

预览构建会安装依赖、构建 workspace 包、运行智能密度算法测试、检查扩展 TypeScript 类型、构建 Chrome 扩展，并验证 ZIP 根目录中存在有效的 Manifest V3 `manifest.json`。全部通过后，更新 `smart-danmaku-density-preview` Release，并删除同一 Release 中的旧附件。

### 同步故障修复记录（2026-11-18）

**此前的连续五次周一同步失败已经修复。** 失败运行发生于 2026-10-19、10-26、11-02、11-09 和 11-16。

#### 原因

原脚本使用 `git merge-tree --write-tree -X ours`，但 fork 删除了若干上游仍有更新的 GitHub Actions 工作流文件。Git 将这些情况判定为删除/修改冲突；同时，原脚本通过命令替换捕获输出并在严格 shell 模式下执行，冲突信息没有被正确展示，导致问题难以定位。

移除工作流目录冲突后，真正需要人工整合的源码文件只有三个：

- `DanmakuStylesForm.tsx`：上游新增的人物遮挡实验选项与 fork 的智能密度控件。
- `toastStore.ts`：上游新增的按 ID 更新通知、加载状态和主动关闭能力，与 fork 的提示时长调整。
- 英文翻译文件：上游文案更新与 fork 的密度、恢复默认设置文案。

#### 修复方式

- 同步时临时以“上次同步的上游版本”作为工作流目录的合并输入，避免官方工作流改动与 fork 自己的 CI 互相冲突。
- 合并完成后，先移除合并树中的工作流目录，再准确恢复定制分支原有的工作流集合，防止把上游新增的 workflow 文件意外带入推送。
- 将三个源码冲突文件基于当前上游版本重新整合：保留上游新增行为，同时叠加 fork 的定制功能。
- 仅在这次已审阅的旧同步基准迁移时使用一次性冲突偏好；完成迁移后已从工作流中移除。今后的源码合并使用普通 Git 合并，不会静默选择任意一边；遇到新冲突会输出文件诊断并停止，等待人工处理。
- 将上游地址统一为官方组织仓库 `Danmaku-Anywhere/danmaku-anywhere`。

#### 验证结果

- **上游同步：** GitHub Actions run [#16](https://github.com/WuLinLee/danmaku-anywhere/actions/runs/44128815751) 成功，已将同步标记推进到上游提交 `6f3bad135023415bc713e1fc0cc3907f0d2ef120`，并成功推送 `danmaku-customizations`。
- **常规同步检查：** 随后移除一次性迁移逻辑，再次运行的 [#17](https://github.com/WuLinLee/danmaku-anywhere/actions/runs/44129081970) 成功，说明没有新上游提交时的检查路径也正常。
- **预览构建：** [run #33](https://github.com/WuLinLee/danmaku-anywhere/actions/runs/44129129553) 全部成功，包括 workspace 构建、智能密度测试、扩展类型检查、Chrome 构建、ZIP 校验、上传和 Release 更新。
- **预览包：** [smart-danmaku-density-preview](https://github.com/WuLinLee/danmaku-anywhere/releases/tag/smart-danmaku-density-preview) 已更新，当前附件为 `smart-danmaku-density-chrome.zip`（27,266,224 bytes）。

这修复的是自动同步和预览发布链路，不代表以后上游每次改动都一定能无冲突合并。今后如出现新的源码冲突，工作流会明确失败并输出冲突路径，而不是默默丢弃上游或 fork 的代码。

查看实时状态：

- [上游同步工作流](https://github.com/WuLinLee/danmaku-anywhere/actions/workflows/weekly-smart-density-sync.yml)
- [定制版构建工作流](https://github.com/WuLinLee/danmaku-anywhere/actions/workflows/smart-density-build.yml)
- [自动失败通知 Issues](https://github.com/WuLinLee/danmaku-anywhere/issues)

## 本地开发与构建

### 环境要求

- Node.js 24 或更高版本
- pnpm 11（仓库锁定的 package manager 为 pnpm 11.2.2）
- 开发浏览器扩展需要 Chrome 或兼容 Chromium 的浏览器

### 获取定制源码

```bash
git clone https://github.com/WuLinLee/danmaku-anywhere.git
cd danmaku-anywhere
git switch danmaku-customizations
corepack enable
pnpm install --frozen-lockfile
```

### 构建共享包、测试与构建扩展

在仓库根目录执行：

```bash
# 构建扩展依赖的 workspace 包
pnpm build:packages

# 运行智能密度算法测试
pnpm --filter @danmaku-anywhere/danmaku-engine test

# 检查扩展 TypeScript 类型
pnpm --filter @mr-quin/danmaku-anywhere type-check

# 构建 Chrome 扩展
pnpm --filter @mr-quin/danmaku-anywhere build
```

扩展源码位于 `packages/danmaku-anywhere`。开发浏览器和更多开发命令请参考[上游开发文档](https://docs.danmaku.weeblify.app/development/structure/)；运行定制版 CI 的实际命令以本仓库的 [Build and Publish Preview](https://github.com/WuLinLee/danmaku-anywhere/blob/master/.github/workflows/smart-density-build.yml) 为准。

## 许可证与致谢

本仓库基于 [Danmaku-Anywhere/danmaku-anywhere](https://github.com/Danmaku-Anywhere/danmaku-anywhere) 开发，原项目的作者、贡献者和美术资源创作者仍应获得相应署名。

不同目录和 workspace 包可能采用不同许可证。浏览器扩展主体 `packages/danmaku-anywhere` 使用 AGPL-3.0；其他部分请分别查看其目录中的 `LICENSE` 或 `package.json`，不要仅凭仓库根目录许可证推断所有组件的授权方式。

感谢上游项目及所有弹幕源、规则和开源依赖的维护者。
