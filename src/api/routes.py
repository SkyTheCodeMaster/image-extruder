from __future__ import annotations

import asyncio
import tomllib
from typing import TYPE_CHECKING

from aiohttp import web
from aiohttp.web import Response

from utils import jobs
from utils.cors import add_cors_routes
from utils.extruder import png_to_stl
from utils.limiter import Limiter
from utils.multicolor_extruder import (identify_colours, png_to_3mf,
                                       png_to_backed3mf)
from utils.svg3 import png_to_svg

if TYPE_CHECKING:
  from utils.extra_request import Request

with open("config.toml") as f:
  config = tomllib.loads(f.read())
  frontend_version = config["pages"]["frontend_version"]
  exempt_ips = config["srv"]["ratelimit_exempt"]
  api_version = config["srv"]["api_version"]

limiter = Limiter(exempt_ips=exempt_ips)
routes = web.RouteTableDef()

@routes.get("/srv/get/")
@limiter.limit("60/m")
async def get_srv_get(request: Request) -> Response:
  packet = {
    "frontend_version": frontend_version,
    "api_version": api_version,
  }

  return web.json_response(packet)


@routes.post("/extrude/")
@limiter.limit("10/m")
async def post_extrude(request: Request) -> Response:
  x = float(request.query.get("x", 0))
  y = float(request.query.get("y", 0))
  z = float(request.query.get("z", 6.35))
  filename = request.query.get("filename", "extruded.png")
  filename = ".".join(filename.split(".")[:-1])
  png_data = await request.read()

  stl_data = await png_to_stl(png_data, z, x, y)
  resp: web.StreamResponse = web.StreamResponse()
  resp.headers["Content-Type"] = "model/stl"
  resp.headers["Content-Disposition"] = f"attachment; filename*={filename}.stl"
  await resp.prepare(request)
  await resp.write(stl_data)
  return resp


@routes.post("/svg/")
@limiter.limit("60/m")
async def post_svg(request: Request) -> Response:
  filename = request.query.get("filename", "converted.svg")
  filename = ".".join(filename.split(".")[:-1])
  png_data = await request.read()

  svg_data = await png_to_svg(png_data)
  resp: web.StreamResponse = web.StreamResponse()
  resp.headers["Content-Type"] = "image/svg+xml"
  resp.headers["Content-Disposition"] = f"attachment; filename*={filename}.svg"
  await resp.prepare(request)
  await resp.write(svg_data.encode())
  return resp


@routes.post("/3mf/")
@limiter.limit("10/m")
async def post_3mf(request: Request) -> Response:
  x = float(request.query.get("x", 0))
  y = float(request.query.get("y", 0))
  z = float(request.query.get("z", 6.35))
  filename = request.query.get("filename", "extruded.png")
  filename = ".".join(filename.split(".")[:-1])
  png_data = await request.read()

  threemf_data = await png_to_3mf(png_data, z, x, y)
  resp: web.StreamResponse = web.StreamResponse()
  resp.headers["Content-Type"] = "model/3mf"
  resp.headers["Content-Disposition"] = f"attachment; filename*={filename}.3mf"
  await resp.prepare(request)
  await resp.write(threemf_data)
  return resp


@routes.post("/backed3mf/")
@limiter.limit("10/m")
async def post_backed3mf(request: Request) -> Response:
  x = float(request.query.get("x", 0))
  y = float(request.query.get("y", 0))
  z = float(request.query.get("z", 6.35))
  black_thickness = float(request.query.get("blackthickness", 0))
  filename = request.query.get("filename", "extruded.png")
  filename = ".".join(filename.split(".")[:-1])
  png_data = await request.read()

  threemf_data = await png_to_backed3mf(png_data, z, x, y, black_thickness)
  resp: web.StreamResponse = web.StreamResponse()
  resp.headers["Content-Type"] = "model/3mf"
  resp.headers["Content-Disposition"] = f"attachment; filename*={filename}.3mf"
  await resp.prepare(request)
  await resp.write(threemf_data)
  return resp


@routes.post("/colouridentify/")
@limiter.limit("10/m")
async def post_colouridentify(request: Request) -> Response:
  png_data = await request.read()

  hex_colours = identify_colours(png_data)
  return web.json_response(hex_colours)


@routes.post("/job/submit/")
async def post_submit(request: Request) -> Response:
  data = await request.json()
  await jobs.submit_job(data)
  return Response()

@routes.get("/job/current/")
async def get_job_current(request: Request) -> Response:
  return web.json_response(jobs.get_current_jobs())

@routes.get("/job/complete/")
async def get_job_complete(request: Request) -> Response:
  return web.json_response(jobs.get_completed_jobs())

@routes.get("/job/workers/")
async def get_job_workers(request: Request) -> Response:
  return web.json_response(jobs.get_worker_status())

@routes.get("/job/download/")
async def get_job_download(request: Request) -> Response:
  job_id = request.query.get("id", None)
  if job_id is None:
    return Response(status=400,body="must pass id")
  details = jobs.complete_job(job_id)
  if not details["ok"]:
    return web.json_response(details, status=500)
  else:
    filename = details["filename"]
    file = details["file"]
    filetype = ".".join(filename.split(".")[-1])
    resp: web.StreamResponse = web.StreamResponse()
    if filetype == "svg":
      resp.headers["Content-Type"] = "image/svg"
    else:
      resp.headers["Content-Type"] = f"model/{filetype}"
    resp.headers["Content-Disposition"] = f"attachment; filename*={filename}"
    await resp.prepare(request)
    if type(file) is str:
      await resp.write(file.encode())
    else:
      await resp.write(file)
    return resp

@routes.post("/job/config/")
async def post_job_config(request: Request) -> Response:
  data = await request.json()
  jobs.worker_count_config["max"] = data["max"]
  jobs.worker_count_config["min"] = data["min"]
  jobs.worker_count_config["ratio"] = data["ratio"]
  return Response()

async def setup(app: web.Application) -> None:
  for route in routes:
    app.LOG.info(f"  ↳ {route}")
  app.add_routes(routes)
  add_cors_routes(routes, app)
  app.LOG.info("starting worker scaler")
  loop = asyncio.get_event_loop()
  loop.create_task(jobs.scale_workers())