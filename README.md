# Three.js Jimeng Previs Skill

这是一个面向 Codex 的 Three.js 动画预演技能，用于制作符合即梦（Dreamina / Seedance）偏好的中性白模参考视频。

主要能力：

- 将 Three.js 场景统一为 Blender Workbench 风格的白模效果
- 提供可复制的统一播放、逐帧、自由观察、截帧和导出 UI
- 复用白模材质、GLB 加载和确定性相机帧时钟
- 使用固定 24 fps 保证相机动画可重复
- 自动抓取多张关键帧，并要求 Codex 实际看图验收
- 逐帧导出并检查 H.264 MP4 视频参数

## 安装

```powershell
git clone https://github.com/Purextreme/threejs-jimeng-previs.git "$HOME\.codex\skills\threejs-jimeng-previs"
```

安装后重启 Codex，然后在任务中使用 `$threejs-jimeng-previs`，或直接要求创建“适合即梦参考的 Three.js 白模动画预演”。
