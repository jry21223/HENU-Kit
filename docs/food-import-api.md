# 美食数据导入 API

`POST /api/food-import` 接收单个商家、商家数组，或 `{ "spots": [...] }`。相同 `id` 会更新，不同 `id` 会新增。

## 本地导入

本地预览会模拟管理员身份：

```powershell
npm run food:push -- data/food-spots.source.json
```

本地预览使用临时数据，重启预览后会清空；部署后的站点写入 D1，会持久保存。

只校验、不写入：

```powershell
npm run food:push -- data/food-spots.source.json --dry-run
```

## 远程导入

先在托管环境设置 `IMPORT_API_KEY`，调用时使用：

```powershell
$env:HENU_API_URL = "https://你的站点地址"
$env:HENU_IMPORT_API_KEY = "你的导入密钥"
npm run food:push -- data/food-spots.source.json
```

也可以直接发送 HTTP 请求：

```bash
curl -X POST "https://你的站点地址/api/food-import" \
  -H "Authorization: Bearer YOUR_IMPORT_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @data/food-spots.source.json
```

限制：每次最多 100 家商户，请求体不超过 1 MB，图片和来源地址必须为 HTTPS。
