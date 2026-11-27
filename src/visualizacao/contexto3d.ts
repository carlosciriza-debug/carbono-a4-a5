import { type Map as MapaMapLibre, type IControl, type ExpressionSpecification, Popup } from 'maplibre-gl'
import { FATORES } from '../compartilhado/fatores'
import { alturaContexto } from './alturaContexto'

const ID = 'contexto-edificacoes-3d'
const COR_INFORMADA = '#BFC0BD'
const COR_ESTIMADA = '#DEDEDA'
const PADRAO = FATORES.alturaPorPavimento.valor
const ZOOM_MIN = 14
const ALTURA_DIRETA: ExpressionSpecification = ['to-number', ['get', 'height'], 0]
const ALTURA_RENDER: ExpressionSpecification = ['to-number', ['get', 'render_height'], 0]
const TEM_DIRETA: ExpressionSpecification = ['>', ALTURA_DIRETA, 0]
const TEM_RENDER: ExpressionSpecification = ['all', ['>', ALTURA_RENDER, 0], ['!=', ALTURA_RENDER, 5]]
const ALTURA: ExpressionSpecification = [
  'case', TEM_DIRETA, ALTURA_DIRETA, TEM_RENDER, ALTURA_RENDER, PADRAO ?? 0,
]

/** O próprio mapa base fornece a geometria; não há pedido extra ao Overpass. */
export function instalarContexto3D(m: MapaMapLibre) {
  const camadas = m.getStyle().layers ?? []
  const edificios = camadas.find((c) => 'source-layer' in c && c['source-layer'] === 'building' && c.type === 'fill')
  const fonte = edificios && 'source' in edificios ? edificios.source : undefined
  if (fonte) {
    m.addLayer({
      id: ID,
      type: 'fill-extrusion',
      source: fonte,
      'source-layer': 'building',
      minzoom: ZOOM_MIN,
      filter: ['all', ['!=', ['to-string', ['get', 'hide_3d']], 'true'], ['!=', ['to-string', ['get', 'hide_3d']], '1'], ['>', ALTURA, 0]],
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': ['case', TEM_DIRETA, COR_INFORMADA, COR_ESTIMADA],
        'fill-extrusion-height': ALTURA,
        'fill-extrusion-base': ['min', ALTURA, ['max', 0, ['to-number', ['get', 'render_min_height'], 0]]],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    })
  }

  let ativo = false
  let cameraAnterior: { pitch: number; bearing: number } = { pitch: 0, bearing: 0 }
  const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 8 })
  const caixa = document.createElement('div')
  caixa.className = 'maplibregl-ctrl contexto3d'
  const botao = document.createElement('button')
  botao.type = 'button'
  botao.textContent = '2D / 3D'
  botao.setAttribute('aria-label', 'Alternar visualização 2D e 3D')
  botao.setAttribute('aria-pressed', 'false')
  botao.disabled = !fonte
  const legenda = document.createElement('div')
  legenda.className = 'contexto3d-legenda'
  legenda.hidden = Boolean(fonte)
  legenda.setAttribute('role', 'status')
  legenda.setAttribute('aria-live', 'polite')
  if (!fonte) legenda.textContent = 'Contexto 3D indisponível neste mapa base.'
  caixa.append(botao, legenda)

  function atualizarLegenda() {
    if (!ativo) return
    const aviso = m.getZoom() < ZOOM_MIN ? ' Aproxime o mapa para ver os volumes.' : ''
    legenda.textContent = 'Contexto · cinza: altura informada; cinza claro: estimativa ou padrão. ' +
      (PADRAO === null ? 'Altura padrão pendente.' : 'Padrão sem dados: ' + PADRAO + ' m (um pavimento).') + aviso
  }
  function alternar() {
    if (!fonte) return
    ativo = !ativo
    m.setLayoutProperty(ID, 'visibility', ativo ? 'visible' : 'none')
    botao.setAttribute('aria-pressed', String(ativo))
    botao.textContent = ativo ? '3D / 2D' : '2D / 3D'
    legenda.hidden = !ativo
    if (ativo) {
      cameraAnterior = { pitch: m.getPitch(), bearing: m.getBearing() }
      m.easeTo({ pitch: 55, bearing: -20, duration: 650 })
      atualizarLegenda()
    } else {
      popup.remove()
      m.easeTo({ ...cameraAnterior, duration: 650 })
    }
  }
  botao.addEventListener('click', alternar)
  m.on('zoomend', atualizarLegenda)
  if (fonte) {
    m.on('mousemove', ID, (e) => {
      if (!ativo || !e.features?.length) return
      const altura = alturaContexto(e.features[0].properties, PADRAO)
      const texto = document.createElement('div')
      const origem = altura.tipo === 'informada' ? 'altura informada no mapa (não verificada)' :
        altura.tipo === 'estimada' ? 'altura de renderização estimada (OpenMapTiles)' :
        altura.tipo === 'padrao' ? 'altura padrão · OSM Wiki (não verificada)' : 'altura pendente'
      texto.textContent = altura.metros === null ? origem : altura.metros.toLocaleString('pt-BR') + ' m · ' + origem
      popup.setLngLat(e.lngLat).setDOMContent(texto).addTo(m)
    })
    m.on('mouseleave', ID, () => popup.remove())
  }
  const controle: IControl = {
    onAdd: () => caixa,
    onRemove: () => {
      botao.removeEventListener('click', alternar)
      m.off('zoomend', atualizarLegenda)
      popup.remove()
      caixa.remove()
    },
  }
  m.addControl(controle, 'top-right')
}
