import re,sys
s=open('/home/claude/trabajo/index.html',encoding='utf-8',errors='replace').read()
# extraer todo el javascript entre <script> ... </script>
partes=re.findall(r'<script[^>]*>(.*?)</script>', s, re.S)
js='\n;\n'.join(partes)
open('/home/claude/trabajo/app.js','w',encoding='utf-8').write(js)
print("bloques script:",len(partes)," bytes js:",len(js))
