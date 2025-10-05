from PIL import Image
import aiofiles.os
import concurrent.futures
import time
import io
import random
import logging
import asyncio

from utils.extruder import png_to_stl
import aiofiles

LOG = logging.getLogger(__name__)

PATH_TO_OPENSCAD = "/bin/OpenSCAD-2021.01-x86_64.AppImage"

OPENSCAD_COLOURS: dict[str, str] = {
  "aliceblue": "f0f8ff",
  "antiquewhite": "faebd7",
  "aqua": "00ffff",
  "aquamarine": "7fffd4",
  "azure": "f0ffff",
  "beige": "f5f5dc",
  "bisque": "ffe4c4",
  "black": "000000",
  "blanchedalmond": "ffebcd",
  "blue": "0000ff",
  "blueviolet": "8a2be2",
  "brown": "a52a2a",
  "burlywood": "deb887",
  "cadetblue": "5f9ea0",
  "chartreuse": "7fff00",
  "chocolate": "d2691e",
  "coral": "ff7f50",
  "cornflowerblue": "6495ed",
  "cornsilk": "fff8dc",
  "crimson": "dc143c",
  "cyan": "00ffff",
  "darkblue": "00008b",
  "darkcyan": "008b8b",
  "darkgoldenrod": "b8860b",
  "darkgray": "a9a9a9",
  "darkgreen": "006400",
  "darkgrey": "a9a9a9",
  "darkkhaki": "bdb76b",
  "darkmagenta": "8b008b",
  "darkolivegreen": "556b2f",
  "darkorange": "ff8c00",
  "darkorchid": "9932cc",
  "darkred": "8b0000",
  "darksalmon": "e9967a",
  "darkseagreen": "8fbc8f",
  "darkslateblue": "483d8b",
  "darkslategray": "2f4f4f",
  "darkslategrey": "2f4f4f",
  "darkturquoise": "00ced1",
  "darkviolet": "9400d3",
  "deeppink": "ff1493",
  "deepskyblue": "00bfff",
  "dimgray": "696969",
  "dimgrey": "696969",
  "dodgerblue": "1e90ff",
  "firebrick": "b22222",
  "floralwhite": "fffaf0",
  "forestgreen": "228b22",
  "fuchsia": "ff00ff",
  "gainsboro": "dcdcdc",
  "ghostwhite": "f8f8ff",
  "gold": "ffd700",
  "goldenrod": "daa520",
  "gray": "808080",
  "green": "008000",
  "greenyellow": "adff2f",
  "grey": "808080",
  "honeydew": "f0fff0",
  "hotpink": "ff69b4",
  "indianred": "cd5c5c",
  "indigo": "4b0082",
  "ivory": "fffff0",
  "khaki": "f0e68c",
  "lavender": "e6e6fa",
  "lavenderblush": "fff0f5",
  "lawngreen": "7cfc00",
  "lemonchiffon": "fffacd",
  "lightblue": "add8e6",
  "lightcoral": "f08080",
  "lightcyan": "e0ffff",
  "lightgoldenrodyellow": "fafad2",
  "lightgray": "d3d3d3",
  "lightgreen": "90ee90",
  "lightgrey": "d3d3d3",
  "lightpink": "ffb6c1",
  "lightsalmon": "ffa07a",
  "lightseagreen": "20b2aa",
  "lightskyblue": "87cefa",
  "lightslategray": "778899",
  "lightslategrey": "778899",
  "lightsteelblue": "b0c4de",
  "lightyellow": "ffffe0",
  "lime": "00ff00",
  "limegreen": "32cd32",
  "linen": "faf0e6",
  "magenta": "ff00ff",
  "maroon": "800000",
  "mediumaquamarine": "66cdaa",
  "mediumblue": "0000cd",
  "mediumorchid": "ba55d3",
  "mediumpurple": "9370db",
  "mediumseagreen": "3cb371",
  "mediumslateblue": "7b68ee",
  "mediumspringgreen": "00fa9a",
  "mediumturquoise": "48d1cc",
  "mediumvioletred": "c71585",
  "midnightblue": "191970",
  "mintcream": "f5fffa",
  "mistyrose": "ffe4e1",
  "moccasin": "ffe4b5",
  "navajowhite": "ffdead",
  "navy": "000080",
  "oldlace": "fdf5e6",
  "olive": "808000",
  "olivedrab": "6b8e23",
  "orange": "ffa500",
  "orangered": "ff4500",
  "orchid": "da70d6",
  "palegoldenrod": "eee8aa",
  "palegreen": "98fb98",
  "paleturquoise": "afeeee",
  "palevioletred": "db7093",
  "papayawhip": "ffefd5",
  "peachpuff": "ffdab9",
  "peru": "cd853f",
  "pink": "ffc0cb",
  "plum": "dda0dd",
  "powderblue": "b0e0e6",
  "purple": "800080",
  "red": "ff0000",
  "rosybrown": "bc8f8f",
  "royalblue": "4169e1",
  "saddlebrown": "8b4513",
  "salmon": "fa8072",
  "sandybrown": "f4a460",
  "seagreen": "2e8b57",
  "seashell": "fff5ee",
  "sienna": "a0522d",
  "silver": "c0c0c0",
  "skyblue": "87ceeb",
  "slateblue": "6a5acd",
  "slategray": "708090",
  "slategrey": "708090",
  "snow": "fffafa",
  "springgreen": "00ff7f",
  "steelblue": "4682b4",
  "tan": "d2b48c",
  "teal": "008080",
  "thistle": "d8bfd8",
  "tomato": "ff6347",
  "turquoise": "40e0d0",
  "violet": "ee82ee",
  "wheat": "f5deb3",
  "white": "ffffff",
  "whitesmoke": "f5f5f5",
  "yellow": "ffff00",
  "yellowgreen": "9acd32"
}

