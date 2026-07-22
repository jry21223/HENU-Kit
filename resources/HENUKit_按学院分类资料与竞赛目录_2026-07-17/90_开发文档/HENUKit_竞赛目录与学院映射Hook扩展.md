# HENUKit竞赛目录与学院映射Hook扩展

## 1. 目标

在原有政策资料库版本管理基础上，增加竞赛目录、具体竞赛通知、学院映射和截止时间变化检测。

## 2. 数据对象必须拆分

### Competition

表示长期存在的逻辑赛事，例如“中国大学生计算机设计大赛”。

### CompetitionEdition

表示具体年度或届次，例如“2026年第19届”。

### CompetitionNoticeVersion

表示河南大学或学院发布的一次通知版本。正文原地修改、附件替换、报名截止时间变化时新增版本。

### CollegeCompetitionMapping

表示赛事与学院的关系：

- `official_host`：学院为官方承办单位；
- `official_college_catalog`：学院官网将赛事列入竞赛栏目；
- `official_all_majors`：校级通知明确面向所有专业；
- `discipline_relevance`：HENUKit推断的专业相关性；
- `manual`：管理员人工配置。

只有前三类可以作为官方事实展示；`discipline_relevance` 必须显示为推荐。

## 3. 新增事件

```text
competition.created
competition.notice_updated
competition.deadline_changed
competition.attachment_updated
competition.cancelled
competition.result_published
competition.mapping_added
competition.mapping_removed
competition.edition_superseded
```

## 4. 最新版本规则

- 同一赛事的新一届不能删除旧一届；
- 同一届通知原地修改时，新增 `notice_version`；
- 明确“延期”的通知只更新截止时间关系，不替代赛事主通知；
- “获奖结果公示”不能替代“报名通知”；
- `list_extracted` 数据不能替代 `full_structured_extract`；
- 学院转载版本不能在无明确依据时覆盖教务处原始版本；
- 查询“现在能报名什么”时，筛选当前届次、未过截止期、未撤回且正文完整度达标的记录。

## 5. 建议Outbox Payload

```json
{
  "event_type": "competition.deadline_changed",
  "competition_id": "computer-design-4c",
  "edition": 2026,
  "college_mappings": [
    {"college": "软件学院", "type": "official_host"},
    {"college": "文学院", "type": "official_all_majors"}
  ],
  "previous_deadline": "2026-04-10T23:59:59+08:00",
  "current_deadline": "2026-04-15T23:59:59+08:00",
  "source_url": "official source",
  "content_hash": "sha256:..."
}
```

## 6. 资料库更新

收到Hook后：

1. 验证签名和幂等键；
2. 写入新的通知版本；
3. 更新当前版本指针；
4. 重新提取时间、资格、组队、材料、联系方式；
5. 重新计算学院映射；
6. 只停用同一通知旧版本的搜索分块；
7. 不停用同一赛事的历史届次；
8. 对截止时间变化单独触发学生提醒。
