# HENUKit 资料库自动更新与 Hook 开发文档

版本：1.0  
快照日期：2026-07-17

## 1. 目标

HENUKit 需要持续采集河南大学校级部门和各学院公开的通知、细则、附件与新闻。当上游网页发生新增、修改、替换、补充、撤回或附件更新时，系统应自动检测变化，生成内部事件，通过 Hook 更新资料库、全文搜索和向量索引。

核心原则：

> 存储层保留全部历史版本；查询层默认采用经确认的最新有效版本；新页面只有在正文完整、关系明确且验证通过后，才可切换为 current。

河南大学多数来源为 HTML 列表页和详情页，而不是主动推送的 Webhook。因此第一阶段采用“定时轮询 + 内部 Hook”，不要把轮询误称为上游 Webhook。

## 2. 总体架构

```text
Source Scheduler
  → Source Adapter
  → Raw Snapshot Store
  → Normalizer
  → Diff Engine
  → Policy/Relation Resolver
  → Transactional Outbox
  → Internal Webhook Dispatcher
  → Knowledge Base Updater
  → Full-text / Vector Index
```

### 2.1 组件职责

- **Source Scheduler**：按来源优先级和更新频率调度任务。
- **Source Adapter**：适配教务处、学生处、学院站点等不同模板。
- **Raw Snapshot Store**：保存原始 HTML、响应头和附件二进制。
- **Normalizer**：去掉导航、页脚、访问量、动态时间等噪声，提取正文。
- **Diff Engine**：对列表、元数据、正文和附件分别计算变化。
- **Relation Resolver**：判断“替代、修订、补充、撤回、年度继任”。
- **Outbox**：保证数据库更新与事件发布原子一致。
- **Webhook Dispatcher**：签名、发送、重试和死信处理。
- **Knowledge Updater**：更新结构化资料、全文索引、向量分块和 current 指针。

## 3. 更新检测

### 3.1 条件请求

来源支持时保存 `ETag` 和 `Last-Modified`，下次发送：

```http
If-None-Match: "<etag>"
If-Modified-Since: <http-date>
```

服务器返回 `304 Not Modified` 时不重复解析。学校站点若不稳定提供响应头，则回退到内容哈希。

### 3.2 四类指纹

```text
list_hash           = SHA256(normalized_title + detail_url + published_date)
raw_hash            = SHA256(raw_html_bytes)
content_hash        = SHA256(normalized_main_text)
attachment_set_hash = SHA256(sorted(file_sha256 + logical_name))
```

不要把访问量、当前时间、随机脚本参数写入 `content_hash`，否则会频繁误报。

### 3.3 变化类型

- 新 URL、新 canonical key：`document.created`
- URL 不变、正文哈希改变：`document.content_updated`
- 仅标题、日期、分类改变：`document.metadata_updated`
- 附件集合或二进制哈希改变：`attachment.updated`
- 页面消失或明确撤稿：`document.withdrawn_candidate`
- 列表出现新条目但正文受限：`document.candidate_update_detected`

## 4. 文档与版本模型

### 4.1 逻辑文档和不可变版本

```text
Document: 外语学院本科毕业生评先奖优规则
├── Version 1: 2024
├── Version 2: 2025
└── Version 3: 2026 [current]
```

禁止直接覆盖旧正文。每次变化都新增 `document_versions`，再按规则切换 `documents.current_version_id`。

### 4.2 policy_family_key

用于判断两个文件是否属于同一政策家族：

```text
issuer + policy_type + audience + scope
```

示例：

```text
foreign_languages:award_review:undergraduate_graduating:annual
```

不要只根据标题相似度合并。以下类型必须分开：

- `push_recommendation`：本校本科生取得推免资格；
- `push_admission`：学院接收已取得推免资格的学生；
- `scholarship_rule`：奖学金评定规则；
- `scholarship_result`：拟获奖名单公示；
- `award_rule`：评先奖优实施细则；
- `award_result`：评选结果公示。

## 5. “以最新为准”的确定规则