rgb_openscad_colours: dict[tuple[int,int,int], str] = {}
# Store a cache of hex codes -> svg names
openscad_colour_cache: dict[str, str] = {}
for name,hex in OPENSCAD_COLOURS.items():
  r = int(hex[0:2], 16)
  g = int(hex[2:4], 16)
  b = int(hex[4:6], 16)
  rgb_openscad_colours[(r, g, b, )] = name

def get_closest_match(source: str) -> str:
  "Get the closest colour to the source hex, return the human name of it"
  if source in openscad_colour_cache:
    return openscad_colour_cache[source]
  sr = int(source[0:2], 16)
  sg = int(source[2:4], 16)
  sb = int(source[4:6], 16)

  # Manhattan Distance
  def distance(col1, col2):
    return sum(abs(c1 - c2) for c1, c2 in zip(col1, col2))

  lowest_distance = float("inf")
  source_colour = [sr,sg,sb]
  closest_colour = []
  for colour in rgb_openscad_colours.keys():
    dist = distance(colour, source_colour)
    if dist < lowest_distance:
      closest_colour = colour
      lowest_distance = dist

  openscad_colour_cache[source] = rgb_openscad_colours[closest_colour]

  return rgb_openscad_colours[closest_colour]


# models dict should have `filepath`, `colour`, and `offset_x` and `offset_y`
def generate_openscad_script(models: list[dict[str, str | int]]) -> str:
  script = "/* Define colours */\n"
  part_template = """module part_{colour}() {{
  color("{colour}") translate([{offset_x}, {offset_y}, 0]) import("{filepath}");
}}\n"""

  for model in models:
    script += part_template.format(
      colour=model["colour"],
      filepath=model["filepath"],
      offset_x=model["offset_x"],
      offset_y=model["offset_y"]
    )
  
  script += """\n/* Main module */
module combined_model() {
"""
  
  for model in models:
    script += f"part_{model['colour']}();\n"
  
  script += """}

/* Render the model */
combined_model();"""

  return script

# models dict should have `filepath`, `colour`, and `offset_x`, and `offset_y`, and `offset_z`
def generate_openscad_script_heights(models: list[dict[str, str | int]]) -> str:
  script = "/* Define colours */\n"
  part_template = """module part_{colour}_{id}() {{
  color("{colour}") translate([{offset_x}, {offset_y}, {offset_z}]) resize([0, 0, {thickness}]) import("{filepath}");
}}\n"""

  for model in models:
    script += part_template.format(
      colour=model["colour"],
      filepath=model["filepath"],
      offset_x=model["offset_x"],
      offset_y=model["offset_y"],
      offset_z=model["offset_z"],
      thickness=model["thickness"],
      id=model.get("id","default")
    )
  
  script += """\n/* Main module */
module combined_model() {
"""
  
  for model in models:
    script += f"part_{model['colour']}_{model.get("id","default")}();\n"
  
  script += """}

/* Render the model */
combined_model();"""

  return script

