import 'maplibre-gl/dist/maplibre-gl.css'
import {
  type GeoJSONSource,
  Map as MapaMapLibre,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import urlWorkerMapLibre from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, type GeoJSONStoreFeatures } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson'
import { CATEGORIA_POR_ID } from '../compartilhado/categorias'
import type { Ponto } from '../compartilhado/terreno'
import { calcularLote, type Lote } from './lote'
import type { ResultadoBusca } from './busca'
import { instalarContexto3D } from '../visualizacao/contexto3d'

// Mapa base aberto, sem chave. A atribuição ao OpenStreetMap é adicionada pelo MapLibre.
const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron'
const CENTRO_BRASIL: [number, number] = [-51.9, -14.2]

const PRETO = '#000000'

// O MapLibre monta o endereço do worker em tempo de execução, e o Vite não o inclui no build.
// Importar com ?url faz o Vite copiar o arquivo e devolver o endereço final.
setWorkerUrl(urlWorkerMapLibre)

export type ControleMapa = {
  irPara: (resultado: ResultadoBusca) => void
  desenharLote: () => void
  apagarLote: () => void
}

/** Rota pronta para desenhar, com o que aparece ao passar o cursor. */
export type RotaNoMapa = {
  categoria: string
  cor: string
  nomePonto: string
  distanciaKm: number
  estimada: boolean
  /** Peso da rota no total A4 + A5 de cada sistema, já em texto. */
  peso: string
  geometria: Feature<LineString>
}

type Props = {
  ref?: Ref<ControleMapa>
  pontos: Ponto[]
  rotas: RotaNoMapa[]
  /** Quando verdadeiro, o próximo clique no mapa escolhe o local de um fornecedor próprio. */
  escolhendoLocal: boolean
  aoEscolherLocal: (coordenadas: Position) => void
  aoAlternarPonto: (id: string) => void
  aoMudarLote: (lote: Lote | null) => void
  aoMudarDesenho: (desenhando: boolean) => void
}

function colecaoDePontos(pontos: Ponto[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: pontos.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p.coordenadas },
      properties: {
        id: p.id,
        nome: p.nome ?? 'Sem nome',
        cor: CATEGORIA_POR_ID[p.categoria].cor,
        letra: CATEGORIA_POR_ID[p.categoria].letra,
        categoria: CATEGORIA_POR_ID[p.categoria].nome,
        ativo: p.ativo,
        proprio: p.origem === 'usuario',
      },
    })),
  }
}

function colecaoDeRotas(rotas: RotaNoMapa[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: rotas.map((r) => ({
      ...r.geometria,
      properties: {
        categoria: r.categoria,
        cor: r.cor,
        nomePonto: r.nomePonto,
        distanciaKm: r.distanciaKm,
        estimada: r.estimada,
        peso: r.peso,
      },
    })),
  }
}

function textoRota(p: Record<string, unknown>): HTMLElement {
  const caixa = document.createElement('div')
  caixa.className = 'popup-ponto'
  const titulo = document.createElement('strong')
  titulo.textContent = String(p.categoria)
  const linhas = [
    String(p.nomePonto),
    `${Number(p.distanciaKm).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km${p.estimada ? ' (estimado)' : ' por estrada'}`,
    `Peso no total A4 + A5: ${p.peso}`,
  ].map((t) => {
    const linha = document.createElement('p')
    linha.textContent = t
    return linha
  })
  caixa.append(titulo, ...linhas)
  return caixa
}

function conteudoPopup(propriedades: Record<string, unknown>, aoAlternar: () => void): HTMLElement {
  const caixa = document.createElement('div')
  caixa.className = 'popup-ponto'
  const nome = document.createElement('strong')
  nome.textContent = String(propriedades.nome)
  const detalhe = document.createElement('p')
  detalhe.textContent = `${propriedades.categoria}${propriedades.proprio ? ' · fornecedor próprio' : ' · OpenStreetMap'}`
  const botao = document.createElement('button')
  botao.type = 'button'
  botao.textContent = propriedades.ativo ? 'Desligar' : 'Ligar'
  botao.addEventListener('click', aoAlternar)
  caixa.append(nome, detalhe, botao)
  return caixa
}

