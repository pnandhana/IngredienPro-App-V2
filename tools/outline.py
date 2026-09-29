#!/usr/bin/env python3
"""Dev helper: print a screen's node outline. usage: outline.py <screen-id> [node name] [depth]"""
import json,sys
def load(i): return json.loads(open(f'screens/{i.replace(":","-")}.js').read()[len('SCREEN('):-3])
def find(n,name):
    if n['n']==name: return n
    for c in n.get('c',[]):
        r=find(c,name)
        if r: return r
def outline(n,d,maxd):
    if d>maxd: return
    t=n.get('tx','')
    print('  '*d+f"{n['n'][:48]} [{n['t'][:4]}]"+(f' "{t[:50]}"' if t else '')+(' ->'+','.join(g['nav'][:3]+':'+g['to'] for g in n['go']) if n.get('go') else ''))
    for c in n.get('c',[]): outline(c,d+1,maxd)
n=load(sys.argv[1]); 
if len(sys.argv)>2 and sys.argv[2]: n=find(n,sys.argv[2])
outline(n,0,int(sys.argv[3]) if len(sys.argv)>3 else 3)