### 5.1 自动判定优先级

1. 正文明确出现“原文件废止”“以本通知为准”“自发布之日起施行并替代……”：高置信度自动替代。
2. 同一政策家族、明确生效日期更晚、适用范围一致：可自动创建替代关系。
3. 同一年度系列的新学年文件：将上一年度标为 `expired`，新年度在生效区间内设为 `current`。
4. 标题含“补充通知”“说明”“修正”：建立 `supplements` 或 `amends`，不默认完全替代。
5. 仅标题相似、正文受限或适用对象不清：`manual_review`，禁止自动切换 current。

### 5.2 current 切换门槛

新版本必须同时满足：

- `extraction_status` 必须属于根 README 中的结构化提取状态，并通过 `canBecomeCurrent` 规则；
- 正文和附件（若附件构成规则核心）已校验；
- 来源为官方站点或已认证镜像；
- 适用对象、政策类型和生效时间已解析；
- 替代置信度达到阈值，或人工审核通过；
- 不存在未解决的正文内部矛盾。

`blocked_405`、`blocked_or_unavailable`、`list_extracted`、`official_notice_metadata_only`、历史版、正文冲突版和附件缺失版只能触发候选更新和人工任务，不能自动替代完整 current 版本。

### 5.3 补充文件

当前有效规则可能是：

```text
主细则 + 一份或多份仍有效的补充通知
```

查询接口应同时返回主版本和有效 supplements，而不是把补充通知错误地当作完整新版。

## 6. 数据库设计

详细 SQL 见 `schema.sql`。核心表：

- `sources`
- `crawl_runs`
- `documents`
- `document_versions`
- `document_relationships`
- `attachments`
- `outbox_events`
- `webhook_deliveries`
- `knowledge_chunks`
- `manual_review_tasks`

## 7. Transactional Outbox

在同一数据库事务中写入版本、current 指针和 outbox 事件：

```sql
BEGIN;
INSERT INTO document_versions (...);
UPDATE documents SET current_version_id = ... WHERE ...;
INSERT INTO outbox_events (...);
COMMIT;
```

独立 dispatcher 读取未发送事件并调用 Hook。这样避免“数据库已更新但 Hook 丢失”或“Hook 已发送但数据库回滚”。

## 8. Hook 事件

建议采用 CloudEvents 风格的公共字段，但业务字段由 HENUKit 自己定义：

```json
{
  "specversion": "1.0",
  "id": "evt_01...",
  "source": "henukit://crawler/henu-wy",
  "type": "cn.henukit.document.superseded.v1",
  "time": "2026-07-17T08:00:00Z",
  "subject": "document/doc_01...",
  "datacontenttype": "application/json",
  "data": {
    "document_id": "doc_01...",
    "previous_version_id": "ver_2025",
    "current_version_id": "ver_2026",
    "policy_family_key": "foreign_languages:award_review:undergraduate_graduating:annual",
    "reason": "same_family_new_effective_year",
    "confidence": 0.98
  }
}
```

事件类型建议：

```text
document.created
document.content_updated
document.metadata_updated
document.superseded
document.supplemented
document.withdrawn
document.candidate_update_detected
attachment.created
attachment.updated
attachment.manual_action_required
source.parser_failed
source.recovered
```

## 9. 安全、幂等与重试

### 9.1 签名

发送端使用共享密钥计算 HMAC-SHA256：

```text
signed_payload = timestamp + "." + raw_request_body
signature = HMAC_SHA256(secret, signed_payload)
```

请求头：

```http
X-HENUKit-Event-Id: evt_...
X-HENUKit-Timestamp: 1784275200
X-HENUKit-Signature: v1=<hex>
```

接收端校验时间窗口、签名和 event_id，使用常量时间比较，拒绝重放。

### 9.2 幂等键

```text
idempotency_key = source_key + canonical_key + version_hash + event_type
```

数据库建立唯一索引。同一事件重复投递只处理一次。

### 9.3 重试

