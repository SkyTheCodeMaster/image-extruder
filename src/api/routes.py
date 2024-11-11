from __future__ import annotations

import tomllib
from typing import TYPE_CHECKING

from aiohttp import web
from aiohttp.web import Response

from utils.cors import add_cors_routes
from utils.limiter import Limiter
from utils.extruder import png_to_stl
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

async def setup(app: web.Application) -> None:
  for route in routes:
    app.LOG.info(f"  ↳ {route}")
  app.add_routes(routes)
  add_cors_routes(routes, app)