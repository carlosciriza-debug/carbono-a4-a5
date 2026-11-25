# Terreno Carbono A4–A5

Mapa interativo para escolher um terreno em qualquer lugar do Brasil e ver o carbono de transporte e de obra (módulos A4 e A5 da EN 15978) de três sistemas construtivos: concreto, aço e madeira.

A ferramenta encontra fornecedores e destinos de resíduos perto do terreno com dados abertos do OpenStreetMap e calcula as distâncias reais por estrada. Ela complementa as calculadoras de ciclo de vida e não as substitui.

> Em construção. Etapa atual: 5 (fatores com fonte e cálculo de A4 e A5).

**Endereço público:** https://obrunoheringer1.github.io/carbono-a4-a5/

## Como rodar localmente

Requisito: Node.js 20 ou mais recente.

```bash
npm install
npm run dev      # abre em http://localhost:5173/carbono-a4-a5/
npm test         # roda os testes
npm run build    # gera a versão de publicação em dist/
```

## Estrutura

```
src/
  geometria/     mapa, busca de endereço, lote, entorno 3D
  dados/         fornecedores, destinos, rotas
  carbono/       cálculo, gráfico, premissas
  compartilhado/ tipos, formato do terreno, utilidades
  dados-fixos/   fatores.json, sistemas.json, categorias.json
```

## Como usar (até aqui)

1. Digite um endereço e tecle Enter ou clique em **Buscar**. O mapa vai até o primeiro resultado; se houver outros, clique neles na lista.
2. Clique em **Desenhar lote** e marque os vértices no mapa. Para fechar, clique no primeiro vértice.
3. Para editar, arraste os vértices; os pontos no meio das arestas criam vértices novos. Para mover, arraste o lote.
4. O painel mostra a área em m² e as coordenadas do centro.
5. Em **Fornecedores**, escolha o raio (25, 50, 100 ou 200 km). Os pontos aparecem no mapa, com cor e letra por categoria, e na lista, do mais perto ao mais longe (em linha reta).
6. Desmarque um ponto na lista, ou clique nele no mapa e escolha **Desligar**, para tirá-lo do cálculo.
7. Para cadastrar um fornecedor que não está no mapa, clique em **Adicionar fornecedor no mapa**, clique no local e informe nome e categoria. No mapa, ele aparece com contorno preto. Fornecedores próprios entram sempre, mesmo fora do raio, e podem ser editados e removidos na lista.
8. Para cada categoria, a ferramenta escolhe o ponto ativo com a menor distância **por estrada** e desenha a rota até o lote, na cor da categoria. Passe o cursor sobre a rota para ver o ponto e os km. Desligar o ponto escolhido troca a rota para o seguinte.
9. Fornecedores próprios e pontos desligados ficam salvos no navegador. Use **Exportar** para guardar um arquivo JSON ou passar para outra pessoa, e **Importar** para trazê-lo de volta. A importação junta o arquivo com o que já existe.

## Serviços externos

