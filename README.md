# 单页预览

按列表预览 HTML 单页：左侧竖向标签栏（窄屏/竖屏为左侧抽屉），右侧大 iframe，底部提供尺寸限制、状态与缩放控制条。纯静态站点，无需构建，运行时也不需要 Node。

## 用 nginx 部署

将仓库 clone 到任意目录，nginx 站点根目录指向仓库根目录：

```nginx
server {
    listen 8080;
    server_name _;
    root /path/to/html-single-page-viewer;
    index index.html;

    location / { }
    location ~ /\. { deny all; }
}
```

访问 `http://<host>:8080/` 即可。修改 `config.json` 后点页面左上角刷新按钮生效，无需重启 nginx。

`location ~ /\. { deny all; }` 用于阻止 `.git` 等隐藏文件被直接下载；不在意时可以去掉。

## 本地预览（可选）

```bash
node server.js          # 或 npm start
```

默认监听 `http://127.0.0.1:4173`；端口被占用时自动向后尝试，也可指定：

```bash
HOST=0.0.0.0 PORT=8080 node server.js
```

Node 只用于本地起一个静态文件服务，nginx 部署不需要它。

## 配置列表

`config.json` 可以是数组，也可以是包含 `entries` 与可选 `title` 的对象；`entries` 中每项可以是字符串路径，也可以是 `{ "path": "...", "title": "..." }`：

```json
{
  "title": {
    "mode": "prefix",
    "value": "单页预览",
    "separator": " · "
  },
  "entries": [
    "assets/showcase/01-bare.html",
    { "path": "assets/showcase/08-form.html", "title": "报名表" }
  ]
}
```

- 路径相对仓库根目录，也可以写以 `/` 开头的站点根路径；只能访问站点目录内的文件。
- 条目中的 `title` 省略时由浏览器读取页面 `<title>`，读不到则回退到文件名。
- `https://` 等 URL 条目暂不支持，会显示为不可用。
- 修改 `config.json` 后点左上角刷新按钮即可重新读取，无需重启服务。文件缺失、目录等无效条目会在左侧标红并给出原因。

### 页面标题

顶层 `title` 控制浏览器标签页标题，支持两种模式：

- **全局固定标题**：`"title": "我的预览器"`（字符串简写），或 `{ "mode": "fixed", "value": "我的预览器" }`。
- **前缀 + 当前项标题**：`{ "mode": "prefix", "value": "单页预览", "separator": " · " }`。选中条目后，标题为 `前缀 + separator + 条目标题`；`separator` 省略时默认为 `" · "`，设为 `""` 可直接拼接；未选中条目时只显示前缀。

未配置 `title` 时使用默认标题 `单页预览`。数组形式的 `config.json` 不支持标题配置。

## 界面与缩放

- 响应式布局：宽屏使用左侧标签栏；窄屏/竖屏顶部合并为单行信息栏（标题、条目统计、当前页标题与操作按钮），条目列表改为由底部状态区左侧菜单按钮召唤的左侧抽屉，覆盖约 70% 宽度；底部状态与控制条按移动端重新排布，并处理安全区内边距。
- 尺寸限制：状态条上方可把 iframe 视口限制为自定义大小。支持“比例 + 短边/长边”中的一项自动计算另一边、同时指定长短边、以及自定义宽度/高度；短边和长边可选自适应或 360–3840 的预设，超过当前真实分辨率的预设不可用。比例默认按横向显示（如 16:9），通过旁边的方向开关可切换为纵向，同一比例项会显示为 9:16、3:4 等纵向值；1:1 时开关可用但比例不变。同时设置长短边或手动输入宽高时，比例改为按实际宽高显示；手动输入会清除比例和长短边。限定尺寸的 iframe 在预览区水平、垂直居中，尺寸超过预览区时按比例适配显示。底部“真实分辨率”和“CSS 视口”始终表示预览区域，不随 iframe 尺寸限制变化。
- 状态条实时显示：
  - **真实分辨率**：iframe 可见区域换算为设备像素（CSS 视口 × 缩放 × DPR）；
  - **CSS 视口**：iframe 当前布局视口，受缩放影响；
  - **DPR**：设备像素比。
