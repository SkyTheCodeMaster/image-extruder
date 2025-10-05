import asyncio
import concurrent.futures
import io
import logging

import aiofiles
import aiofiles.os
from PIL import Image

from utils.extruder import png_to_stl
from utils.multicolor_extruder import (generate_backed_multicolour_part,
                                       generate_openscad_script_heights,
                                       make_id, separate_png)

LOG = logging.getLogger(__name__)

PATH_TO_OPENSCAD = "/bin/OpenSCAD-2021.01-x86_64.AppImage"


async def generate_stacked_multicolour_part(
  images: list[dict[str, int | dict]], x: float = 0, y: float = 0
) -> bytes:
  "Take multiple images by hex colour, ."
  coloured_stls: dict[float, dict[str, bytes]] = {}
  # based off of the center of each image
  sizes: dict[float, dict[str, dict[str, int]]] = {}
  # Convert each image to an STL
  for num, layer in enumerate(images):
    z = layer["height"]
    if num > 0:
      offset_z = z - images[num - 1]["height"]
    if z not in coloured_stls:
      coloured_stls[z] = {}
    for colour, image in layer["pngs"].items():
      LOG.info(f"getting data for {colour} channel")
      try:
        coloured_stls[num][colour] = await png_to_stl(
          image,
          z,
          x,
          y,
          size_based_on_total_image_size=True,
          error_empty_svg=True,
        )
      except ValueError:
        coloured_stls[num][colour] = "SKIPPED"
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

      height_dpmm = height / y
      width_dpmm = width / x

      offset_x = -(((width / 2) - center_x) / width_dpmm)
      offset_y = ((height / 2) - center_y) / height_dpmm
      if num in sizes:
        sizes[num][colour] = {
          "left": left,
          "right": right,
          "top": top,
          "bottom": bottom,
          "cx": center_x,
          "cy": center_y,
          "ox": offset_x,
          "oy": offset_y,
          "oz": offset_z,
          "height": z,
          "area": area,
        }
      else:
        sizes[num] = {
          colour: {
            "left": left,
            "right": right,
            "top": top,
            "bottom": bottom,
            "cx": center_x,
            "cy": center_y,
            "ox": offset_x,
            "oy": offset_y,
            "oz": offset_z,
            "height": z,
            "area": area,
          }
        }

  job_id = make_id()

  # write each STL to a file for orcaslicer to import
  stls: list[str] = []
  models: list[dict[str, int | str]] = []
  for num, colstl in coloured_stls.items():
    for colour, stl in colstl.items():
      if stl == "SKIPPED":
        continue
      height = sizes[num][colour]["height"]
      # if colour in ["background","black"]:
      #  continue # Merge these into one object
      LOG.info(f"extruding {colour}")
      f = await aiofiles.open(f"/tmp/extruder/{job_id}_{colour}.stl", "wb")
      await f.write(stl)
      await f.close()
      stls.append(f"/tmp/extruder/{job_id}_{colour}.stl")
      # translations are based off of the center of the part
      # The bottom of the coloured parts are at `-(z/2)`
      # The middle of the black parts are `black_thickness/2`
      # To move them down the correct distance, we must do black_thickness+z
      models.append(
        {
          "colour": colour,
          "filepath": f"/tmp/extruder/{job_id}_{colour}.stl",
          "offset_x": sizes[num][colour]["ox"],
          "offset_y": sizes[num][colour]["oy"],
          "offset_z": sizes[num][colour]["oz"],
          "area": sizes[colour]["area"],
          "thickness": height,
          "id": make_id(),
        }
      )

  LOG.info("generating openscad script")
  scad_script = generate_openscad_script_heights(models)
  scad_file = await aiofiles.open(f"/tmp/extruder/{job_id}.scad", "w")
  await scad_file.write(scad_script)
  await scad_file.close()

  LOG.info("running colorscad")
  process = await asyncio.subprocess.create_subprocess_shell(
    f"colorscad -o /tmp/extruder/{job_id}.3mf -i /tmp/extruder/{job_id}.scad -v -j 8 -- --backend manifold",
    stderr=asyncio.subprocess.PIPE,
    stdout=asyncio.subprocess.PIPE,
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


async def pngs_to_stacked3mf(
  png_data: list[bytes],
  z: float,
  x: float = 0,
  y: float = 0,
  black_thickness: float = 0,
) -> bytes:
  loop = asyncio.get_event_loop()
  layers = []
  with concurrent.futures.ThreadPoolExecutor() as pool:
    for image in png_data:
      layers.append(
        await loop.run_in_executor(pool, separate_png, png_data, False)
      )
  return await generate_backed_multicolour_part(
    layers, z, x, y, black_thickness
  )
