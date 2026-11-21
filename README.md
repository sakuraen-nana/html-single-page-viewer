# 单页预览

本地按列表预览 HTML 单页：左侧竖向标签栏，右侧大 iframe。

## 运行

```bash
node server.js          # 或 npm start
```

默认监听 `http://127.0.0.1:4173`；端口被占用时自动向后尝试，也可指定：

```bash
HOST=0.0.0.0 PORT=8080 node server.js
```

## 配置列表

编辑 `config.json`，顶层是数组，每项可以是字符串路径，也可以是 `{ "path": "...", "title": "..." }`：

```json
[
  "assets/showcase/01-bare.html",
  { "path": "assets/showcase/08-form.html", "title": "报名表" }
]
```

- 路径相对本项目根目录，也接受绝对路径。
- `title` 省略时自动读取页面 `<title>`，读不到则回退到文件名。
- 支持 URL 是后续规划，当前填写 `http(s)://` 会显示为不可用条目。
- 修改 `config.json` 后点左上角刷新按钮即可重新读取，无需重启服务。文件缺失、目录等无效条目会在左侧标红并给出原因。

## 预览原理

iframe 内用相对路径引用的 CSS/JS/图片需要正常的 HTTP 服务，`file://` 直接打开做不到，所以用一个零依赖的 Node 服务：`/api/entries` 返回解析后的列表，`/fs/<绝对路径>` 按原 MIME 类型返回文件。

只有 `config.json` 中列出的条目本身及其所在目录会被加入允许访问的根目录；其他路径（如 `/etc/passwd`）返回 403。

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
| `11-react-prism.html` | React × shaders：棱镜光束全屏着陆页，可切换光源预设 |
| `12-react-aurora.html` | React × shaders：极光实时控制台，滑块/取色器驱动 GPU 参数 |
| `13-react-noir.html` | React × shaders：光标轨迹海报，移动绘制、点击换配色 |
| `14-vue-nebula.html` | Vue × shaders：星云香氛商品页，粒子与星云背景 |
| `15-vue-forge.html` | Vue × shaders：渐变工坊，v-model 实时驱动 MeshGradient |
| `16-vue-cursor.html` | Vue × shaders：交互海报，光标轨迹 + 坐标读数 + 配色切换 |

后六页使用 [shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders) 的 React / Vue 组件（WebGPU）。依赖已本地打包在 `assets/showcase/vendor/`（`shaders@4.0.7`、React 19、Vue 3.5），预览时不需要联网。**浏览器需支持 WebGPU**（Chrome / Edge 113+ 等）；不支持时页面会显示降级提示，文字与交互仍可用。

## 目录

- `server.js`：静态与 API 服务
- `public/index.html`：界面
- `config.json`：预览列表
- `assets/showcase/`：16 个示例单页
