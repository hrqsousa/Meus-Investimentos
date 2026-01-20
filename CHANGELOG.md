# Changelog

## [2.0.1] - 2026-01-20

### Melhorias de UI/UX
- **Renda Variável - Dark Mode**:
  - Novas cores neutras (Slate/Cinza) para badges e botões de ação no modo escuro, substituindo o azul de baixo contraste.
  - Correção de legibilidade no valor monetário das recomendações de compra.
- **Renda Variável - Mobile**:
  - Botões de ação do topo (Proventos, Cotações, etc.) agora são roláveis horizontalmente, evitando cortes.
- **Rebalanceamento - Mobile**:
  - Layout responsivo aprimorado: informações de meta e status agora empilham verticalmente para evitar poluição visual em telas pequenas.

### Correções de Bugs (Fixes)
- **Sincronização de Caixa (Rebalanceamento)**:
  - Corrigido problema onde o valor "Em Caixa" não era salvo no Firebase, causando inconsistência entre dispositivos. Agora sincroniza corretamente com o perfil do usuário.
- **Gráfico de Alocação (Dashboard)**:
  - Corrigido cálculo percentual da categoria "Renda Variável" e outras classes, que apresentavam valores incorretos devido a falha na lógica de agrupamento.
- **Eventos Corporativos (Staking)**:
  - Corrigido botão "Salvar" inoperante para eventos do tipo Staking.
- **Média de Proventos (12m)**:
  - Corrigido bug que exibia "R$ 0,00" na média mensal mesmo com proventos existentes (falha no parse de moeda).

## [2.0.0] - 2026-01-15

**VERSÃO DE LANÇAMENTO OFICIAL! SAÍMOS DO BETA!**

### Novos Recursos
- **Relatório de Patrimônio (PDF)**:
  - Exportação completa da carteira em PDF com design profissional.
  - Inclui Resumo Global, Gráfico de Alocação, e tabelas detalhadas (Reserva, Renda Fixa, Tesouro e Renda Variável).
  - Categorização automática inteligente e ordenação por vencimento/tipo.
- **Gráficos de Proventos**:
  - Novo gráfico de **Proventos por Ano** com comparativo visual do crescimento.
  - Novo gráfico de **Proventos por Mês** (últimos 12 meses) com barras visuais.
  - Indicadores de crescimento (setas verdes/vermelhas) comparando o acumulado do ano atual vs anterior.
- **Top Pagadores**:
  - Novo card **"Top 7 - Maiores Pagadores"** no Dashboard, com abas de filtro (Todos, Ações, FIIs, Exterior).
- **Sincronização de Meta**:
  - A "Meta de Patrimônio" agora é sincronizada na nuvem (Firestore), persistindo entre dispositivos.

### Melhorias de UI/UX
- **Dashboard**:
  - Card "Top 10 - Rentabilidade" expandido para ocupar largura total, otimizando o espaço.
  - Melhorias visuais nos cards de Proventos (cores e tipografia).
- **Estilização**:
  - Header do PDF refinado com logo e informações de metadata discretas.
  - Alinhamento de colunas no PDF ajustado para facilitar leitura financeira (Valores à direita).
  - Novos estilos de botões (`.btn-danger`) e refinamento do modo escuro.

### Correções de Bugs
- **Categorização de Ativos**:
  - Corrigido bug onde ativos (Ações, FIIs, etc.) caíam na categoria "Outros" devido a diferenças de maiúsculas/minúsculas. Agora a categorização é insensível a caixa.
- **Consistência de Dados**:
  - Corrigida a exibição de valores `NaN` nos relatórios.
  - Ajuste na lógica de filtros de Proventos para não perder o estado ao atualizar dados.

## [2.0.0-beta.5] - 2026-01-14

### Adicionado
- Cards do Dashboard de Renda Variável agora são dinâmicos e reagem aos filtros selecionados (Ações, FIIs, Exterior, Cripto).
- Evento de "Staking" para criptomoedas, permitindo entrada de bonificações com custo zero.

### Corrigido
- Lógica de categorização no módulo de Rebalanceamento para identificar corretamente ETFs, Units, BDRs e verificar indexadores (IPCA/CDI) na Renda Fixa.
- Conversão cambial automática (USD -> BRL) no cálculo do Patrimônio Total do Dashboard e no módulo de Rebalanceamento.
- Formatação de moeda no "Aporte Sugerido" do Rebalanceamento (fixado em 2 casas decimais).
- Tratamento de ativos com quantidade residual (frações minúsculas) sendo movidos corretamente para o histórico de ativos fechados.

## [2.0.0 Beta 4] - 2026-01-13
...
