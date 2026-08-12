# Three.js Jimeng Previs Skill

这是一个面向 Codex 的 Three.js 动画预演技能，用于制作符合即梦（Dreamina / Seedance）偏好的中性白模参考视频；默认保持白模，仅在用户明确提出对象颜色时启用简单标记色。

主要能力：

- 将 Three.js 场景统一为 Blender Workbench 风格的白模效果
- 根据用户措辞、参考图和可靠常识综合判断对象标记色，同时保持中性的非真实材质参数
- 提供可复制的统一播放、逐帧、自由观察、截帧和导出 UI
- 复用 Camera Rig、Shot、Studio Stage、白模 Primitive 和安全 GLB normalize helpers
- 保留原生 Three.js / GSAP `onFrame()` escape hatch，不强制使用 DSL
- 只维护一套当前 API，不为旧项目堆叠兼容层
- 复用白模材质、异步加载门控和确定性相机帧时钟
- 使用固定 24 fps 保证相机动画可重复
- 自动抓取多张关键帧，并要求 Codex 实际看图验收
- 逐帧导出并检查 H.264 MP4 视频参数

## 安装

```powershell
git clone https://github.com/Purextreme/threejs-jimeng-previs.git "$HOME\.codex\skills\threejs-jimeng-previs"
```

安装后重启 Codex，然后在任务中使用 `$threejs-jimeng-previs`，或直接要求创建“适合即梦参考的 Three.js 白模动画预演”。
