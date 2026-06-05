# 后端构建检查

检查 CQUPT-SRC 后端是否仍能构建，并定位失败原因。

## 步骤

1. 先读取：
   - `backend/package.json`
   - `backend/tsconfig.build.json`
   - 如果失败涉及 Prisma，再读 `database/prisma/schema.prisma`
2. 运行：

```bash
cd backend && npm run build
```

3. 如果失败：
   - 只定位与当前改动相关的错误。
   - 不要修改 `backend/dist`。
   - 不要读取 `node_modules`，除非错误明确来自依赖类型且用户允许。
4. 修复后重新运行 build。

## 输出

- build 是否通过
- 如果失败，列出错误文件和根因
- 修复了哪些文件
- 是否还需要 Prisma validate 或 E2E
