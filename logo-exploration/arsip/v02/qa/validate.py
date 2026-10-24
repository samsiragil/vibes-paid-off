"""Pemeriksaan struktur, aset, tautan lokal, dan kontras. Python stdlib saja."""
from pathlib import Path
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
import json, re

ROOT = Path(__file__).resolve().parent.parent
errors = []
required = ['product-essence.md','brief.md','concepts.md','evaluation.md','README.md','index.html','styles.css','fonts/OFL.txt','fonts/SourceSans3-Semibold.otf']
for name in required:
    if not (ROOT/name).is_file(): errors.append('Tidak ada: '+name)

dirs = sorted(p for p in ROOT.iterdir() if p.is_dir() and re.match(r'0[1-5]-',p.name))
if len(dirs)!=5: errors.append('Jumlah konsep bukan lima')
svgs=[]
for directory in dirs:
    for name in ['symbol.svg','horizontal.svg','mono.svg','concept.md','symbol-small.svg','app-icon.svg']:
        if not (directory/name).is_file(): errors.append('Tidak ada: '+str(directory/name))
    for file in directory.glob('*.svg'):
        tree=ET.parse(file); element=tree.getroot()
        if element.tag!='{http://www.w3.org/2000/svg}svg': errors.append('Namespace: '+str(file))
        vb=element.get('viewBox','').split()
        if len(vb)!=4 or any(float(v)<=0 for v in vb[2:]): errors.append('viewBox: '+str(file))
        if file.name in ['symbol.svg','mono.svg','symbol-small.svg','app-icon.svg'] and vb!=['0','0','256','256']: errors.append('viewBox simbol: '+str(file))
        colors=set()
        for node in element.iter():
            tag=node.tag.split('}')[-1]
            if tag not in ['svg','g','title','path','rect','circle','polygon','ellipse','line','polyline']: errors.append('Elemen tidak diizinkan '+tag+': '+str(file))
            for k,v in node.attrib.items():
                if k.lower().startswith('on') or 'href' in k or 'url(' in v or 'data:' in v: errors.append('Referensi/skrip: '+str(file))
                if k in ['fill','stroke'] and v!='none': colors.add(v.lower())
        if file.name=='mono.svg' and colors!={'currentcolor'}: errors.append('Mono bukan currentColor tunggal: '+str(file))
        if file.name.endswith('black.svg') and colors!={'#000000'}: errors.append('Varian hitam: '+str(file))
        if file.name.endswith('white.svg') and colors!={'#ffffff'}: errors.append('Varian putih: '+str(file))
        svgs.append(str(file.relative_to(ROOT)))

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.refs=[]; self.ids=set()
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.add(a['id'])
        for key in ['src','href']:
            if key in a:self.refs.append(a[key])
        if tag in ['script','iframe']:errors.append('Ketergantungan aktif pada HTML: '+tag)
html=Links(); html.feed((ROOT/'index.html').read_text(encoding='utf8'))
for ref in html.refs:
    if ref.startswith('#'):
        if ref[1:] not in html.ids:errors.append('Anchor tidak ada: '+ref)
    elif re.match(r'https?://|//|data:',ref): errors.append('Referensi eksternal halaman: '+ref)
    elif not (ROOT/ref).is_file(): errors.append('Tautan tidak ada: '+ref)
for ref in re.findall(r'url\([\'"]?([^\)\'\"]+)',(ROOT/'styles.css').read_text()):
    if not (ROOT/ref).is_file(): errors.append('Referensi CSS tidak ada: '+ref)

def luminance(h):
    s=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    s=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in s]
    return sum(v*w for v,w in zip(s,[.2126,.7152,.0722]))
data=json.loads((ROOT/'evaluation-draft.json').read_text())
ratios={c['name']:round(1.05/(luminance(c['primary'])+.05),2) for c in data}
if len(svgs)!=50: errors.append('Jumlah SVG bukan 50')
result={'svg_count':len(svgs),'concept_count':len(dirs),'html_references':len(html.refs),'primary_on_white_contrast':ratios,'errors':errors}
(ROOT/'qa/structure-results.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result,indent=2))
raise SystemExit(bool(errors))