def identify_colours(png_data: bytes) -> dict[str, str]:
  "Identify individual colours and match their names in a dict of hex: name"
  png_bytesio = io.BytesIO(png_data)
  img = Image.open(png_bytesio).convert("RGBA")

  # get hex colors
  colour_counts = img.getcolors(img.size[0] * img.size[1])
  LOG.info("got total colours in the image)")

  hex_colours: dict[str, str] = {}
  for count, rgba in colour_counts:
    r, g, b, a = rgba
    hex_value = f"{r:02x}{g:02x}{b:02x}"
    if hex_value == "fefefe":
      continue
    human_colour = get_closest_match(hex_value)
    hex_colours[hex_value] = human_colour
  
  return hex_colours

  

def separate_png(png_data: bytes, generate_background: bool = False) -> dict[str, bytes]:
  "Separate a PNG into separate PNGs by colour"

  "The dict will be hex:png_bytes, where hex is just FFFFFF, and the png_bytes is a black and white image for the svg converter"
  LOG.info("Converting multicolour image into separate colour images")
  png_bytesio = io.BytesIO(png_data)
  img = Image.open(png_bytesio).convert("RGBA")

  # get hex colors
  color_counts = img.getcolors(img.size[0] * img.size[1])
  LOG.info("got total colours in the image)")

  hex_colours: set[str] = set()
  for count, rgba in color_counts:
    r, g, b, a = rgba
    hex_value = f"{r:02x}{g:02x}{b:02x}"
    if hex_value == "fefefe":
      continue
    human_colour = get_closest_match(hex_value)
    hex_colours.add(human_colour)

  pixels = img.load()
  width, height = img.size

  outputs = {}
  for color in hex_colours:
    LOG.info(color)
    outputs[color] = Image.new(
      "RGBA", (width, height), color=(255, 255, 255, 255)
    )
    outputs[color].pixels = outputs[color].load()
  if generate_background:
    outputs["background"] = Image.new("RGBA", (width, height), color=(255,255,255,255))

  LOG.info(f"made {len(outputs.keys())} image objects for each colour")

  last_time = time.time()
  last_pixels = 0
  for y in range(height):
    for x in range(width):
      last_pixels += 1
      if (time.time() - last_time) > 1:
        last_time = time.time()
        LOG.info(f"processed {last_pixels} in 1 second")
        LOG.info(f"processed {y*width+x}/{width*height} ({round((y*width+x)/(width*height)*100,1)}%) pixels")
        remaining_pixels = (width*height) - (y*width+x)
        eta = round(remaining_pixels/last_pixels, 1)
        LOG.info(f"ETA: {eta}s")
        last_pixels = 0
      rgba = pixels[x, y]
      r, g, b, a = rgba
      hex_value = f"{r:02x}{g:02x}{b:02x}"
      if hex_value == "fefefe":
        continue
      human_colour = get_closest_match(hex_value)
      outputs[human_colour].putpixel((x, y), (0, 0, 0, 255))
      if generate_background:
        outputs["background"].putpixel((x, y), (0, 0, 0, 255))

  LOG.info("separated each colour channel")

  output_pngs = {}
  for color, img in outputs.items():
    stream = io.BytesIO()
    img.save(stream, "png")
    output_pngs[color] = stream.getvalue()

  LOG.info("saved each colour channel")

  return output_pngs


def make_id() -> str:
  pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return "".join(random.choices(pool, k=16))

# models dict should have `filepath`, `colour`, and offset_[x,y,z]
async def merge_multiple_stls(models: list[dict[str, str | int]]) -> bytes:
  script = "/* Define colours */\n"
  part_template = """module part_{colour}() {{
  color("{colour}") translate([{offset_x}, {offset_y}, 0]) import("{filepath}");
}}\n"""

  for model in models:
    script += part_template.format(
      colour=model["colour"],
      filepath=model["filepath"],
      offset_x=model["offset_x"],
      offset_y=model["offset_y"]
    )
  
  script += """\n/* Main module */
module combined_model() {
"""
  
  for model in models:
    script += f"part_{model['colour']}();\n"
  
  script += """}

/* Render the model */
combined_model();"""


