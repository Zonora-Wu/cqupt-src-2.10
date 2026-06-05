# 前端构建检查

检查 CQUPT-SRC 前端是否仍能构建，并定位失败原因。

## 步骤

1. 先读取：
   - `frontend/package.json`
   - `frontend/tsconfig*.json`
   - `frontend/vite.config.ts`
   - 与错误相关的 `frontend/src/` 文件
2. 运行：

```bash
cd frontend && npm run build
```

3. 如果失败：
   - 修源码，不修 `frontend/dist`。
   - 不要读取 `frontend/node_modules`。
   - 区分 TypeScript 错误、Vite 构建错误、资源路径错误。
4. 修复后重新运行 build。

## 输出

- build 是否通过
- 如果失败，列出错误文件和根因
- 修复了哪些文件
- 是否还需要 lint 或浏览器验证