建议指数退避并加入抖动：立即、1分钟、5分钟、30分钟、2小时。尊重目标服务返回的 `Retry-After`。超过上限进入死信队列并告警。

## 10. 资料库更新

Hook 消费者在一个可恢复事务中执行：

1. 校验签名和幂等键；
2. 读取新版本正文和附件；
3. 解析 PDF、Word、HTML；
4. 按标题层级和语义边界重新分块；
5. 写入新 `knowledge_chunks`；
6. 将旧版本分块设为 `is_current=false`；
7. 将新版本分块设为 `is_current=true`；
8. 更新全文搜索和向量索引；
9. 提交消费状态。

默认问答必须过滤：

```sql
WHERE knowledge_chunks.is_current = TRUE
  AND document_versions.validity_status = 'current'
```

用户明确查询历史年份时，才解除 current 过滤，并在回答中显示适用年份。

## 11. 受限页面的安全处理

### HTTP 405

列表发现新条目但详情页返回405：

```text
创建 index-only 候选版本
→ 触发 document.candidate_update_detected
→ 建立人工补录任务
→ 不切换 current
```

### 验证码附件

正文正常入库，附件标记 `blocked_or_unavailable`，触发 `attachment.manual_action_required`。新附件未取得前，不得删除旧附件或假定附件内容未变。

### 页面删除

单次404不立即撤回，应多次确认并检查列表、站点迁移和重定向。只有明确撤稿声明或连续失败达到阈值，才进入人工审核或标记 withdrawn。

## 12. 采集频率

- 教务处、学生处、团委、就业：15–30分钟；
- 学院通知：1–2小时；
- 规章制度栏目：每天一次；
- 历史回溯：首次导入时抓取3–5年，之后低频复查。

对同一域名设置并发上限、请求间隔和退避，避免给学校网站造成压力。

## 13. API 设计

```http
GET /api/v1/rules/current?college=wy&type=award_review
GET /api/v1/rules/{document_id}/versions
GET /api/v1/rules/{document_id}/relationships
GET /api/v1/feed?category=competition
GET /api/v1/sources/status
POST /api/v1/admin/reviews/{task_id}/approve
```

当前规则响应应包含：`current_version`、`supersedes`、`supplements`、`source_url`、`effective_from`、`confidence` 和 `extraction_status`。

## 14. 监控指标

- 每来源最后成功采集时间；
- 列表条目新增数；
- 正文解析成功率；
- HTTP 405/403/验证码比例；
- 候选更新待审核数量；
- Hook 投递成功率和延迟；
- 死信队列长度；
- current 版本切换次数；
- 向量索引重建延迟。

## 15. 测试要求

至少覆盖：

1. 页面只改变访问量，不触发正文更新；
2. URL不变但附件二进制改变，触发附件更新；
3. 新年度细则替代上一年度；
4. “补充通知”不完全替代主细则；
5. `push_admission` 不替代 `push_recommendation`；
6. 公示名单不替代评定规则；
7. 405候选页不切换 current；
8. 同一 Hook 重放不重复更新；
9. Outbox 在进程崩溃后可继续投递；
10. 历史查询能返回指定年份版本。

## 16. 推荐技术栈

初期不需要 Kafka：

- API：FastAPI 或 NestJS；
- 数据库：PostgreSQL；
- 调度与队列：Redis + Celery / BullMQ；
- 原始文件：S3 / MinIO；
- 全文搜索：PostgreSQL FTS 或 OpenSearch；
- 向量检索：pgvector 或 Qdrant；
- 监控：Prometheus + Grafana；
- 错误追踪：Sentry。

## 17. 标准依据

- HTTP 条件请求、ETag、If-None-Match、If-Modified-Since、Retry-After：RFC 9110。
- 缓存语义：RFC 9111。
- 事件信封参考：CloudEvents 1.0。
- 上游主动订阅的参考模型：W3C WebSub；河南大学现有网页未表现出公开 WebSub Hub，因此当前设计采用轮询转换为内部 Hook。
