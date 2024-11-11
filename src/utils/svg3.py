import asyncio
import random
import string

import aiofiles
import aiofiles.os


def make_job_id() -> str:
  pool: str = string.ascii_letters + string.digits
  return "".join(random.choices(pool, k=16))


async def png_to_svg(png_data: bytes) -> str:
  job_id = make_job_id()

  await aiofiles.os.makedirs("/tmp/extruder/", exist_ok=True)

  async with aiofiles.open(f"/tmp/extruder/{job_id}.png", "wb") as f:
    await f.write(png_data)

  convert_proc = await asyncio.create_subprocess_shell(
    f"convert /tmp/extruder/{job_id}.png /tmp/extruder/{job_id}.pnm",
    stderr=asyncio.subprocess.PIPE,
    stdout=asyncio.subprocess.PIPE,
  )
  convert_code = await convert_proc.wait()

  if convert_code != 0:
    print((await convert_proc.stdout.read()).decode())
    print((await convert_proc.stderr.read()).decode())
    raise RuntimeError("convert failure")

  potrace_proc = await asyncio.create_subprocess_shell(
    f"potrace /tmp/extruder/{job_id}.pnm -s -o /tmp/extruder/{job_id}.svg",
    stderr=asyncio.subprocess.PIPE,
    stdout=asyncio.subprocess.PIPE,
  )

  potrace_code = await potrace_proc.wait()

  if potrace_code != 0:
    print((await potrace_proc.stdout.read()).decode())
    print((await potrace_proc.stderr.read()).decode())
    raise RuntimeError("potrace failure")

  async with aiofiles.open(f"/tmp/extruder/{job_id}.svg", "r") as f:
    svg_contents = await f.read()

  try:
    await aiofiles.os.remove(f"/tmp/extruder/{job_id}.png")
    await aiofiles.os.remove(f"/tmp/extruder/{job_id}.pnm")
    await aiofiles.os.remove(f"/tmp/extruder/{job_id}.svg")
  except Exception:
    pass

  return svg_contents