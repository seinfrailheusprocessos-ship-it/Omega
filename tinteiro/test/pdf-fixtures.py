"""PDFs FICTÍCIOS extras para o teste do editor de PDF (nada de dados reais).
Uso: python3 test/pdf-fixtures.py PASTA_DO_COFRE
Cria em PDFs/:
  - "Misto ficticio.pdf": 3 páginas com sumário (marcadores), uma página
    deitada (paisagem), uma com /Rotate 90 e uma com CropBox deslocada.
"""
import os, sys, io
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas as rlcanvas
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

destino = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cofre-teste"
pasta = os.path.join(destino, "PDFs")
os.makedirs(pasta, exist_ok=True)

buf = io.BytesIO()
c = rlcanvas.Canvas(buf, pagesize=A4)
w, h = A4
# página 1: retrato normal
c.bookmarkPage("p1"); c.addOutlineEntry("1. Introdução fictícia", "p1", level=0)
c.setFont("Helvetica-Bold", 18); c.drawString(72, h - 90, "Documento misto fictício")
c.setFont("Helvetica", 12)
for i in range(12):
    c.drawString(72, h - 140 - i * 22, f"Parágrafo {i + 1}: conteúdo inventado para testar a busca (jabuticaba).")
c.bookmarkHorizontal("p1b", 0, h - 380)
c.addOutlineEntry("1.1 Seção interna", "p1b", level=1)
c.showPage()
# página 2: paisagem
c.setPageSize(landscape(A4)); lw, lh = landscape(A4)
c.bookmarkPage("p2"); c.addOutlineEntry("2. Tabela em paisagem", "p2", level=0)
c.setFont("Helvetica-Bold", 16); c.drawString(72, lh - 80, "Página em paisagem (fictícia)")
c.setFont("Helvetica", 11)
for i in range(8):
    c.drawString(72, lh - 120 - i * 20, f"Linha {i + 1} | coluna A | coluna B | coluna C | valor {i * 10},00")
c.showPage()
# página 3: retrato (vai receber /Rotate 90)
c.setPageSize(A4)
c.bookmarkPage("p3"); c.addOutlineEntry("3. Página girada", "p3", level=0)
c.setFont("Helvetica-Bold", 16); c.drawString(72, h - 90, "Esta página tem /Rotate 90")
c.setFont("Helvetica", 12); c.drawString(72, h - 120, "Texto de exemplo na página girada (maracujá).")
c.showPage()
# página 4: CropBox deslocada
c.bookmarkPage("p4"); c.addOutlineEntry("4. Página recortada", "p4", level=0)
c.setFont("Helvetica-Bold", 16); c.drawString(120, h - 160, "Página com CropBox deslocada")
c.setFont("Helvetica", 12); c.drawString(120, h - 190, "Só a área central aparece (pitanga).")
c.showPage()
c.save()

r = PdfReader(io.BytesIO(buf.getvalue()))
wr = PdfWriter(clone_from=r)
wr.pages[2].rotation = 90
wr.pages[3].cropbox = RectangleObject([50, 100, w - 50, h - 100])
wr.pages[3].mediabox = RectangleObject([0, 0, w, h])
with open(os.path.join(pasta, "Misto ficticio.pdf"), "wb") as f:
    wr.write(f)
print("PDFs extras criados em", pasta)