async def generate_multicolour_part(
  images: dict[str, bytes], z: float, x: float = 0, y: float = 0
) -> bytes:
  "Take multiple images by hexadecimal colour, and output a 3MF file."
  coloured_stls: dict[str, bytes] = {}
  # based off of the center of each image
  sizes: dict[str, dict[str, int]] = {}  # The real
  # Convert each image to an STL
  for colour, image in images.items():
    LOG.info(f"getting data for {colour} channel")
    try:
      coloured_stls[colour] = await png_to_stl(image, z, x, y, size_based_on_total_image_size=True, error_empty_svg=True)
    except ValueError:
      coloured_stls[colour] = "SKIPPED"
      continue
    png_buffer = io.BytesIO(image)
    img = Image.open(png_buffer)
    img.convert("L")
    width, height = img.size
    top = height
    bottom = 0
    left = width
    right = 0

    pixels = img.load()

    area = 0

    for image_y in range(height):
      for image_x in range(width):
        r, g, b, a = pixels[image_x, image_y]
        if r * g * b != 255 * 255 * 255:
          area += 1
          # This pixel is something other than white, mark it.
          if image_y > bottom:
            bottom = image_y
          if image_x > right:
            right = image_x
          if image_y < top:
            top = image_y
          if image_x < left:
            left = image_x

    # Now insert these into the sizes for postprocessing
    center_x = (right + left) / 2
    center_y = (top + bottom) / 2

    height_dpmm = (height / y)
    width_dpmm = (width / x)

    offset_x = -(((width / 2) - center_x) / width_dpmm)
    offset_y = ((height / 2) - center_y) / height_dpmm
    sizes[colour] = {
      "left": left,
      "right": right,
      "top": top,
      "bottom": bottom,
      "cx": center_x,
      "cy": center_y,
      "ox": offset_x,
      "oy": offset_y,
      "area": area
    }

  job_id = make_id()

  # write each STL to a file for orcaslicer to import
  stls: list[str] = []
  models: list[dict[str, int|str]] = []
  for colour, stl in coloured_stls.items():
    if stl == "SKIPPED":
      continue
    LOG.info(f"extruding {colour}")
    f = await aiofiles.open(f"/tmp/extruder/{job_id}_{colour}.stl", "wb")
    await f.write(stl)
    await f.close()
    stls.append(f"/tmp/extruder/{job_id}_{colour}.stl")
    models.append({
      "colour": colour,
      "filepath": f"/tmp/extruder/{job_id}_{colour}.stl",
      "offset_x": sizes[colour]["ox"],
      "offset_y": sizes[colour]["oy"],
      "area": sizes[colour]["area"]
    })

  models.sort(key=lambda a: a["area"])

  LOG.info("generating openscad script")
  scad_script = generate_openscad_script(models)
  scad_file = await aiofiles.open(f"/tmp/extruder/{job_id}.scad", "w")
  await scad_file.write(scad_script)
  await scad_file.close()

  LOG.info("running colorscad")
  process = await asyncio.subprocess.create_subprocess_shell(
    f"colorscad -o /tmp/extruder/{job_id}.3mf -i /tmp/extruder/{job_id}.scad -j 8 -- --backend manifold", stderr=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE
  )

  returncode = await process.wait()
  if returncode != 0:
    LOG.info((await process.stderr.read()).decode())
    raise ValueError("ColorSCAD 3MF Failure!")

  f = await aiofiles.open(f"/tmp/extruder/{job_id}.3mf", "rb")
  threemf_data = await f.read()
  await f.close()

  # Now clean up
  await aiofiles.os.remove(f"/tmp/extruder/{job_id}.3mf")
  for stl in stls:
    await aiofiles.os.remove(stl)

  return threemf_data

