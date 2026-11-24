# Terreno Carbono A4–A5

Mapa interativo para escolher um terreno em qualquer lugar do Brasil e ver o carbono de transporte e de obra (módulos A4 e A5 da EN 15978) de três sistemas construtivos: concreto, aço e madeira.

A ferramenta encontra fornecedores e destinos de resíduos perto do terreno com dados abertos do OpenStreetMap e calcula as distâncias reais por estrada. Ela complementa as calculadoras de ciclo de vida e não as substitui.

> Em construção. Etapa atual: 0 (estrutura do projeto e publicação).

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
