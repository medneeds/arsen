---
description: Investiga a causa raiz de um problema sem alterar nada
---

Investigue o problema abaixo. **Modo somente leitura: não edite, não crie, não commite nada nesta etapa.**

Problema relatado: $ARGUMENTS

Siga esta ordem, sem pular etapas:

**1. Sincronize antes de ler.**
Rode `git fetch` e verifique se a branch local está atrás do `origin/staging`. Se estiver, avise — você pode estar lendo código velho. Nunca diagnostique de memória; leia o código real.

**2. Localize.**
Encontre os arquivos envolvidos. Cite caminho e número de linha em cada afirmação. Se não encontrar, diga que não encontrou em vez de supor.

**3. Reconstrua o mecanismo.**
Explique o caminho exato que o código percorre até falhar: qual função chama qual, qual valor chega errado, onde o erro é lançado, e quem o captura. Se houver `try/catch`, diga se a exceção está sendo engolida — falha silenciosa é o modo de falha dominante neste projeto.

**4. Considere as hipóteses recorrentes deste projeto**, e diga explicitamente quais você descartou e por quê:
- política RLS bloqueando escrita sem erro na UI
- guard bloqueando re-hidratação
- coluna ausente na query
- duas telas lendo fontes diferentes para a mesma informação
- estado derivado do banco sem gatilho de atualização
- filtro por `patient_id` onde se queria a pessoa (`patient_registry_id`)

**5. Verifique se o problema já foi resolvido de outro jeito.**
Use `git log -S` e `git blame` para ver se o trecho foi tocado recentemente. Comentários datados no código costumam registrar abordagens abandonadas — se houver um, leia antes de propor reintroduzir algo.

**6. Entregue o diagnóstico assim:**

| Campo | Conteúdo |
|---|---|
| Causa raiz | o mecanismo exato, não o sintoma |
| Arquivos e linhas | caminhos precisos |
| Impacto clínico | o que o médico vê à beira do leito; em quantos % dos casos |
| Já está em produção? | diga se sabe ou se não tem como saber |
| Acoplamentos | que outro fluxo pode ser afetado pela correção |
| Risco da correção | baixo / médio / alto, e por quê |
| O que só o Artur pode validar | o que exige olho humano na interface |

**7. Proponha o plano** — o que muda, onde, e o que explicitamente NÃO será tocado.

**Pare aí e aguarde aprovação.** Não comece a corrigir.