- **Mapa base:** [OpenFreeMap](https://openfreemap.org/), estilo Positron, sem chave.
- **Fornecedores e destinos de resíduos:** base fixa extraída do OpenStreetMap pelo [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) e guardada em `public/dados/fornecedores-br.json`. O navegador baixa a base uma vez e filtra pelo raio localmente, sem consultar o Overpass a cada lote. Escolhemos assim porque o servidor público do Overpass é instável e a política dele desencoraja aplicações públicas que dependam dele a cada uso. A data da extração aparece na interface.
- **Rotas:** [OSRM](https://project-osrm.org/), servidor de demonstração mantido pela [FOSSGIS](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server), com o espelho `routing.openstreetmap.de` como reserva. A política permite uso razoável e não comercial, no máximo uma requisição por segundo. A ferramenta faz uma fila com esse intervalo e consulta em três passos: separa os 10 pontos mais próximos em linha reta de cada categoria, pede uma única matriz de distâncias por estrada e só então pede o traçado das rotas escolhidas. Resultados ficam em cache por lote, então ligar e desligar pontos não repete consultas.
- **Distância estimada:** se o serviço de rotas falhar, a distância é a linha reta × fator de tortuosidade (`src/dados-fixos/fatores.json`). A interface marca o valor com "≈" e "estimado", e a rota aparece tracejada.
- **Busca de endereço:** [Nominatim](https://nominatim.org/), servidor público do OpenStreetMap. A ferramenta segue a [política de uso](https://operations.osmfoundation.org/policies/nominatim/): uma consulta por clique ou Enter (nunca a cada tecla), no máximo uma por segundo, resultados repetidos vindos do cache e identificação pelo endereço do site. O servidor público é para uso leve; se a ferramenta passar a ter muitos usuários, será preciso um servidor próprio ou um serviço pago.

## Base de fornecedores

As categorias e as etiquetas do OpenStreetMap ficam em `src/dados-fixos/categorias.json`. Para mudar uma categoria ou atualizar os dados:

```bash
npm run extrair-fornecedores
```

O script faz uma consulta por categoria, com pausa entre elas, e leva alguns minutos. Se o servidor principal falhar, ele tenta um servidor reserva.

Extração de 24/11/2026, Brasil inteiro:

| Categoria | Pontos |
|---|---|
| Concreto e cimento | 16 |
| Aço | 16 |
| Madeira | 463 |
| Agregados | 6.380 |
| Material de construção em geral | 1.261 |
| Destino de resíduos | 1.596 |

A cobertura de concreto e aço é muito baixa: no centro do Rio, não há nenhum ponto dessas categorias num raio de 50 km. Por isso existe o cadastro de fornecedor próprio (etapa 3) e a categoria geral de reserva.

## Publicação

A cada alteração no ramo `main`, o GitHub Actions constrói o site e publica no GitHub Pages (`.github/workflows/deploy.yml`).

## Como funciona o cálculo

As funções ficam em `src/carbono/calculo.ts`: são puras e não acessam a rede. Para cada sistema (concreto, aço, madeira):

**A4, transporte até a obra.** Para cada material:

```
massa (t)  = área construída (m²) × intensidade (kg/m²) ÷ 1000
A4 (kgCO2) = massa × distância (km) × fator do caminhão × fator de retorno vazio
```

A distância é a da rota da categoria do material. Se não houver fornecedor de concreto, aço ou madeira, usa-se o fornecedor de material de construção em geral, com aviso. Agregados não têm essa reserva.

**A5, obra.**

```
resíduos (t)     = massa × percentual de perda
A5 resíduos      = resíduos × distância ao destino de resíduos × caminhão × retorno vazio
A5 terra         = volume (m³) × fator de escavação
                 + volume × densidade do solo × distância ao destino × caminhão × retorno vazio
A5               = A5 resíduos + A5 terra
```

O consumo de energia do canteiro não entra nesta versão.

**A1–A3** não é calculado: é o valor de referência do sistema × área construída, mostrado só para dar escala.

**Pendências.** Um fator sem fonte (`"valor": null`) nunca é estimado. A parcela que depende dele fica pendente, fora da soma, e aparece na lista de premissas.

## Caso de teste conferido à mão

Sistema de concreto com os valores reais de `src/dados-fixos/`. Área construída de 1.000 m² e 200 m³ de terra. O concreto vem de 20 km. Não há fornecedor de aço, então a armadura vem do fornecedor geral, a 10 km. Os resíduos e a terra vão para um destino a 15 km.

Fator de transporte = 0,0592 kgCO2/t·km × 2 (retorno vazio) = 0,1184.

| Parcela | Conta | kgCO2 |
|---|---|---|
| A4 concreto | 1.000 × 528 ÷ 1000 = 528 t × 20 km × 0,1184 | 1.250,30 |
| A4 armadura | 1.000 × 20,9 ÷ 1000 = 20,9 t × 10 km × 0,1184 | 24,75 |
| **A4** | | **1.275,05** |
| A5 resíduos de concreto | 528 t × 5% = 26,4 t × 15 km × 0,1184 | 46,89 |
| A5 resíduos de armadura | 20,9 t × 5% = 1,045 t × 15 km × 0,1184 | 1,86 |
| A5 escavação | 200 m³ × 3,5 kgCO2e/m³ | 700,00 |
| A5 transporte da terra | 200 m³ × 1,84 t/m³ = 368 t × 15 km × 0,1184 | 653,57 |
| **A5** | | **1.402,31** |
| Referência A1–A3 (não calculada) | 81 kgCO2/m² × 1.000 m² | 81.000 |

O mesmo caso está em `src/carbono/calculo.test.ts`. Se algum valor de `src/dados-fixos/` mudar, o teste falha e esta tabela precisa ser refeita.

## Fontes dos dados

Decisão do grupo: **só dados brasileiros** para massas e referências de A1–A3. Onde não há fonte brasileira, o valor fica `null` e aparece como pendente. Todos os valores entram como **não verificados**, até alguém do grupo conferir.

**Sistemas** (`src/dados-fixos/sistemas.json`)

| Sistema | Item | Valor | Fonte |
|---|---|---|---|
| Concreto | Concreto | 528 kg/m² | Belizário-Silva et al. (2024), *J. Building Engineering* 82:108234: 0,22 m³/m² × 2.400 kg/m³ |
| Concreto | Armadura | 20,9 kg/m² | idem: 0,22 m³/m² × 95 kg/m³ |
| Concreto | Referência A1–A3 | 81 kgCO2/m² | idem: mediana de 53 edifícios brasileiros |
| Aço | Perfis de aço | 52,97 kg/m² | Machado (2012), dissertação EESC-USP, Tab. 4.13 |
| Aço | Concreto das lajes | pendente | sem fonte brasileira |
| Aço | Referência A1–A3 | pendente | sem fonte brasileira |
| Madeira | Madeira engenheirada, ligações | pendente | não há edifício brasileiro de múltiplos andares em CLT/MLC documentado |
| Madeira | Referência A1–A3 | pendente | não existe DAP brasileira de CLT |
| Todos | Perdas em obra | concreto 5%, armadura 5%, perfis de aço 1%, madeira 2% | RICS (2023), Tabela 18 |

**Fatores** (`src/dados-fixos/fatores.json`)

| Fator | Valor | Fonte |
|---|---|---|
| Caminhão | 0,0592 kgCO2/t·km | BNDES (Villen et al.), Tabela 1: frota brasileira, granel mineral (EPL & Iema, 2021) |
| Retorno vazio | × 2 | Sidac, Metodologia v1.0 (2022), seção 3.4.3 |
| Tortuosidade | 1,23 | Ballou, Rahardja e Sakai (2002), valor do Brasil |
| Escavação | 3,5 kgCO2e/m³ | IStructE (2022), Tabela C3 (exemplo britânico) |
| Densidade do solo | 1,84 t/m³ | ABNT NBR 6120:2019, Tabela 7 (18 kN/m³) |
| Altura por pavimento | 3 m | OSM Wiki, `building:levels` (só contexto 3D) |

As notas de cada valor em `src/dados-fixos/` explicam as ressalvas: escopo, unidade (CO2 ou CO2e), cópias não oficiais e citações secundárias.

## Dados

Dados de mapa © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), disponíveis sob a licença ODbL.

## Equipe

Bruno Heringer, Stan e Carlos · UFRJ / AI Course · 2026

## Licença

Código sob a licença MIT. Veja [LICENSE](LICENSE).
