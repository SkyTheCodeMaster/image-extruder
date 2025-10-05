import asyncio
import random
import string
import logging
from io import BytesIO

import aiofiles
import aiofiles.os
from PIL import Image

from utils.svg3 import png_to_svg

LOG = logging.getLogger(__name__)

#SCAD_SCRIPT_TEMPLATE = """
#module extrude_png(file, height) {{
#  linear_extrude(height = height) {{
#    import(file = file);
#  }}
#}}
#extrude_png("{input}", height={height});
#"""

SCAD_SCRIPT_TEMPLATE = """
// Import the SVG file
module import_image(file_name) {{
  import(file = file_name, center = true);
}}

// Extrude the imported image to the desired thickness
thickness = {height}; // Adjust this value as needed
convexity = 50; // Increase if you encounter issues with complex shapes

resize([{x},{y},0])
  linear_extrude(height = thickness, convexity = convexity, center = true, $fn=1024) {{
  import_image("{image}");
}}"""


def make_job_id() -> str:
  pool: str = string.ascii_letters + string.digits
  return "".join(random.choices(pool, k=16))


async def png_to_stl(png: bytes, z: float, x: float = 0, y: float = 0, *, size_based_on_total_image_size: bool = False, error_empty_svg: bool = False) -> bytes:
  job_id: str = make_job_id()

  await aiofiles.os.makedirs("/tmp/extruder/", exist_ok=True)

  # convert to svg
  svg = await png_to_svg(png)

  if "path" not in svg and error_empty_svg:
    raise ValueError("SVG was empty!")

  async with aiofiles.open(f"/tmp/extruder/{job_id}.svg", "w") as f:
    await f.write(svg)

  if not size_based_on_total_image_size:
    x=x
    y=y
  else:
    # Get the actual height of the object comapred to the canvas in pixels, versus just the height of the object
    png_buffer = BytesIO(png)
    img = Image.open(png_buffer)
    img.convert("L")
    width, height = img.size
    top = height
    bottom = 0
    left = width
    right = 0

    pixels = img.load()

    for image_y in range(height):
      for image_x in range(width):
        r, g, b, a = pixels[image_x, image_y]
        if r*g*b != 255*255*255:
          # This pixel is something other than white, mark it.
          if image_y > bottom:
            bottom = image_y
          if image_x > right:
            right = image_x
          if image_y < top:
            top = image_y
          if image_x < left:
            left = image_x
    
    # Now use the numbers to calculate the total size
    total_image_height = height - top - (height - bottom)
    total_image_width = width - left - (width - right)

    x_scalar = total_image_width / width
    y_scalar = total_image_height / height
    x = x * x_scalar
    y = y * y_scalar

  scad_script = SCAD_SCRIPT_TEMPLATE.format(
    image=f"/tmp/extruder/{job_id}.svg", height=str(z), x=x, y=y
  )
  async with aiofiles.open(f"/tmp/extruder/{job_id}.scad", "w") as f:
    await f.write(scad_script)

  proc = await asyncio.subprocess.create_subprocess_shell(
    f"OpenSCAD-2021.01-x86_64.AppImage -o /tmp/extruder/{job_id}.stl /tmp/extruder/{job_id}.scad", stderr=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE
  )
  returncode = await proc.wait()
  if returncode == 0:
    async with aiofiles.open(f"/tmp/extruder/{job_id}.stl", "rb") as f:
      stl_bytes = await f.read()

    try:
      await aiofiles.os.remove(f"/tmp/extruder/{job_id}.scad")
      await aiofiles.os.remove(f"/tmp/extruder/{job_id}.stl")
      await aiofiles.os.remove(f"/tmp/extruder/{job_id}.svg")
    except Exception:
      # Even if it fails, /tmp/ gets cleared every so often.
      pass

    return stl_bytes
  else:
    LOG.error((await proc.stdout.read()).decode())
    LOG.error((await proc.stderr.read()).decode())
    raise RuntimeError("openscad failure")
