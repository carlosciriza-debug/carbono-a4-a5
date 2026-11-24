import 'maplibre-gl/dist/maplibre-gl.css'
import { type GeoJSONSource, Map as MapaMapLibre, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import urlWorkerMapLibre from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, type GeoJSONStoreFeatures } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import { CATEGORIA_POR_ID } from '../compartilhado/categorias'
import type { Ponto } from '../compartilhado/terreno'
import { calcularLote, type Lote } from './lote'
import type { ResultadoBusca } from './busca'

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

type Props = {
  ref?: Ref<ControleMapa>
  pontos: Ponto[]
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
        ativo: p.ativo,
      },
    })),
  }
}

export function Mapa({ ref, pontos, aoMudarLote, aoMudarDesenho }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaMapLibre | null>(null)
  const desenho = useRef<TerraDraw | null>(null)
  const loteId = useRef<string | number | null>(null)

  // Guarda os callbacks atuais sem recriar o mapa.
  const callbacks = useRef({ aoMudarLote, aoMudarDesenho })
  useLayoutEffect(() => {
    callbacks.current = { aoMudarLote, aoMudarDesenho }
  })

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
      // Pontos de fornecedores, abaixo do lote (as camadas do Terra Draw entram depois).
      m.addSource('pontos', { type: 'geojson', data: colecaoDePontos(pontosAtuais.current) })
      m.addLayer({
        id: 'pontos-circulo',
        type: 'circle',
        source: 'pontos',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'cor'],
          'circle-opacity': ['case', ['get', 'ativo'], 1, 0.3],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
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
        paint: { 'text-color': '#ffffff' },
      })

      const td = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
        modes: [
          new TerraDrawPolygonMode({
            styles: {
              fillColor: PRETO,
              fillOpacity: 0.08,
              outlineColor: PRETO,
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
              selectedPolygonColor: PRETO,
              selectedPolygonFillOpacity: 0.12,
              selectedPolygonOutlineColor: PRETO,
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
