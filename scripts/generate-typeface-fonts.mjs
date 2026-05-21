import fs from 'node:fs/promises'
import path from 'node:path'
import opentype from 'opentype.js'

const outDir = path.resolve('public/fonts/pl')
const tmpDir = path.resolve('.tmp-fonts')

const sources = [
  {
    name: 'noto_sans_regular.typeface.json',
    ttf: 'NotoSans-Regular.ttf',
    url: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  },
  {
    name: 'noto_serif_regular.typeface.json',
    ttf: 'NotoSerif-Regular.ttf',
    url: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSerif/NotoSerif-Regular.ttf',
  },
]

const scaleFor = (font) => (1000 * 100) / ((font.unitsPerEm || 2048) * 72)

function commandToken(command, scale) {
  let token = command.type.toLowerCase()
  token += ' '

  if (command.x !== undefined && command.y !== undefined) {
    token += `${Math.round(command.x * scale)} ${Math.round(command.y * scale)} `
  }
  if (command.x1 !== undefined && command.y1 !== undefined) {
    token += `${Math.round(command.x1 * scale)} ${Math.round(command.y1 * scale)} `
  }
  if (command.x2 !== undefined && command.y2 !== undefined) {
    token += `${Math.round(command.x2 * scale)} ${Math.round(command.y2 * scale)} `
  }

  return token
}

function toTypefaceJson(font) {
  const scale = scaleFor(font)
  const result = {
    glyphs: {},
    familyName: font.names.windows?.preferredFamily?.en || font.names.windows?.fontFamily?.en || font.names.unicode?.fontFamily?.en || 'CustomFont',
    ascender: Math.round(font.ascender * scale),
    descender: Math.round(font.descender * scale),
    underlinePosition: Math.round((font.tables.post?.underlinePosition || 0) * scale),
    underlineThickness: Math.round((font.tables.post?.underlineThickness || 0) * scale),
    boundingBox: {
      yMin: Math.round((font.tables.head?.yMin || 0) * scale),
      xMin: Math.round((font.tables.head?.xMin || 0) * scale),
      yMax: Math.round((font.tables.head?.yMax || 0) * scale),
      xMax: Math.round((font.tables.head?.xMax || 0) * scale),
    },
    resolution: 1000,
    original_font_information: font.tables.name,
    cssFontWeight: 'normal',
    cssFontStyle: 'normal',
  }

  for (let i = 0; i < font.glyphs.length; i += 1) {
    const glyph = font.glyphs.get(i)
    if (!glyph) {
      continue
    }

    const unicodes = []
    if (glyph.unicode !== undefined) {
      unicodes.push(glyph.unicode)
    }
    if (Array.isArray(glyph.unicodes)) {
      for (const code of glyph.unicodes) {
        if (!unicodes.includes(code)) {
          unicodes.push(code)
        }
      }
    }

    for (const unicode of unicodes) {
      const glyphChar = String.fromCodePoint(unicode)
      const token = {
        ha: Math.round((glyph.advanceWidth || 0) * scale),
        x_min: Math.round((glyph.xMin || 0) * scale),
        x_max: Math.round((glyph.xMax || 0) * scale),
        o: '',
      }

      for (const command of glyph.path.commands) {
        token.o += commandToken(command, scale)
      }

      result.glyphs[glyphChar] = token
    }
  }

  return JSON.stringify(result)
}

async function download(url, dest) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed: ${url} (${response.status})`)
  }
  const data = new Uint8Array(await response.arrayBuffer())
  await fs.writeFile(dest, data)
}

async function main() {
  await fs.mkdir(tmpDir, { recursive: true })
  await fs.mkdir(outDir, { recursive: true })

  for (const source of sources) {
    const ttfPath = path.join(tmpDir, source.ttf)
    const outPath = path.join(outDir, source.name)

    await download(source.url, ttfPath)
    const ttfBytes = await fs.readFile(ttfPath)
    const font = opentype.parse(ttfBytes.buffer.slice(ttfBytes.byteOffset, ttfBytes.byteOffset + ttfBytes.byteLength))
    const json = toTypefaceJson(font)
    await fs.writeFile(outPath, json, 'utf8')
    console.log(`Generated: ${outPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
