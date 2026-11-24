// Extrai do OpenStreetMap, via Overpass, todos os pontos das categorias de
// src/dados-fixos/categorias.json no Brasil e grava public/dados/fornecedores-br.json.
//
// Roda à mão, raramente (npm run extrair-fornecedores). Uma consulta por vez,
// com pausa entre elas, como pede a política de uso do Overpass:
// https://wiki.openstreetmap.org/wiki/Overpass_API

import { readFile, writeFile } from 'node:fs/promises'

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const IDENTIFICACAO = 'carbono-a4-a5/0.2 (+https://github.com/obrunoheringer1/carbono-a4-a5)'
const PAUSA_MS = 10_000
const SAIDA = new URL('../public/dados/fornecedores-br.json', import.meta.url)

const { categorias } = JSON.parse(
  await readFile(new URL('../src/dados-fixos/categorias.json', import.meta.url), 'utf8'),
)

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

function montarConsulta(filtros) {
  const partes = filtros.map((f) => `nwr${f}(area.br);`).join('\n  ')
  return `[out:json][timeout:600];
area["ISO3166-1"="BR"][admin_level=2]->.br;
(
  ${partes}
);
out center tags;`
}

async function consultar(consulta) {
  for (const servidor of SERVIDORES) {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const resposta = await fetch(servidor, {
          method: 'POST',
          headers: { 'User-Agent': IDENTIFICACAO, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: consulta }),
        })
        if (resposta.ok) return { dados: await resposta.json(), servidor }
        console.warn(`  ${servidor} respondeu ${resposta.status} (tentativa ${tentativa})`)
      } catch (erro) {
        console.warn(`  ${servidor} falhou: ${erro.message} (tentativa ${tentativa})`)
      }
      await esperar(30_000)
    }
  }
  throw new Error('Nenhum servidor Overpass respondeu.')
}

const pontos = []
const servidoresUsados = new Set()

for (const [i, categoria] of categorias.entries()) {
  if (i > 0) await esperar(PAUSA_MS)
  console.log(`${categoria.nome}…`)
  const { dados, servidor } = await consultar(montarConsulta(categoria.filtros))
  servidoresUsados.add(servidor)

  for (const el of dados.elements) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat === undefined || lon === undefined) continue
    pontos.push({
      id: `${el.type}/${el.id}`,
      nome: el.tags?.name ?? null,
      categoria: categoria.id,
      lon: Number(lon.toFixed(6)),
      lat: Number(lat.toFixed(6)),
    })
  }
  console.log(`  ${dados.elements.length} pontos`)
}

const base = {
  fonte: 'OpenStreetMap, via Overpass API',
  licenca: 'ODbL 1.0 — © colaboradores do OpenStreetMap',
  extraidoEm: new Date().toISOString().slice(0, 10),
  servidores: [...servidoresUsados],
  pontos,
}
await writeFile(SAIDA, JSON.stringify(base))
console.log(`\n${pontos.length} pontos gravados em public/dados/fornecedores-br.json`)
