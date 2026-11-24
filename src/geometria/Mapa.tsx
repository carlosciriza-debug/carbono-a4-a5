import 'maplibre-gl/dist/maplibre-gl.css'
import { Map as MapaMapLibre, NavigationControl, ScaleControl } from 'maplibre-gl'
import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, type GeoJSONStoreFeatures } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Feature, Polygon } from 'geojson'
import { calcularLote, type Lote } from './lote'
import type { ResultadoBusca } from './busca'

// Mapa base aberto, sem chave. A atribuição ao OpenStreetMap é adicionada pelo MapLibre.
const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron'
const CENTRO_BRASIL: [number, number] = [-51.9, -14.2]

const PRETO = '#000000'

export type ControleMapa = {
  irPara: (resultado: ResultadoBusca) => void
  desenharLote: () => void
  apagarLote: () => void
}

type Props = {
  ref?: Ref<ControleMapa>
  aoMudarLote: (lote: Lote | null) => void
  aoMudarDesenho: (desenhando: boolean) => void
}

export function Mapa({ ref, aoMudarLote, aoMudarDesenho }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaMapLibre | null>(null)
  const desenho = useRef<TerraDraw | null>(null)
  const loteId = useRef<string | number | null>(null)

  // Guarda os callbacks atuais sem recriar o mapa.
  const callbacks = useRef({ aoMudarLote, aoMudarDesenho })
  useLayoutEffect(() => {
    callbacks.current = { aoMudarLote, aoMudarDesenho }
  })

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
