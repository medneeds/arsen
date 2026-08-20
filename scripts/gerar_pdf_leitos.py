"""
Gera docs/disposicao-setores-leitos-arsen.pdf — documento institucional de
disposicao de setores e leitos virtuais, para validacao pelo Nucleo de
Qualidade Hospitalar.

O PDF e derivado: a fonte de verdade e este script. Regenerar com:

    pip install reportlab
    python scripts/gerar_pdf_leitos.py

Os quantitativos aqui devem espelhar SECTOR_BED_CONFIG (src/utils/bedNaming.ts)
e a estrutura semeada pela migration
20260819230100_estrutura_leitos_virtuais_setores_em_implantacao.sql.
A suite src/tests/sector-coverage-integrity.test.ts falha se divergirem.

Estrutura aprovada pela Direcao Clinica em 19/08/2026: 296 leitos virtuais em
16 setores. A sobreposicao L37-L40 entre Clinica Cirurgica e Enfermaria de
Transicao foi conferida e e INTENCIONAL.
"""
"""Gera o documento institucional de disposição de setores e leitos virtuais."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)

AZUL = colors.HexColor("#1F3864")
AZUL_CLARO = colors.HexColor("#D9E2F3")
CINZA = colors.HexColor("#F2F2F2")
CINZA_TXT = colors.HexColor("#595959")
LINHA = colors.HexColor("#BFBFBF")
AMBAR = colors.HexColor("#FFF2CC")

styles = getSampleStyleSheet()

S = {
    "titulo": ParagraphStyle("titulo", parent=styles["Normal"], fontName="Helvetica-Bold",
                             fontSize=14, leading=17, textColor=AZUL, alignment=TA_CENTER,
                             spaceAfter=1),
    "sub": ParagraphStyle("sub", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=8.5, leading=11, textColor=CINZA_TXT, alignment=TA_CENTER),
    "inst": ParagraphStyle("inst", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=9.5, leading=12, textColor=AZUL, alignment=TA_CENTER),
    "h1": ParagraphStyle("h1", parent=styles["Normal"], fontName="Helvetica-Bold",
                         fontSize=10, leading=12, textColor=AZUL, spaceBefore=6, spaceAfter=3),
    "corpo": ParagraphStyle("corpo", parent=styles["Normal"], fontName="Helvetica",
                            fontSize=8, leading=10.5, alignment=TA_JUSTIFY, spaceAfter=3),
    "nota": ParagraphStyle("nota", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=7, leading=9, textColor=CINZA_TXT, alignment=TA_JUSTIFY),
    "cel": ParagraphStyle("cel", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=7.5, leading=9.5),
    "celb": ParagraphStyle("celb", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=7.5, leading=9.5),
    "th": ParagraphStyle("th", parent=styles["Normal"], fontName="Helvetica-Bold",
                         fontSize=7, leading=9, textColor=colors.white),
}

# ── Dados: extraídos de SECTOR_BED_CONFIG (src/utils/bedNaming.ts) ────────────
BLOCOS = [
    ("BLOCO I — ALTA COMPLEXIDADE (UTI / UCI)",
     "",
     [("UTI 1", "8", "L01 a L08"),
      ("UTI 2", "10", "L09 a L18"),
      ("UCI 1", "6", "L01 a L06"),
      ("UCI 2", "8", "L07 a L14")],
     32),
    ("BLOCO II — ENFERMARIAS",
     "Inclui a Unidade de Cuidados Clínicos (UCC).",
     [("UCC — Unidade de Cuidados Clínicos", "37", "L01 a L37"),
      ("Neuro 01", "10", "L01 a L10"),
      ("Neuro 02", "10", "L11 a L20"),
      ("Clínica Cirúrgica", "40", "L01 a L40"),
      ("Enfermaria de Transição", "10", "L37 a L46"),
      ("Enfermaria Vascular", "95", "L01 a L95")],
     202),
    ("BLOCO III — URGÊNCIA E EMERGÊNCIA (HORIZONTAL)",
     "",
     [("Sala Vermelha", "6", "SV01 a SV06"),
      ("Sala Laranja", "12", "OL01 a OL12"),
      ("Posto de Internação", "14", "M01 a M14")],
     32),
    ("BLOCO IV — CENTRO CIRÚRGICO",
     "",
     [("CC Preparo", "14", "CP01 a CP14"),
      ("CC Bloco Cirúrgico", "6", "CB01 a CB06"),
      ("CC RPA", "10", "CR01 a CR10")],
     30),
]


def cabecalho(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(AZUL)
    canvas.setLineWidth(2)
    canvas.line(20 * mm, h - 16 * mm, w - 20 * mm, h - 16 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(CINZA_TXT)
    canvas.drawString(20 * mm, h - 13 * mm, "HOSPITAL MUNICIPAL DJALMA MARQUES (SOCORRÃO I) — SÃO LUÍS / MA")
    canvas.drawRightString(w - 20 * mm, h - 13 * mm, "Plataforma Arsen")
    canvas.setStrokeColor(LINHA)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 15 * mm, w - 20 * mm, 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(20 * mm, 11 * mm, "Disposição de Setores e Leitos Virtuais — Documento para validação")
    canvas.drawRightString(w - 20 * mm, 11 * mm, f"Página {doc.page}")
    canvas.restoreState()


def tabela_bloco(itens, total, larguras=None):
    dados = [[Paragraph("SETOR", S["th"]),
              Paragraph("LEITOS VIRTUAIS", S["th"]),
              Paragraph("IDENTIFICAÇÃO DOS LEITOS VIRTUAIS", S["th"])]]
    for nome, qtd, faixa in itens:
        dados.append([Paragraph(nome, S["cel"]),
                      Paragraph(qtd, S["cel"]),
                      Paragraph(faixa, S["cel"])])
    rotulo_total = str(total) if total is not None else "a definir"
    dados.append([Paragraph("Subtotal de leitos virtuais", S["celb"]),
                  Paragraph(rotulo_total, S["celb"]),
                  Paragraph("", S["cel"])])

    t = Table(dados, colWidths=larguras or [72 * mm, 26 * mm, 80 * mm], hAlign="LEFT")
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
        ("BACKGROUND", (0, -1), (-1, -1), AZUL_CLARO),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(dados) - 1):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), CINZA))
    t.setStyle(TableStyle(estilo))
    return t


def build(path):
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=18 * mm, bottomMargin=16 * mm,
                            title="Disposição de Setores e Leitos Virtuais",
                            author="Plataforma Arsen — HMDM")
    st = []

    st.append(Paragraph("DISPOSIÇÃO DE SETORES E LEITOS VIRTUAIS", S["titulo"]))
    st.append(Paragraph("Plataforma Arsen — Prontuário Eletrônico e Gestão de Internação", S["sub"]))
    st.append(Spacer(1, 2))
    st.append(Paragraph("Hospital Municipal Djalma Marques — Socorrão I", S["inst"]))
    st.append(Spacer(1, 5))

    ident = Table([
        [Paragraph("<b>Documento</b>", S["cel"]), Paragraph("Disposição de setores e leitos virtuais", S["cel"]),
         Paragraph("<b>Data</b>", S["cel"]), Paragraph("19/08/2026", S["cel"])],
        [Paragraph("<b>Finalidade</b>", S["cel"]), Paragraph("Validação institucional", S["cel"]),
         Paragraph("<b>Versão</b>", S["cel"]), Paragraph("1.0", S["cel"])],
        [Paragraph("<b>Responsável</b>", S["cel"]), Paragraph("Direção Clínica / Product Owner", S["cel"]),
         Paragraph("<b>Destino</b>", S["cel"]), Paragraph("Núcleo de Qualidade Hospitalar", S["cel"])],
    ], colWidths=[24 * mm, 70 * mm, 18 * mm, 66 * mm], hAlign="LEFT")
    ident.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
        ("BACKGROUND", (0, 0), (0, -1), CINZA),
        ("BACKGROUND", (2, 0), (2, -1), CINZA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    st.append(ident)
    st.append(Spacer(1, 6))

    st.append(Paragraph("1. Objeto", S["h1"]))
    st.append(Paragraph(
        "Este documento apresenta a disposição dos setores e a quantidade de leitos virtuais configurados na "
        "Plataforma Arsen, para validação pelo Núcleo de Qualidade Hospitalar. A plataforma destina-se ao "
        "acompanhamento da <b>internação hospitalar</b>: o paciente ingressa no fluxo no momento em que a "
        "internação é decidida; atendimentos de consultório e primeiro atendimento não compõem este escopo. "
        "Todos os quantitativos deste documento referem-se a <b>leitos virtuais</b>: a posição de internação "
        "representada no sistema, à qual se vinculam o paciente, o prontuário e os registros clínicos do "
        "período. A numeração é única dentro de cada setor.",
        S["corpo"]))

    st.append(Paragraph("2. Disposição por bloco", S["h1"]))

    bt = ParagraphStyle("bt", parent=S["h1"], fontSize=9, spaceBefore=3, spaceAfter=1)

    for titulo, desc, itens, total in BLOCOS[:2]:
        bloco = [Paragraph(titulo, bt)]
        if desc:
            bloco.append(Paragraph(desc, S["nota"]))
        bloco += [Spacer(1, 1.5), tabela_bloco(itens, total), Spacer(1, 3)]
        st.append(KeepTogether(bloco))

    # Blocos III e IV lado a lado
    estreitas = [35 * mm, 19 * mm, 29 * mm]

    def coluna(b):
        titulo, desc, itens, total = b
        col = [Paragraph(titulo, bt)]
        if desc:
            col.append(Paragraph(desc, S["nota"]))
        col += [Spacer(1, 1.5), tabela_bloco(itens, total, estreitas)]
        return col

    lado = Table([[coluna(BLOCOS[2]), coluna(BLOCOS[3])]],
                 colWidths=[89 * mm, 89 * mm], hAlign="LEFT")
    lado.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    st.append(lado)
    st.append(Spacer(1, 3))

    st.append(Paragraph("3. Consolidação", S["h1"]))
    consolidado = [
        [Paragraph("BLOCO", S["th"]), Paragraph("SETORES", S["th"]), Paragraph("LEITOS VIRTUAIS", S["th"])],
        [Paragraph("I — Alta Complexidade (UTI / UCI)", S["cel"]), Paragraph("4", S["cel"]), Paragraph("32", S["cel"])],
        [Paragraph("II — Enfermarias", S["cel"]), Paragraph("6", S["cel"]), Paragraph("202", S["cel"])],
        [Paragraph("III — Urgência e Emergência (Horizontal)", S["cel"]), Paragraph("3", S["cel"]), Paragraph("32", S["cel"])],
        [Paragraph("IV — Centro Cirúrgico", S["cel"]), Paragraph("3", S["cel"]), Paragraph("30", S["cel"])],
        [Paragraph("TOTAL DE LEITOS VIRTUAIS DE INTERNAÇÃO", S["celb"]), Paragraph("16", S["celb"]), Paragraph("296", S["celb"])],
    ]
    tc = Table(consolidado, colWidths=[98 * mm, 30 * mm, 50 * mm], hAlign="LEFT")
    tc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, -1), (-1, -1), AZUL_CLARO),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    st.append(tc)
    st.append(Spacer(1, 2))
    st.append(Paragraph(
        "Além da capacidade fixa acima, o sistema admite a criação de <b>leitos extras</b> por demanda, "
        "identificados como EXTRA, os quais não integram a capacidade instalada e são contabilizados à parte.",
        S["nota"]))

    st.append(Paragraph("4. Validação", S["h1"]))
    st.append(Paragraph(
        "A assinatura abaixo atesta a conferência da disposição de setores e do quantitativo de leitos "
        "virtuais apresentados neste documento.", S["corpo"]))
    st.append(Spacer(1, 4))
    ass = Table([
        ["", ""],
        [Paragraph("Direção Clínica", S["cel"]), Paragraph("Núcleo de Qualidade Hospitalar", S["cel"])],
        [Paragraph("Data: ____ / ____ / ______", S["nota"]), Paragraph("Data: ____ / ____ / ______", S["nota"])],
    ], colWidths=[80 * mm, 80 * mm], rowHeights=[11 * mm, 4.5 * mm, 4.5 * mm], hAlign="CENTER")
    ass.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (0, 1), 0.6, colors.black),
        ("LINEABOVE", (1, 1), (1, 1), 0.6, colors.black),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    st.append(ass)

    doc.build(st, onFirstPage=cabecalho, onLaterPages=cabecalho)
    print("PDF gerado:", path)


if __name__ == "__main__":
    build("docs/disposicao-setores-leitos-arsen.pdf")
