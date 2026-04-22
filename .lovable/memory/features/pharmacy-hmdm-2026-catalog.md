---
name: pharmacy-hmdm-2026-catalog
description: Catálogo de padronização da Farmácia HMDM 2026 importado para medication_catalog (222 princípios ativos, 322 apresentações, 49 classes terapêuticas) sincronizado com a busca da prescrição
type: feature
---
- Lista oficial **"LISTA DE PADRONIZAÇÃO FARMÁCIA HMDM 2026"** importada como dados-base do `medication_catalog` (notes='HMDM 2026') e `medication_presentations`.
- IDs determinísticos no padrão `00000000-0000-4000-8000-{NNNNNNNNNNNN}` (1 a 222) para permitir reimport idempotente via `ON CONFLICT (id) DO NOTHING`.
- Marcação automática a partir do nome do produto:
  - `controlled = true` para todos os medicamentos sob Portaria 344/98 (opioides, benzodiazepínicos, anestésicos endovenosos controlados, anticonvulsivantes, neurolépticos, antidepressivos com restrição).
  - `high_alert = true` (ISMP) para opioides fortes (Fentanila, Morfina, Metadona, Remifentanil, Dexmedetomidina), bloqueadores neuromusculares (Rocurônio, Cisatracúrio, Atracúrio, Suxametônio), insulinas (NPH/Regular), anticoagulantes (Heparina, Enoxaparina, Varfarina, Rivaroxabana), inotrópicos/vasopressores (Norepinefrina, Dopamina, Dobutamina, Epinefrina, Vasopressina, Milrinona, Deslanosídeo, Digoxina), eletrólitos concentrados (KCl 10%, NaCl 10/20%, MgSO4 50%, NaHCO3 8,4%), trombolíticos (Alteplase, Tenecteplase), nitratos EV (Nitroprussiato, Nitroglicerina), Amiodarona EV.
  - `requires_dilution = true` para Frasco-Ampola, Bolsa, Pó Liofilizado e antibióticos EV.
- 49 classes terapêuticas: Antiácido/Antiulceroso, Antiespasmódico, Antiemético/Procinético, Laxativo, Antidiarreico, Antiflatulento, Hemoderivado, Antianêmico, Vitamina, Nutrição Parenteral, Broncodilatador, Mucolítico, Anestésico Endovenoso/Inalatório/Local, Analgésico Opioide, Hipnótico/Sedativo, Anticonvulsivante, Neuroléptico, Ansiolítico, Antidepressivo, Analgésico/Antipirético, Relaxante Muscular, Antimicrobiano, Antiparasitário, Antiviral, Antirretroviral, Antigotoso, Reposição Hidroeletrolítica, Antiagregante, Anti-hemorrágico, Anticoagulante, Inotrópico/Vasopressor, Antiarrítmico, Hipolipemiante, Vasodilatador Coronariano/Cerebral, Trombolítico, Anti-hipertensivo, Diurético/Osmótico, Hormônio Tireoidiano, Antídoto, Anti-inflamatório, Bloqueador Neuromuscular, Corticoide, Anti-histamínico, Hipoglicemiante/Insulina, Cicatrizante Tópico, Colírio, Imunobiológico, Diluente.
- Sincroniza automaticamente com a busca da prescrição (`PrescricaoPage.tsx`) via `medication_catalog` + favoritos (`useMedicationFavorites`). Médicos passam a encontrar exatamente os fármacos disponíveis na farmácia HMDM.
- A busca permanece aberta (mostra todos os itens do catálogo, incluindo importações futuras) — não restringe à padronização.
