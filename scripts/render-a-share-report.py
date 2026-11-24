"""Render verified one-year index and market-indicator charts for WeCom."""
import argparse
import calendar
import datetime as dt
import json
import math
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib import font_manager, ticker

INDICES = [("000985", "中证全指"), ("000016", "上证50"),
           ("000300", "沪深300"), ("000688", "科创50")]


MARKET = "a"

METRICS = [("aShareTurnover", "全A成交额", "亿元", 0),
           ("aShareMarginBalance", "全A融资余额（沪深北三市）", "亿元", 0),
           ("aShareActiveMarketValueThs", "A股活跃市值（同花顺公式版）", "亿元", 0),
           ("aShareSentimentThs", "同花顺情绪指数", "点", 2)]

def validate(payload, report):
    report_date = dt.date.fromisoformat(payload["reportDate"])
    expected_header = f"北京时间报告日期：{report_date}" if MARKET == "us" else f"A股指数日报｜北京时间{report_date}"
    if report.splitlines()[0] != expected_header:
        raise ValueError("Chart payload and text report dates differ")
    series = payload["indices"]
    if [(s["code"], s["name"]) for s in series] != INDICES:
        raise ValueError("Expected exactly the four configured price indices in order")
    metrics = payload.get("metrics", []) if MARKET == "us" else payload["metrics"]
    if [(s["code"], s["name"], s["unit"], s["decimals"]) for s in metrics] != METRICS:
        raise ValueError("Expected four configured market indicators and their correct units")
    series = series + metrics
    for s in series:
        end = dt.date.fromisoformat(s["tradingDate"])
        start = end.replace(year=end.year - 1, day=min(end.day, calendar.monthrange(end.year - 1, end.month)[1]))
        if end > report_date:
            raise ValueError("Future trading date")
        dates = [dt.date.fromisoformat(p["date"]) for p in s["items"]]
        if len(dates) < 200 or dates != sorted(set(dates)):
            raise ValueError("Incomplete or duplicate daily history")
        if dates[0] < start or dates[0] > start + dt.timedelta(days=10) or dates[-1] != end:
            raise ValueError("Expected a complete trailing calendar year ending on the stated close")
        if any(d > end or not isinstance(p["value"], (int, float)) or not math.isfinite(p["value"]) or p["value"] <= 0
               for d, p in zip(dates, s["items"])):
            raise ValueError("Invalid closing-index observations")
        latest = s["items"][-1]["value"]
        if s["code"] in {m[0] for m in METRICS}:
            text_section = report.split("A股市场指标｜", 1)[1].split(s["name"] + "\n", 1)[1].split("\n\n", 1)[0]
            expected = f'{latest:,.2f}' if s["decimals"] == 2 else format(math.floor(latest + 0.5), ",")
            if f'数值：{expected}{s["unit"]}\n' not in text_section or f"数据日期：{end}\n" not in text_section:
                raise ValueError("Text indicator and chart value/date differ")
        else:
            text_section = report.split((s["name"] if MARKET == "us" else f'{s["name"]}（{s["code"]}）'), 1)[1].split("\n\n", 1)[0]
            expected = format(math.floor(latest + 0.5), ",")
            if f"当前点位：{expected}\n" not in text_section or str(end) not in report:
                raise ValueError("Text close and chart close differ")
    return series