async def generate_backed_multicolour_part(
  images: dict[str, bytes], z: float, x: float = 0, y: float = 0, black_thickness: float = 0
) -> bytes:
  "Take multiple images by hexadecimal colour, and output a 3MF file backed with a single colour."
  "By default, black_thickness = z"
  if not black_thickness:
    black_thickness = z
  coloured_stls: dict[str, bytes] = {}
  # based off of the center of each image
  sizes: dict[str, dict[str, int]] = {}  # The real
  # Convert each image to an STL
  for colour, image in images.items():
    LOG.info(f"getting data for {colour} channel")
    try:
      if colour == "background":
        coloured_stls[colour] = await png_to_stl(image, black_thickness, x, y, size_based_on_total_image_size=True, error_empty_svg=True)
      else:
        coloured_stls[colour] = await png_to_stl(image, z, x, y, size_based_on_total_image_size=True, error_empty_svg=True)
    except ValueError:
      coloured_stls[colour] = "SKIPPED"
      continue
    png_buffer = io.BytesIO(image)
    img = Image.open(png_buffer)
    img.convert("L")
    width, height = img.size
    top = height
    bottom = 0
    left = width
    right = 0

    pixels = img.load()

    area = 0

    for image_y in range(height):
      for image_x in range(width):
        r, g, b, a = pixels[image_x, image_y]
        if r * g * b != 255 * 255 * 255:
          area += 1
          # This pixel is something other than white, mark it.
          if image_y > bottom:
            bottom = image_y
          if image_x > right:
            right = image_x
          if image_y < top:
            top = image_y
          if image_x < left:
            left = image_x

    # Now insert these into the sizes for postprocessing
    center_x = (right + left) / 2
    center_y = (top + bottom) / 2

    height_dpmm = (height / y)
    width_dpmm = (width / x)

    offset_x = -(((width / 2) - center_x) / width_dpmm)
    offset_y = ((height / 2) - center_y) / height_dpmm
    sizes[colour] = {
      "left": left,
      "right": right,
      "top": top,
      "bottom": bottom,
      "cx": center_x,
      "cy": center_y,
      "ox": offset_x,
      "oy": offset_y,
      "area": area
    }

  job_id = make_id()

  # write each STL to a file for orcaslicer to import
  stls: list[str] = []
  models: list[dict[str, int|str]] = []
  for colour, stl in coloured_stls.items():
    if stl == "SKIPPED":
      continue
    #if colour in ["background","black"]:
    #  continue # Merge these into one object
    LOG.info(f"extruding {colour}")
    f = await aiofiles.open(f"/tmp/extruder/{job_id}_{colour}.stl", "wb")
    await f.write(stl)
    await f.close()
    stls.append(f"/tmp/extruder/{job_id}_{colour}.stl")
    if colour == "background":
      models.append({
        "colour": colour,
        "filepath": f"/tmp/extruder/{job_id}_{colour}.stl",
        "offset_x": sizes[colour]["ox"],
        "offset_y": sizes[colour]["oy"],
        "offset_z": 0,
        "thickness": black_thickness,
        "area": sizes[colour]["area"],
        "id": make_id()
      })
    else:
      # translations are based off of the center of the part
      # The bottom of the coloured parts are at `-(z/2)`
      # The middle of the black parts are `black_thickness/2`
      # To move them down the correct distance, we must do black_thickness+z
      distance = (black_thickness/2) + (z/2)
      models.append({
        "colour": colour,
        "filepath": f"/tmp/extruder/{job_id}_{colour}.stl",
        "offset_x": sizes[colour]["ox"],
        "offset_y": sizes[colour]["oy"],
        "offset_z": distance,
        "area": sizes[colour]["area"],
        "thickness": z,
        "id": make_id()
      })


  #if "black" in coloured_stls.keys():
  #  pass
  #else:
  #  models.append({
  #    "colour": "black",
  #    "filepath": f"/tmp/extruder/{job_id}_{colour}.stl",
  #    "offset_x": sizes[colour]["ox"],
  #    "offset_y": sizes[colour]["oy"],
  #    "offset_z": 0,
  #    "area": sizes[colour]["area"]
  #  })

  models.sort(key=lambda a: a["area"])

  LOG.info("generating openscad script")
  scad_script = generate_openscad_script_heights(models)
  scad_file = await aiofiles.open(f"/tmp/extruder/{job_id}.scad", "w")
  await scad_file.write(scad_script)
  await scad_file.close()

  LOG.info("running colorscad")
  process = await asyncio.subprocess.create_subprocess_shell(
    f"colorscad -o /tmp/extruder/{job_id}.3mf -i /tmp/extruder/{job_id}.scad -v -j 8 -- --backend manifold", stderr=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE
  )

  while True:
    line = await process.stdout.readline()
    if not line:
      break
    line_str = line.decode().strip()
    LOG.info(f"colorscad: {line_str}")

  returncode = await process.wait()
  if returncode != 0:
    LOG.info((await process.stderr.read()).decode())
    raise ValueError("ColorSCAD 3MF Failure!")

  f = await aiofiles.open(f"/tmp/extruder/{job_id}.3mf", "rb")
  threemf_data = await f.read()
  await f.close()

  # Now clean up
  await aiofiles.os.remove(f"/tmp/extruder/{job_id}.3mf")
  for stl in stls:
    await aiofiles.os.remove(stl)

  return threemf_data

async def png_to_3mf(
  png_data: bytes, z: float, x: float = 0, y: float = 0
) -> bytes:
  #images = separate_png(png_data)
  loop = asyncio.get_event_loop()
  with concurrent.futures.ThreadPoolExecutor() as pool:
    images = await loop.run_in_executor(pool, separate_png, png_data)
  return await generate_multicolour_part(images, z, x, y)

async def png_to_backed3mf(
  png_data: bytes, z: float, x: float = 0, y: float = 0, black_thickness: float = 0
) -> bytes:
  #images = separate_png(png_data)
  loop = asyncio.get_event_loop()
  with concurrent.futures.ThreadPoolExecutor() as pool:
    images = await loop.run_in_executor(pool, separate_png, png_data, True)
  return await generate_backed_multicolour_part(images, z, x, y, black_thickness)