"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type SubmissionSummary = {
  id: number;
  name: string;
  campus: string;
  status: string;
  createdAt: string;
};

export default function FoodSubmissionSection() {
  const [canSubmit, setCanSubmit] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [message, setMessage] = useState("正在确认投稿身份…");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/food-submissions")
      .then(async (response) => {
        if (!response.ok) throw new Error("投稿状态加载失败");
        return response.json() as Promise<{ canSubmit: boolean; submissions: SubmissionSummary[] }>;
      })
      .then((data) => {
        setCanSubmit(data.canSubmit);
        setSubmissions(data.submissions);
        setMessage(data.canSubmit ? "投稿会进入待审核队列，不会直接改变榜单。" : "登录后即可投稿，并查看自己的审核状态。");
      })
      .catch(() => setMessage("暂时无法读取投稿状态，请稍后重试。"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setSubmitting(true);
    setMessage("正在提交你的美食线索…");
    try {
      const response = await fetch("/api/food-submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          campus: values.get("campus"),
          address: values.get("address"),
          mapUrl: values.get("mapUrl"),
          price: values.get("price"),
          hours: values.get("hours"),
          reasons: values.get("reasons"),
          dishes: values.get("dishes"),
          photoUrls: String(values.get("photoUrls") ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          visitedAt: values.get("visitedAt"),
          confirmed: values.get("confirmed") === "yes",
        }),
      });
      const data = await response.json() as { error?: string; submission?: SubmissionSummary };
      if (!response.ok || !data.submission) throw new Error(data.error ?? "投稿失败");
      setSubmissions((current) => [data.submission!, ...current].slice(0, 10));
      setMessage("投稿成功！维护者核验后，会决定是否加入地图和榜单。");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投稿失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section submission-section" id="food-submit">
      <div className="section-heading submission-heading">
        <div><span className="kicker">STUDENT FOOD DESK</span><h2>你吃到的好店，<br />投到这里。</h2></div>
        <p>不用整理 JSON，也不用先开 GitHub Issue。填完下面这张表，线索会进入待审核队列；核验地址、图片和信息后，再决定是否加入地图与五档榜单。</p>
      </div>
      <div className="submission-layout">
        <aside className="submission-guide">
          <span>投稿流程</span>
          <ol>
            <li><b>01</b><div><strong>写清楚是哪家</strong><small>店名、校区和具体位置最重要</small></div></li>
            <li><b>02</b><div><strong>说说为什么值得吃</strong><small>价格、分量、排队和推荐菜都可以</small></div></li>
            <li><b>03</b><div><strong>等待学生维护者核验</strong><small>投稿不会未经审核直接上榜</small></div></li>
          </ol>
          <div className="submission-privacy"><strong>隐私提醒</strong><p>不要填写店主私人手机号、微信、学生个人信息；照片请使用自己的实拍或有授权的公开链接。</p></div>
          {submissions.length > 0 && (
            <div className="submission-history">
              <strong>我的最近投稿</strong>
              {submissions.map((item) => <div key={item.id}><span>{item.name}</span><small>{item.status === "pending" ? "待审核" : item.status}</small></div>)}
            </div>
          )}
        </aside>
        <form className="food-submission-form" onSubmit={submit}>
          <div className="form-row">
            <label><span>商家名称 *</span><input name="name" required maxLength={80} placeholder="例如：南苑餐厅二楼某窗口" /></label>
            <label><span>靠近哪个校区 *</span><select name="campus" required defaultValue=""><option value="" disabled>请选择</option><option value="明伦">明伦校区</option><option value="金明">金明校区</option><option value="龙子湖">龙子湖校区</option><option value="其他">其他</option></select></label>
          </div>
          <label><span>具体位置 *</span><input name="address" required maxLength={200} placeholder="地址、楼层、窗口号，越具体越好" /></label>
          <div className="form-row">
            <label><span>地图链接</span><input name="mapUrl" type="url" placeholder="https://..." /></label>
            <label><span>最近到店时间 *</span><input name="visitedAt" required maxLength={40} placeholder="例如：2026 年 7 月" /></label>
          </div>
          <div className="form-row">
            <label><span>人均或价格参考</span><input name="price" maxLength={80} placeholder="例如：人均 20 元" /></label>
            <label><span>营业时间参考</span><input name="hours" maxLength={120} placeholder="例如：10:30–22:00" /></label>
          </div>
          <label><span>为什么推荐？ *</span><textarea name="reasons" required maxLength={1200} rows={5} placeholder="味道、分量、性价比、排队情况，以及适合什么场景……" /></label>
          <label><span>推荐菜品 *</span><textarea name="dishes" required maxLength={800} rows={4} placeholder="写下菜名、参考价格和推荐理由" /></label>
          <label><span>菜品或环境照片链接</span><textarea name="photoUrls" rows={3} placeholder={'每行一个 https:// 图片链接，最多 6 个\n暂时没有也可以先不填'} /></label>
          <label className="submission-confirm"><input name="confirmed" type="checkbox" value="yes" required /><span>内容来自我的真实体验，且不包含他人的敏感个人信息。</span></label>
          <div className="submission-action">
            {canSubmit ? <button type="submit" disabled={submitting}>{submitting ? "正在提交…" : "提交到待审核队列 →"}</button> : <a href="/signin-with-chatgpt?return_to=%2F%23food-submit">登录后开始投稿 →</a>}
            <p aria-live="polite">{message}</p>
          </div>
        </form>
      </div>
    </section>
  );
}
