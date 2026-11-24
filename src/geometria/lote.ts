import area from '@turf/area'
import centroid from '@turf/centroid'
import type { Feature, Polygon, Position } from 'geojson'
import type { Lote } from '../compartilhado/terreno'

export type { Lote }

export function calcularLote(poligono: Feature<Polygon>): Lote {
  return {
    poligono,
    areaM2: area(poligono),
    centro: centroid(poligono).geometry.coordinates,
  }
}

export function formatarArea(areaM2: number): string {
  return `${Math.round(areaM2).toLocaleString('pt-BR')} m²`
}

export function formatarCoordenadas([lng, lat]: Position): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