def render(payload, report, output):
    series = validate(payload, report)
    available = {f.name for f in font_manager.fontManager.ttflist}
    fonts = [n for n in ["Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "SimHei"] if n in available]
    if not fonts:
        raise ValueError("A Chinese font is required")
    plt.rcParams.update({"font.family": fonts[0], "axes.unicode_minus": False, "font.size": 12})
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for s, color in zip(series, ["#2563eb", "#0d9488", "#7c3aed", "#ea580c", "#0284c7", "#9333ea", "#059669", "#e11d48"]):
        dates = [dt.date.fromisoformat(p["date"]) for p in s["items"]]
        values = [p["value"] for p in s["items"]]
        end = dates[-1]
        start = end.replace(year=end.year-1, day=min(end.day, calendar.monthrange(end.year-1, end.month)[1]))
        metric = s["code"] in {m[0] for m in METRICS}
        fig, ax = plt.subplots(figsize=(9, 10.8 if metric else 9.8), dpi=160)
        fig.set_facecolor("#f8fafc")
        ax.set_facecolor("#ffffff")
        fig.subplots_adjust(left=.105, right=.965, bottom=.14, top=.41 if metric else .46)
        title = s["name"] if metric else f'{s["name"]}  {s["code"]}'
        subtitle = f'近一年历史曲线（{s["unit"]}）' if metric else '近一年收盘点位'
        fig.text(.105, .95, title, fontsize=23, weight="bold", color="#0f172a")
        if metric:
            section = report.split("A股市场指标｜", 1)[1].split(s["name"] + "\n", 1)[1].split("\n\n", 1)[0]
            rank_rows = re.findall(r"^([^\n｜]+)｜([0-9]+(?:\.[0-9]+)?%\*?|暂缺)$", section, re.M)
            labels = ["１个月", "３个月", "６个月", " １年 ", " ３年 "]
            if [r[0] for r in rank_rows] != labels:
                raise ValueError("Expected all five verified percentiles for the indicator image")
            ref = s["drawdownReference"]
            reference_start = end.replace(year=end.year-3, day=min(end.day, calendar.monthrange(end.year-3, end.month)[1])).isoformat()
            if (ref["windowStart"] != reference_start or ref["windowEnd"] != str(end)
                    or not reference_start <= ref["date"] <= str(end) or ref["sampleCount"] < 700
                    or not math.isfinite(ref["value"]) or ref["value"] <= 0 or ref["value"] < max(values)):
                raise ValueError("Invalid or incomplete three-year indicator high reference")
            high = ref["value"]
            current = values[-1]
            drawdown = (1 - current / high) * 100
            levels = [10, 15, 20, 25, 30] if drawdown < 30 else [30, 35, 40, 45, 50] if drawdown < 50 else [50, 55, 60, 65, 70]
            next_level = next((v for v in levels if v > drawdown), None)
            def number(v):
                return f'{v:,.2f}' if s["decimals"] == 2 else format(math.floor(v + .5), ",")
            fig.text(.105, .89, number(current), fontsize=32, weight="bold", color=color)
            fig.text(.105, .85, s["unit"], fontsize=14, color="#475569")
            fig.text(.105, .805, f'数据日期：{end}', fontsize=13, color="#334155")
            fig.text(.105, .76, f'当前回落（近3年）：{drawdown:.2f}%', fontsize=13, color="#334155")
            fig.text(.105, .715, f'近3年最高：{number(high)}{s["unit"]}', fontsize=12, color="#475569")
            fig.text(.105, .675, f'最高值日期：{ref["date"]}', fontsize=12, color="#475569")
            fig.text(.105, .63, '回落基准：近3年最高值', fontsize=10, color="#64748b")
            table_ax = fig.add_axes([.61, .655, .35, .245])
            table_ax.axis("off")
            cell_rows = [[("已达 · " if drawdown >= level else "下一档 · " if level == next_level else "") + f'跌{level}%', number(high * (1-level/100))] for level in levels]
            table = table_ax.table(cellText=cell_rows, colLabels=["回落档位", f'对应数值（{s["unit"]}）'], cellLoc="center", colLoc="center", bbox=[0, 0, 1, 1])
            table.auto_set_font_size(False)
            table.set_fontsize(11.5)
            for (r, c), cell in table.get_celld().items():
                status = "green" if r and drawdown >= levels[r-1] else "yellow" if r and levels[r-1] == next_level else "other"
                cell.set_edgecolor("#e2e8f0")
                cell.set_linewidth(.6)
                cell.set_facecolor("#e2e8f0" if r == 0 else "#ecfdf5" if status == "green" else "#fef3c7" if status == "yellow" else "#ffffff")
                cell.get_text().set_color("#047857" if status == "green" else "#92400e" if status == "yellow" else "#334155")
                cell.get_text().set_weight("bold" if r == 0 or c == 1 else "normal")
            if next_level is not None:
                distance = (1 - high * (1-next_level/100) / current) * 100
                fig.text(.61, .62, f'至跌{next_level}%档还需跌 {distance:.2f}%', fontsize=11, color="#92400e")
            rank_ax = fig.add_axes([.105, .51, .86, .08])
            rank_ax.axis("off")
            rank_table = rank_ax.table(cellText=[[v for _, v in rank_rows]], colLabels=["百分位 · " + l.strip().translate(str.maketrans("１３６", "136")) for l, _ in rank_rows], cellLoc="center", colLoc="center", bbox=[0, 0, 1, 1])
            rank_table.auto_set_font_size(False)
            rank_table.set_fontsize(11)
            for (r, c), cell in rank_table.get_celld().items():
                cell.set_edgecolor("#e2e8f0")
                cell.set_linewidth(.6)
                cell.set_facecolor("#e2e8f0" if r == 0 else "#ffffff")
                cell.get_text().set_color("#334155")
                cell.get_text().set_weight("bold" if r else "normal")
            fig.text(.105, .455, f'近一年历史曲线（{s["unit"]}）  {start} 至 {end}', fontsize=12, weight="bold", color="#334155")
            if any(v.endswith("*") for _, v in rank_rows):
                fig.text(.105, .045, '* 历史不足对应年限，按实际覆盖计算', fontsize=9, color="#64748b")
        else:
            section = report.split((s["name"] if MARKET == "us" else f'{s["name"]}（{s["code"]}）'), 1)[1].split("\n\n", 1)[0]
            lines = section.strip().splitlines()
            def field(prefix):
                return next((l[len(prefix):] for l in lines if l.startswith(prefix)), "暂缺")
            fig.text(.105, .88, field("当前点位："), fontsize=32, weight="bold", color=color)
            fig.text(.105, .84, f'收盘日期：{end}', fontsize=12, color="#475569")
            change = next((l for l in lines if "较上一日：" in l), "较上一日：暂缺")
            change_color = "#059669" if change.startswith("🟢") else "#dc2626" if change.startswith("🔴") else "#475569"
            fig.text(.105, .795, change.lstrip("🟢🔴⚪ "), fontsize=13, weight="bold", color=change_color)
            fig.text(.105, .752, 'PE（TTM）：' + field("PE（TTM）："), fontsize=13, color="#334155")
            drawdown_label = '当前回撤：' if MARKET == 'us' else '当前回撤（近3年）：'
            fig.text(.105, .709, drawdown_label + field(drawdown_label), fontsize=13, color="#334155")
            reference_label = '上一交易日收盘：' if MARKET == 'us' else '近3年最高：'
            fig.text(.105, .661, reference_label + field(reference_label), fontsize=11, color="#475569")
            fig.text(.105, .619, '历史最高：' + field("历史最高："), fontsize=11, color="#475569")
            rows = re.findall(r"^([🟢🟡⚪]) 跌(\d+)%：([0-9,]+)(?:（还需跌 ([0-9.]+)%）)?$", section, re.M)
            if len(rows) != 5:
                raise ValueError("Expected all five verified index drawdown levels")
            table_ax = fig.add_axes([.61, .635, .35, .255])
            table_ax.axis("off")
            table = table_ax.table(cellText=[[("已达 · " if light == "🟢" else "下一档 · " if light == "🟡" else "") + f'跌{level}%', value] for light, level, value, distance in rows],
                                   colLabels=["回撤档位", "对应点位"], cellLoc="center", colLoc="center", bbox=[0, 0, 1, 1])
            table.auto_set_font_size(False)
            table.set_fontsize(12)
            for (r, c), cell in table.get_celld().items():
                light = rows[r-1][0] if r else ""
                cell.set_edgecolor("#e2e8f0")
                cell.set_linewidth(.6)
                cell.set_facecolor("#e2e8f0" if r == 0 else "#ecfdf5" if light == "🟢" else "#fef3c7" if light == "🟡" else "#ffffff")
                cell.get_text().set_color("#047857" if light == "🟢" else "#92400e" if light == "🟡" else "#334155")
                cell.get_text().set_weight("bold" if r == 0 or c == 1 else "normal")
            distance = next(((level, d) for light, level, value, d in rows if light == "🟡" and d), None)
            if distance:
                fig.text(.61, .598, f'至跌{distance[0]}%档还需跌 {distance[1]}%', fontsize=11, color="#92400e")
            basis = '回撤基准：历史最高收盘' if MARKET == 'us' else '回撤基准：近3年最高收盘；历史最高仅供参考'
            fig.text(.105, .558, basis, fontsize=10, color="#64748b")
            fig.text(.105, .508, f'{subtitle}   {start} 至 {end}', fontsize=12, weight="bold", color="#334155")
        ax.plot(dates, values, color=color, linewidth=1.7)
        ax.scatter([end], [values[-1]], color=color, s=30, zorder=4)
        label = f'{values[-1]:,.2f}' if s.get('decimals') == 2 else f'{values[-1]:,.0f}'
        ax.annotate(label, (end, values[-1]), xytext=(-10, 15),
                    textcoords="offset points", ha="right", color=color, weight="bold",
                    bbox={"facecolor": "white", "edgecolor": "none", "alpha": .9})
        ax.set_xlim(start, end)
        ax.margins(y=.16)
        ax.yaxis.set_major_formatter(ticker.StrMethodFormatter("{x:,.0f}"))
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
        ax.grid(axis="y", color="#e2e8f0", linewidth=.8)
        ax.tick_params(axis="both", length=0, pad=9, labelsize=11, colors="#475569")
        for spine in ax.spines.values():
            spine.set_visible(False)
        source = s.get('sourceLabel', '中证指数官网 · 日度收盘')
        fig.text(.105, .07, f'数据：{source} · 数据日期 {end}', fontsize=10, color="#64748b")
        prefix = 'us-index' if MARKET == 'us' else 'a-share'
        file = output / f'{prefix}-{s["code"]}-1y.png'
        fig.savefig(file, dpi=160, facecolor=fig.get_facecolor())
        plt.close(fig)
        if not 0 < file.stat().st_size < 2 * 1024 * 1024:
            raise ValueError("Chart exceeds WeCom image size limit")
        manifest.append({"code": s["code"], "file": file.name, "tradingDate": str(end),
                         "latest": values[-1], "count": len(values), "sourceUrl": s["sourceUrl"]})
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Rendered {len(manifest)} verified one-year index and indicator charts")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--market", choices=["a", "us"], default="a")
    p.add_argument("--data", default="reports/a-share-chart-data.json")
    p.add_argument("--report", default="reports/a-share-daily.txt")
    p.add_argument("--output", default="report-images")
    a = p.parse_args()
    if a.market == "us":
        MARKET = "us"
        INDICES = [("SPX", "标普500指数"), ("COMP", "纳斯达克综合指数"), ("NDX", "纳斯达克100指数")]
        METRICS = []
    render(json.loads(Path(a.data).read_text(encoding="utf-8")), Path(a.report).read_text(encoding="utf-8"), Path(a.output))
