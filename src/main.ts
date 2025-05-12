import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as core from '@actions/core'
import fs from 'fs'
import path from 'path'

type MapStyle = {
  featureType: string
  elementType: string
  stylers: {
    visibility?: 'on' | 'off' | 'simplified'
    saturation?: number
    lightness?: number
    gamma?: number
    color?: string
    weight?: number
    hue?: string
    invert_lightness?: boolean
  }[]
}

const getMapStyles = () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const mapStylesPath = path.resolve(__dirname, './map-style.json')
  const mapStyles = fs.readFileSync(mapStylesPath, 'utf8')
  console.log('Validating map styles JSON')
  const mapStylesJSON = JSON.parse(mapStyles)
  try {
    verifyJSON(mapStylesJSON)
  } catch (error) {
    if (error instanceof TypeError) {
      core.setFailed(
        `TypeError: invalid JSON data, check the 'map-style.json.'`
      )
    }
  }
  if (!Array.isArray(mapStylesJSON)) {
    return [mapStylesJSON] as MapStyle[]
  }
  return mapStylesJSON as MapStyle[]
}

export const verifyJSON = (data: object) => {
  if (Array.isArray(data) && data.length > 0) {
    data.forEach((item) => {
      verifyJSON(item)
    })
  } else {
    if ('featureType' in data && 'elementType' in data && 'stylers' in data) {
      const { stylers } = data as MapStyle
      if (!Array.isArray(stylers)) {
        throw new TypeError('Invalid stylers')
      }
      stylers.forEach((styler) => {
        const key = Object.keys(styler)[0]
        if (
          key === 'visibility' &&
          !['on', 'off', 'simplified'].includes(styler[key]!)
        ) {
          throw new TypeError('Invalid visibility value')
        }
      })
    } else {
      throw new TypeError('Invalid JSON property')
    }
  }
}

const isValidPNG = (image: Buffer<ArrayBuffer>): boolean => {
  const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ])

  if (
    image.length > PNG_SIGNATURE.length &&
    image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) &&
    image.length > 1000
  ) {
    return true
  }

  return false
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // const styleTypes = [
    //   'hue',
    //   'visibility',
    //   'saturation',
    //   'lightness',
    //   'gamma',
    //   'color',
    //   'weight',
    //   'invert_lightness'
    // ]
    const mapStyles = getMapStyles()

    const outputPath = core.getInput('output')
    const apiKey = core.getInput('google_static_map_api_key')
    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap?'

    const address = core.getInput('address')
    const zoom = parseInt(core.getInput('zoom'))
    if (isNaN(zoom)) {
      throw new Error('Invalid zoom level, must be a number')
    }

    const params = new URLSearchParams()
    params.append('center', address)
    params.append('zoom', `${zoom}`)
    // Highest quality
    params.append('size', '640x640')
    params.append('scale', '2')
    mapStyles.forEach((style) => {
      let styleString = `feature:${style.featureType}|element:${style.elementType}|`
      styleString += style.stylers
        .map((styler) => {
          const keys = Object.keys(styler)
          return `${keys[0]}:${styler[keys[0] as keyof typeof styler]}`
        })
        .join('|')
      params.append('style', styleString)
    })
    params.append('key', apiKey)
    const fullUrl = `${baseUrl}${params.toString()}`
    const response = await fetch(fullUrl)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!isValidPNG(buffer)) {
      throw new Error('Invalid PNG image')
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, buffer)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}
