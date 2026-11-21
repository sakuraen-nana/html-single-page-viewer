# 本地运行时

后六个示例单页（11–16）使用这两个本地打包的运行时，避免预览时依赖 CDN：

| 文件 | 内容 |
| --- | --- |
| `react-runtime.js` | React 19.3.1、React DOM、htm 3.1.1、`shaders/react` 4.0.7，暴露 `window.HSPV_REACT` |
| `vue-runtime.js` | Vue 3.5.46（含模板编译器）、`shaders/vue` 4.0.7，暴露 `window.HSPV_VUE` |

构建方式：用 esbuild 以 production 模式打包，`shaders` 的 React / Vue 组件与 WebGPU 引擎一并内联；`disableTelemetry` 在页面中全部开启。第三方许可证见 `licenses/`。

- shaders: https://github.com/shader-effects-inc/shaders （MIT）
- React / React DOM / Scheduler（MIT）
- Vue（MIT）
- htm（Apache-2.0）
- typegpu（MIT）
