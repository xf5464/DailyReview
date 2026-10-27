# One-time official history backfill; rerunnable, retaining successful dates.
import urllib.request,urllib.parse,datetime,concurrent.futures,json,pathlib,time
class requests:
 @staticmethod
 def get(url,params,headers={},timeout=20):
  class Response:
   def json(self): return json.loads(self.body)
  r=Response()
  r.body=urllib.request.urlopen(urllib.request.Request(url+'?'+urllib.parse.urlencode(params),headers=headers),timeout=timeout).read()
  return r
p=pathlib.Path(__file__).resolve().parent/'data/exchange-turnover.json'
state=json.loads(p.read_text()) if p.exists() else {'sh':{},'sz':{}}
def num(x):return float(str(x).replace(',',''))
def get(task):
 m,d=task
 try:
  if m=='sh':
   j=requests.get('https://query.sse.com.cn/commonQuery.do',params={'sqlId':'COMMON_SSE_SJ_GPSJ_CJGK_MRGK_C','PRODUCT_CODE':'01,03','type':'inParams','SEARCH_DATE':d},headers={'Referer':'https://www.sse.com.cn/'},timeout=20).json()
   rows=[x for x in j['result'] if x['PRODUCT_CODE'] in ['01','03'] and x['TRADE_DATE']==d.replace('-','')]
   if len(rows)!=2:return m,d,None
   v=sum(num(x['TRADE_AMT']) for x in rows)/sum(num(x['TOTAL_VALUE']) for x in rows)*100
  else:
   j=requests.get('https://www.szse.cn/api/report/ShowReport/data',params={'SHOWTYPE':'JSON','CATALOGID':'1803_sczm','TABKEY':'tab1','txtQueryDate':d,'random':str(time.time())},timeout=20).json()[0]
   if j['metadata']['subname']!=d:return m,d,None
   rows=[x for x in j['data'] if 'A股' in x['lbmc']]
   if len(rows)!=2:return m,d,None
   v=sum(num(x['cjje']) for x in rows)/sum(num(x['sjzz']) for x in rows)*100
  return m,d,round(v,6) if v > 0 else None
 except Exception:return m,d,None
start=datetime.date(2023,10,20); end=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date()
dates=[(start+datetime.timedelta(days=i)).isoformat() for i in range((end-start).days+1) if (start+datetime.timedelta(days=i)).weekday()<5]
tasks=[(m,d) for d in dates for m in ['sh','sz'] if d not in state[m]]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for i,(m,d,v) in enumerate(ex.map(get,tasks)):
  if v is not None:state[m][d]=v
  if i%40==0:
   p.write_text(json.dumps(state,ensure_ascii=False,sort_keys=True,indent=2)+'\n'); print(i,len(tasks),len(state['sh']),len(state['sz']),flush=True)
p.write_text(json.dumps(state,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
print('DONE',len(state['sh']),len(state['sz']),flush=True)
