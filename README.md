# Terreno Carbono A4–A5

Mapa interativo para escolher um terreno em qualquer lugar do Brasil e ver o carbono de transporte e de obra (módulos A4 e A5 da EN 15978) de três sistemas construtivos: concreto, aço e madeira.

A ferramenta encontra fornecedores e destinos de resíduos perto do terreno com dados abertos do OpenStreetMap e calcula as distâncias reais por estrada. Ela complementa as calculadoras de ciclo de vida e não as substitui.

> Em construção. Etapa atual: 4 (rotas e distâncias por estrada).

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

## Fatores e fontes

Todo valor em `src/dados-fixos/fatores.json` tem fonte, URL e ano e entra com `"verificado": false`. Só um integrante do grupo muda para `true`, depois de conferir a fonte.

| Fator | Valor | Fonte | Verificado |
|---|---|---|---|
| Tortuosidade (estrada / linha reta), Brasil | 1,23 | Ballou, Rahardja e Sakai (2002), *Transportation Research Part A*, 36(9), 843–848 | não: há citação secundária com 1,33; conferir a tabela original |

Os demais fatores (caminhão, retorno vazio, escavação, solo) entram na etapa 5.

## Publicação

A cada alteração no ramo `main`, o GitHub Actions constrói o site e publica no GitHub Pages (`.github/workflows/deploy.yml`).

## Como funciona o cálculo · Fontes · Limitações · Caso de teste

A preencher nas etapas 5 a 8.

## Dados

Dados de mapa © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), disponíveis sob a licença ODbL.

## Equipe

Bruno Heringer, Stan e Carlos · UFRJ / AI Course · 2026

## Licença

Código sob a licença MIT. Veja [LICENSE](LICENSE).
