"""Run with python -m unittest discover -s test -p '*_test.py'."""
import copy
import datetime as dt
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('report_renderer', Path(__file__).resolve().parents[1] / 'scripts/render-a-share-report.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


def fixture():
    end = dt.date(2026, 11, 25)
    dates = [end-dt.timedelta(days=i) for i in range(365, -1, -1) if (end-dt.timedelta(days=i)).weekday() < 5]
    payload = {'reportDate': str(end), 'indices': [], 'metrics': []}
    report = f'商品价格日报｜北京时间{end}\n\n'
    for code, name, unit, decimals in r.COMMODITIES:
        latest = {'NG=F': 3.667, 'BZ=F': 88.16, 'gold': 3499.50, 'SI=F': 40.16, 'HG=F': 5.4020}[code]
        s = dict(code=code, name=name, unit=unit, decimals=decimals, tradingDate=str(end),
                 sourceUrl='https://example.invalid/test-fixture', sourceLabel='测试数据',
                 instrument='测试合约' if code != 'gold' else '伦敦金现货', quoteTime='2026-11-25 20:00:00 北京时间',
                 priceBasis='百分位按最新报价计算', historyBasis='连续期货历史，含换月' if code != 'gold' else '伦敦金现货日线',
                 items=[{'date': str(d), 'value': latest*(.8+.2*i/(len(dates)-1))} for i, d in enumerate(dates)],
                 drawdownReference=dict(value=latest*2, date='2025-01-02', windowStart='2023-11-25', windowEnd=str(end), sampleCount=780,
                                        sourceUrl='https://example.invalid/test-fixture'))
        payload['metrics'].append(s)
        report += name+'\n'+f'数值：{r.metric_number(latest, decimals)}{unit}\n数据日期：{end}\n'
        report += '\n'.join(s[k] for k in ['instrument', 'quoteTime', 'priceBasis', 'historyBasis'])+'\n'
        report += ' 时间 ｜百分位\n'+'\n'.join(label+'｜50.0%' for label in ['１个月', '３个月', '６个月', ' １年 ', ' ３年 '])+'\n\n'
    return payload, report


class CommodityTests(unittest.TestCase):
    def setUp(self):
        r.MARKET, r.INDICES, r.METRICS = 'commodity', [], r.COMMODITIES

    def test_boundary_and_rebound(self):
        for price, expected, next_level in [(71, 10, 30), (70, 30, 35), (50, 50, 55), (30, 50, None), (70.01, 10, 30)]:
            levels, reached, nxt = r.drawdown_levels(price, 100)
            self.assertEqual((levels[0], nxt), (expected, next_level))
            self.assertEqual(reached, {v for v in levels if price <= 100*(1-v/100)})
        self.assertEqual(r.metric_number(3.667, 3), '3.667')
        self.assertEqual(r.metric_number(5.402, 4), '5.4020')

    def test_reject_wrong_identity_and_values(self):
        payload, report = fixture()
        r.validate(payload, report)
        for key, value in [('unit', '美元/吨'), ('instrument', ''), ('quoteTime', '错误时点')]:
            bad = copy.deepcopy(payload)
            bad['metrics'][0][key] = value
            with self.assertRaises(ValueError):
                r.validate(bad, report)
        with self.assertRaises(ValueError):
            r.validate(payload, report.replace('3.667美元', '3.670美元'))

    def test_render_five_images_and_reject_incomplete_reference(self):
        payload, report = fixture()
        with tempfile.TemporaryDirectory() as output:
            r.render(payload, report, Path(output))
            files = list(Path(output).glob('*.png'))
            self.assertEqual(len(files), 5)
            self.assertTrue(all(0 < f.stat().st_size < 2*1024*1024 for f in files))
            payload['metrics'][0]['drawdownReference']['sampleCount'] = 260
            with self.assertRaises(ValueError):
                r.render(payload, report, Path(output))


if __name__ == '__main__':
    unittest.main()
