# 📚 线上自习室

一个沉浸式线上自习计时工具，支持多种环境音效与视觉特效，帮助提升学习专注力。

> 🌐 在线体验：[https://aiedu2025.github.io/ai-study-room/](https://aiedu2025.github.io/ai-study-room/)

---

## ✨ 功能特性

### 🎯 核心计时
- **学习计时**：支持直接开始或设定时长（倒计时/正计时）
- **课间休息**：一键暂停，独立计时面板
- **休息提醒**：可自定义提醒间隔（默认 50 分钟）
- **状态恢复**：关闭页面后重新打开可续接学习状态

### 🎵 环境音效（7 种）
| 音效 | 联动特效 |
|------|----------|
| 淅淅小雨 🌧️ | 雨滴玻璃效果、下雨线条效果 |
| 森林午夜 🌲 | 萤火虫粒子 |
| 空调 ❄️ | 冷气白雾扩散 |
| 风的心跳 💨 | — |
| 树林草原 🌿 | — |
| 篝火风雨 🔥 | 篝火光照、雨滴、火焰粒子 |
| 雷雨之夜 ⛈️ | 3D 雷雨体积云、闪电、云雾 |

### 🎨 视觉效果
- **视差背景**：多层元素跟随鼠标移动产生深度感
- **动态壁纸**：支持开灯/关灯模式，可导入自定义图片
- **毛玻璃 UI**：玻璃态按钮与面板设计
- **3D 雷雨云**：基于 Three.js 的 Shader 体积云
- **环境特效联动**：随音效自动触发雨滴、篝火、萤火虫等特效
- **圆润 / 方正** 两种主题风格

### 📊 数据统计
- **学习记录**：每次自习自动记录时长与内容
- **可视化图表**：
  - 今日时段分布柱状图
  - 近 6 天学习时长对比柱状图
  - 全部天数趋势折线图（平滑曲线）
  - 自习类型占比饼图（支持按日切换）
- **数据导入/导出**：JSON 格式备份与恢复
- **回收站**：误删记录可恢复

### ⚙️ 设置
- 音量控制（自动记忆）
- 自定义壁纸（开灯/关灯分开设置）
- 环境特效独立开关与参数调节
- 休息提醒间隔
- 屏幕常亮防止息屏
- 自动全屏

---

## 📁 项目结构

```
自习室/
├── index.html              # 主页面
├── app.js                  # 核心逻辑（计时、数据、UI、特效控制）
├── style.css               # 全部样式
├── rain-card-fx.js         # 雨滴玻璃效果（atmos-fx, MIT）
├── raindrop-fx.js          # 下雨线条效果（raindrop-fx, MIT）
├── LICENSE                 # MIT 开源协议
├── README.md               # 本文件
│
├── 音效/                   # 7 个环境音 MP3 + 常亮用 WAV
├── 背景/                   # 河边窗景壁纸
│
├── file_....png            # 学习模式背景
├── 微信图片_....png         # 休息模式背景
└── 用户上传_图标_256.ico   # 网站图标
```

---

## 🚀 快速开始

### 本地使用

```bash
# 克隆仓库

# 直接打开 index.html 即可（无需构建、无需安装依赖）
```

浏览器直接打开 `index.html` 即可使用。所有数据存储在浏览器 localStorage 中。

### 部署到云端

本项目为纯静态前端应用，支持部署到任意静态托管平台：

| 平台 | 说明 |
|------|------|
| **Netlify** | 直接连接 GitHub 仓库自动部署（推荐海外访问） |
| **EdgeOne Pages** | 腾讯云静态托管，国内访问速度快（推荐国内访问） |
| **Cloudflare Pages** | 全球 CDN 加速 |

---

## 🔧 技术栈

| 技术 | 用途 |
|------|------|
| **HTML5** | 页面结构 |
| **CSS3** | 样式、动画、玻璃态、视差 |
| **JavaScript (ES6+)** | 全部应用逻辑 |
| **Canvas API** | 数据可视化图表 |
| **Web Audio API** | 音频播放控制 |
| **Three.js** | 3D 雷雨体积云 Shader 渲染 |
| **WebGL** | 雨滴/下雨特效 |
| **LocalStorage API** | 数据持久化 |
| **Wake Lock API** | 屏幕常亮 |

---

## 📜 第三方授权声明

本项目使用了以下开源项目的代码，在此致谢：

### 直接使用的开源库

| 库名 | 作者 | 协议 | 用途 |
|------|------|------|------|
| **[atmos-fx](https://github.com/CarsonYoung/atmos-fx)** | Carson Ye | MIT | 雨滴玻璃效果 (`rain-card-fx.js`) |
| **[raindrop-fx](https://github.com/SardineFish/raindrop-fx)** | SardineFish | MIT | 下雨线条效果 (`raindrop-fx.js`) |
| **[Three.js](https://github.com/mrdoob/three.js)** | mrdoob & contributors | MIT | 3D 雷雨体积云渲染（通过 CDN 加载） |

### MIT 协议声明

以上 MIT 协议授权的项目，其版权声明如下：

```
MIT License

Copyright (c) [作者] [年份]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

### 参考与灵感项目

以下项目为开发过程中的参考学习资料，未直接集成到本项目中，但仍感谢它们的启发：

| 项目 | 作者 | 协议 |
|------|------|------|
| Internal Beyond | Sui/水 | 自定义 IB 协议（个人非商用） |
| RainEffect | — | 未明确授权 |
| realistic-drifting-cloud-animation | — | 未明确授权 |
| yzrt-master | — | 未明确授权 |

### 音效文件

环境音效来源于公开的白噪音素材，仅用于个人学习场景。如需商用，请自行替换音频文件。

---

## 📝 更新日志

### v2.0（重构版）
- 从单文件重构为多文件架构（index.html + app.js + style.css）
- 新增 3D 雷雨体积云特效（Three.js）
- 新增雨滴玻璃效果和下雨线条效果
- 新增环境特效独立参数调节面板
- 新增自定义壁纸功能（开灯/关灯模式）
- 新增自习类型饼图统计
- 新增回收站功能
- 优化数据可视化图表
- 新增圆润/方正双主题切换

### v1.0（初始版）
- 核心计时功能
- 环境音效系统
- 数据统计可视化
- 基础设置管理

---

## 📄 许可证

本项目采用 **MIT License**，详情见 [LICENSE](./LICENSE) 文件。

---

*⭐ 如果这个项目对你有帮助，欢迎给个 Star！*
