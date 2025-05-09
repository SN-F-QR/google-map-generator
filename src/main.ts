import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as core from '@actions/core'
import fs from 'fs'
import path from 'path'

type MapStyle = {
  featureType: string
  elementType: string
  stylers: {
    visibility?: string
    saturation?: string
    lightness?: string
    gamma?: string
  }[]
}

const getMapStyles = () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  console.log('dir path:', __dirname)
  const mapStylesPath = path.resolve(__dirname, './map-style.json')
  console.log('Map styles path:', mapStylesPath)
  const mapStyles = fs.readFileSync(mapStylesPath, 'utf8')
  return JSON.parse(mapStyles) as MapStyle[]
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
    const styleTypes = ['visibility', 'saturation', 'lightness', 'gamma']
    const mapStyles = getMapStyles()

    const outputPath = core.getInput('output')
    const apiKey = process.env['MAPS_API_KEY'] ?? ''
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
          if (keys.length > 0 && styleTypes.includes(keys[0])) {
            return `${keys[0]}:${styler[keys[0] as keyof typeof styler]}`
          }
          throw new TypeError('Invalid style object')
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
    } else if (error instanceof TypeError) {
      core.setFailed(
        `TypeError: ${error.message}, you may have provided an invalid property in stylers, check the 'map-style.json.'`
      )
    }
  }
}