- 缩放：拖动底部滑块或使用 `−` / `+` 按钮，范围 25%–200%；右侧按钮恢复 100%。缩放会改变 iframe 的有效 CSS 视口并对画布做变换，效果类似浏览器缩放，便于检查不同宽度下的响应式表现。缩放值保存在浏览器 `localStorage`，刷新后保留。

## 预览原理

纯静态页面：浏览器读取 `config.json`，逐个请求列表中的 HTML 并解析 `<title>`，然后把页面地址交给 iframe。页面内用相对路径引用的 CSS/JS/图片由同一个静态站点直接提供，因此不需要 `/api/entries`、`/fs` 之类的动态接口。

首次加载会额外请求列表中的 HTML 以读取标题（当前 16 个示例页合计约 190KB）；点击左侧条目时直接使用 iframe，不会重复读取列表。状态条通过 iframe 的 `innerWidth` / `innerHeight` 与 `devicePixelRatio` 读取视口信息；缩放通过调整 iframe 布局尺寸并变换画布实现。

## 示例单页

`assets/showcase/` 下有 16 个自拟的演示页面，覆盖不同的内容量、复杂度、完成度与风格。前十个是纯单文件页面，不依赖外部资源；后六个使用本地打包的 React / Vue 与 shaders 运行时。

| 文件 | 内容 |
| --- | --- |
| `01-bare.html` | 无样式的默认 HTML，内容极少 |
| `02-poster.html` | 瑞士风格字体海报，大字号、强网格 |
| `03-longform.html` | 长篇衬线体阅读页，含首字下沉、插图与脚注 |
| `04-dashboard.html` | 深色运维仪表盘，SVG 图表与定时刷新 |
| `05-terminal.html` | 可交互的复古终端，支持 help/ls/cat/theme 等命令 |
| `06-retro.html` | 90 年代个人主页，跑马灯、计数器、高饱和配色 |
| `07-glass.html` | 现代玻璃拟态落地页，渐变光斑与毛玻璃卡片 |
| `08-form.html` | 三步式报名表单，带校验、步骤条与结果摘要 |
| `09-gallery.html` | 纯 CSS 渐变画廊，9 幅作品、点击放大 |
| `10-docs.html` | 高密度 API 文档，侧边目录、代码块复制 |
| `12-react-aurora.html` | React × shaders：极光 + 网格渐变双层合成器，参数实时联动 |
| `13-react-noir.html` | React × shaders：光标轨迹海报，移动绘制、点击换配色 |
| `15-react-synapse.html` | React × shaders：神经脉冲 HUD，高速粒子流与故障扫描 |
| `16-react-helios.html` | React × shaders：轨道观测站，全息星球与缓慢扫描的轨道环 |
| `17-vue-lucid.html` | Vue × shaders：流光万花筒，跟随光标的高速镜像与星芒 |
| `18-vue-reverie.html` | Vue × shaders：雾中梦，2 秒明暗过渡的呼吸光效、大小不一的浮游光斑、烟雾与柔和渐变 |

后六页使用 [shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders) 的 React / Vue 组件（WebGPU）。依赖已本地打包在 `assets/showcase/vendor/`（`shaders@4.0.7`、React 19、Vue 3.5），预览时不需要联网。**浏览器需支持 WebGPU**（Chrome / Edge 113+ 等），且需通过 `localhost` 或 HTTPS 访问；不支持或非安全上下文时页面会显示降级提示，文字与交互仍可用。

## 目录

- `index.html`：界面
- `config.json`：预览列表
- `assets/showcase/`：16 个示例单页
- `server.js`：可选的本地静态服务