export function Mapa({ ref, pontos, rotas, escolhendoLocal, aoEscolherLocal, aoAlternarPonto, aoMudarLote, aoMudarDesenho }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaMapLibre | null>(null)
  const desenho = useRef<TerraDraw | null>(null)
  const loteId = useRef<string | number | null>(null)

  // Guarda os callbacks atuais sem recriar o mapa.
  const callbacks = useRef({ aoMudarLote, aoMudarDesenho, aoEscolherLocal, aoAlternarPonto })
  const escolhendo = useRef(escolhendoLocal)
  useLayoutEffect(() => {
    callbacks.current = { aoMudarLote, aoMudarDesenho, aoEscolherLocal, aoAlternarPonto }
    escolhendo.current = escolhendoLocal
  })

  useEffect(() => {
    const tela = mapa.current?.getCanvas()
    if (tela) tela.style.cursor = escolhendoLocal ? 'crosshair' : ''
  }, [escolhendoLocal])

  const rotasAtuais = useRef(rotas)
  useEffect(() => {
    rotasAtuais.current = rotas
    const fonte = mapa.current?.getSource('rotas') as GeoJSONSource | undefined
    fonte?.setData(colecaoDeRotas(rotas))
  }, [rotas])

  const pontosAtuais = useRef(pontos)
  useEffect(() => {
    pontosAtuais.current = pontos
    const fonte = mapa.current?.getSource('pontos') as GeoJSONSource | undefined
    fonte?.setData(colecaoDePontos(pontos))
  }, [pontos])

  useEffect(() => {
    const m = new MapaMapLibre({
      container: container.current!,
      style: ESTILO_MAPA,
      center: CENTRO_BRASIL,
      zoom: 3.5,
    })
    m.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    mapa.current = m

    m.on('load', () => {
      // Contexto primeiro: rotas, pontos e desenho entram acima dos volumes.
      instalarContexto3D(m)
      // Rotas abaixo dos pontos; linha tracejada quando a distância é estimada.
      m.addSource('rotas', { type: 'geojson', data: colecaoDeRotas(rotasAtuais.current) })
      for (const [id, estimada] of [
        ['rotas-estrada', false],
        ['rotas-estimadas', true],
      ] as const) {
        m.addLayer({
          id,
          type: 'line',
          source: 'rotas',
          filter: ['==', ['get', 'estimada'], estimada],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'cor'],
            'line-width': 4,
            'line-opacity': 0.85,
            ...(estimada ? { 'line-dasharray': [1, 2] } : {}),
          },
        })
      }
      const dicaRota = new Popup({ closeButton: false, closeOnClick: false, offset: 8 })
      for (const camada of ['rotas-estrada', 'rotas-estimadas']) {
        m.on('mousemove', camada, (e) => {
          const [rota] = e.features ?? []
          if (!rota) return
          m.getCanvas().style.cursor = escolhendo.current ? 'crosshair' : 'pointer'
          dicaRota.setLngLat(e.lngLat).setDOMContent(textoRota(rota.properties)).addTo(m)
        })
        m.on('mouseleave', camada, () => {
          m.getCanvas().style.cursor = escolhendo.current ? 'crosshair' : ''
          dicaRota.remove()
        })
      }

      // Pontos de fornecedores, abaixo do lote (as camadas do Terra Draw entram depois).
      m.addSource('pontos', { type: 'geojson', data: colecaoDePontos(pontosAtuais.current) })
      m.addLayer({
        id: 'pontos-circulo',
        type: 'circle',
        source: 'pontos',
        paint: {
          'circle-radius': ['case', ['get', 'proprio'], 9, 8],
          'circle-color': ['get', 'cor'],
          'circle-opacity': ['case', ['get', 'ativo'], 1, 0.3],
          // Fornecedor próprio ganha contorno preto para se distinguir dos pontos do OpenStreetMap.
          'circle-stroke-color': ['case', ['get', 'proprio'], PRETO, '#ffffff'],
          'circle-stroke-width': ['case', ['get', 'proprio'], 2.5, 1.5],
          'circle-stroke-opacity': ['case', ['get', 'ativo'], 1, 0.4],
        },
      })
      m.addLayer({
        id: 'pontos-letra',
        type: 'symbol',
        source: 'pontos',
        layout: {
          'text-field': ['get', 'letra'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#ffffff', 'text-opacity': ['case', ['get', 'ativo'], 1, 0.6] },
      })

      const popup = new Popup({ closeButton: true, closeOnClick: true, offset: 12 })

      m.on('click', (e) => {
        if (escolhendo.current) {
          callbacks.current.aoEscolherLocal([e.lngLat.lng, e.lngLat.lat])
          return
        }
        const [ponto] = m.queryRenderedFeatures(e.point, { layers: ['pontos-circulo'] })
        if (!ponto) return
        const propriedades = ponto.properties
        popup
          .setLngLat((ponto.geometry as Point).coordinates as [number, number])
          .setDOMContent(
            conteudoPopup(propriedades, () => {
              callbacks.current.aoAlternarPonto(String(propriedades.id))
              popup.remove()
            }),
          )
          .addTo(m)
      })
      m.on('mouseenter', 'pontos-circulo', () => {
        if (!escolhendo.current) m.getCanvas().style.cursor = 'pointer'
      })
      m.on('mouseleave', 'pontos-circulo', () => {
        if (!escolhendo.current) m.getCanvas().style.cursor = ''
      })

      const td = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
        modes: [
          new TerraDrawPolygonMode({
            styles: {
              fillColor: '#E8B923',
              fillOpacity: 0.24,
              outlineColor: '#E8B923',
              outlineWidth: 2,
              closingPointColor: PRETO,
              closingPointOutlineColor: '#ffffff',
            },
          }),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, midpoints: true, deletable: true },
                },
              },
            },
            styles: {
              selectedPolygonColor: '#E8B923',
              selectedPolygonFillOpacity: 0.24,
              selectedPolygonOutlineColor: '#E8B923',
              selectedPolygonOutlineWidth: 2,
              selectionPointColor: '#ffffff',
              selectionPointOutlineColor: PRETO,
              selectionPointWidth: 5,
              midPointColor: PRETO,
              midPointOutlineColor: '#ffffff',
            },
          }),
        ],
      })
      td.start()
      td.setMode('select')
      desenho.current = td

      const informarLote = () => {
        const id = loteId.current
        const feicao = id === null ? undefined : td.getSnapshotFeature(id)
        if (feicao?.geometry.type === 'Polygon') {
          callbacks.current.aoMudarLote(calcularLote(feicao as GeoJSONStoreFeatures as Feature<Polygon>))
        } else {
          loteId.current = null
          callbacks.current.aoMudarLote(null)
        }
      }

      td.on('finish', (id, contexto) => {
        if (contexto.action === 'draw') {
          // Apenas um lote por vez: o novo substitui o anterior.
          const outros = td.getSnapshot().filter((f) => f.id !== id).map((f) => f.id!)
          if (outros.length) td.removeFeatures(outros)
          loteId.current = id
          td.setMode('select')
          td.selectFeature(id)
          callbacks.current.aoMudarDesenho(false)
        }
        informarLote()
      })

      td.on('change', (ids, tipo) => {
        if (tipo === 'delete' && loteId.current !== null && ids.includes(loteId.current)) {
          informarLote()
        }
      })
    })

    return () => {
      desenho.current?.stop()
      desenho.current = null
      m.remove()
      mapa.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    irPara(resultado) {
      const [oeste, sul, leste, norte] = resultado.caixa
      mapa.current?.fitBounds([oeste, sul, leste, norte], { padding: 40, maxZoom: 18 })
    },
    desenharLote() {
      const td = desenho.current
      if (!td) return
      td.clear()
      loteId.current = null
      callbacks.current.aoMudarLote(null)
      td.setMode('polygon')
      callbacks.current.aoMudarDesenho(true)
    },
    apagarLote() {
      const td = desenho.current
      if (!td) return
      td.clear()
      td.setMode('select')
      loteId.current = null
      callbacks.current.aoMudarLote(null)
      callbacks.current.aoMudarDesenho(false)
    },
  }))

  return <div ref={container} className="mapa" />
}
