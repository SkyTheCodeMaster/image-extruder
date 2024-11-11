import asyncio
import random
import string

import aiofiles
import aiofiles.os

from utils.svg3 import png_to_svg

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


async def png_to_stl(png: bytes, z: float, x: float = 0, y: float = 0) -> bytes:
  job_id: str = make_job_id()

  await aiofiles.os.makedirs("/tmp/extruder/", exist_ok=True)

  # convert to svg
  svg = await png_to_svg(png)

  async with aiofiles.open(f"/tmp/extruder/{job_id}.svg", "w") as f:
    await f.write(svg)

  scad_script = SCAD_SCRIPT_TEMPLATE.format(
    image=f"/tmp/extruder/{job_id}.svg", height=str(z), x=x, y=y
  )
  async with aiofiles.open(f"/tmp/extruder/{job_id}.scad", "w") as f:
    await f.write(scad_script)

  proc = await asyncio.subprocess.create_subprocess_shell(
    f"openscad -o /tmp/extruder/{job_id}.stl /tmp/extruder/{job_id}.scad", stderr=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE
  )
  returncode = await proc.wait()
  if returncode == 0:
    async with aiofiles.open(f"/tmp/extruder/{job_id}.stl", "rb") as f:
      stl_bytes = await f.read()

    try:
      await aiofiles.os.remove(f"/tmp/extruder/{job_id}.png")
      await aiofiles.os.remove(f"/tmp/extruder/{job_id}.scad")
      await aiofiles.os.remove(f"/tmp/extruder/{job_id}.stl")
    except Exception:
      # Even if it fails, /tmp/ gets cleared every so often.
      pass

    return stl_bytes
  else:
    print((await proc.stdout.read()).decode())
    print((await proc.stderr.read()).decode())
    raise RuntimeError("openscad failure")
