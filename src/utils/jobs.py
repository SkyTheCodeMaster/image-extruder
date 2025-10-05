from __future__ import annotations

import base64
import logging
import random
import string
import asyncio
from asyncio import Queue
from typing import TYPE_CHECKING

from utils.extruder import png_to_stl
from utils.multicolor_extruder import (
  png_to_3mf,
  png_to_backed3mf,
)
from utils.svg3 import png_to_svg

if TYPE_CHECKING:
  from typing import Awaitable, Callable


LOG = logging.getLogger(__name__)


def make_job_id() -> str:
  pool: str = string.ascii_letters + string.digits
  job_id = "".join(random.choices(pool, k=16))
  if job_id in jobs_done:
    return make_job_id()
  return job_id


job_queue = Queue()
jobs_done: dict[str, bytes] = {}
last_worker_id: int = 0

# {
#   "task": asyncio.Task
#   "status": "idle" or "processing filename"
#   "living": True
# }
workers: dict[int, dict[str, asyncio.Task|str]] = {}

async def submit_job(job_details: dict) -> None:
  await job_queue.put(job_details)

def get_current_jobs() -> list[dict]:
  "Peek the currently processing jobs"
  output = []
  for elem in job_queue._queue:
    output.append(elem["meta"]["filename"])
  return output

def get_worker_status() -> dict[int, str]:
  output = {}
  for id,stats in workers.items():
    if stats["living"]:
      output[id] = stats["status"]
  return output

def get_completed_jobs() -> dict:
  "Get a list of complete jobs"
  output = {}
  for k,v in jobs_done.items():
    if not v["ok"]:
      # If it wasnt successful, we will have error instead of filename
      output[k] = {"ok": v["ok"], "error": v["error"], "filename": v["filename"]}
    else:
      output[k] = {"ok": v["ok"], "filename": v["filename"]}
  return output

def complete_job(job_id: str) -> dict:
  "Retrive a job, and remove it from the list of completed jobs"
  if job_id not in jobs_done:
    return {
      "ok": False,
      "error": "job does not exist"
    }
  return jobs_done.pop(job_id)

def details_checker(
  details: dict, processor: str, meta_keys: list[str] = None
) -> dict:
  try:
    filename = details["meta"]["filename"]
  except Exception:
    filename = "Missing"
  if details["type"] != processor:
    return {"ok": False, "error": f"job type is not '{processor}'", "filename": filename}
  if "meta" not in details:
    return {"ok": False, "error": "'meta' key missing", "filename": filename}
  if "filename" not in details["meta"]:
    return {"ok": False, "error": "'meta/filename' key missing", "filename": filename}
  if "files" not in details:
    return {"ok": False, "error": "'files' key missing", "filename": filename}
  if not details["files"]:
    return {"ok": False, "error": "'files' key empty", "filename": filename}

  if meta_keys:
    for meta_key in meta_keys:
      if meta_key not in details["meta"]:
        return {"ok": False, "error": f"'meta/{meta_key}' key missing", "filename": filename}

  return {"ok": True}


def decode_files(files: list[str]) -> list[bytes]:
  output = []
  for file in files:
    output.append(base64.b64decode(file))
  return output


async def job_png_to_svg(details: dict) -> dict:
  "Turn a PNG into an SVG"
  # Verify the details are as expected
  verify = details_checker(details, "svg")
  if not verify["ok"]:
    LOG.error("png->svg: failed details checker")
    return verify

  decoded = decode_files(details["files"])

  try:
    svg_data = await png_to_svg(decoded[0])
    return {"ok": True, "file": svg_data, "filename": details["meta"]["filename"]}
  except Exception as e:
    LOG.exception("png->svg: exception while converting")
    return {"ok": False, "error": str(e), "filename": details["meta"]["filename"]}


async def job_png_to_stl(details: dict) -> dict:
  "Turn a PNG into an STL"
  verify = details_checker(details, "stl", ["x", "y", "z"])
  if not verify["ok"]:
    LOG.error("png->stl: failed details checker")
    return verify

  decoded = decode_files(details["files"])
  x = details["meta"]["x"]
  y = details["meta"]["y"]
  z = details["meta"]["z"]
  try:
    stl_data = await png_to_stl(decoded[0], z, x, y)
    return {"ok": True, "file": stl_data, "filename": details["meta"]["filename"]}
  except Exception as e:
    LOG.exception("png->stl: exception while converting")
    return {"ok": False, "error": str(e), "filename": details["meta"]["filename"]}


async def job_png_to_3mf(details: dict) -> dict:
  "Turn a PNG into a 3MF"
  verify = details_checker(details, "3mf", ["x", "y", "z"])
  if not verify["ok"]:
    LOG.error("png->3mf: failed details checker")
    return verify

  decoded = decode_files(details["files"])
  x = details["meta"]["x"]
  y = details["meta"]["y"]
  z = details["meta"]["z"]
  try:
    tmf_data = await png_to_3mf(decoded[0], z, x, y)
    return {"ok": True, "file": tmf_data, "filename": details["meta"]["filename"]}
  except Exception as e:
    LOG.exception("png->3mf: exception while converting")
    return {"ok": False, "error": str(e), "filename": details["meta"]["filename"]}


async def job_png_to_backed_3mf(details: dict) -> dict:
  "Turn a PNG into a backed 3mf"
  verify = details_checker(details, "backed_3mf", ["x", "y", "z", "black_thickness"])
  if not verify["ok"]:
    LOG.error("png->b3mf: failed details checker")
    return verify

  decoded = decode_files(details["files"])
  x = details["meta"]["x"]
  y = details["meta"]["y"]
  z = details["meta"]["z"]
  black_thickness = details["meta"]["black_thickness"]
  try:
    tmf_data = await png_to_backed3mf(decoded[0], z, x, y, black_thickness)
    return {"ok": True, "file": tmf_data, "filename": details["meta"]["filename"]}
  except Exception as e:
    LOG.exception("png->b3mf: exception while converting")
    return {"ok": False, "error": str(e), "filename": details["meta"]["filename"]}


async def job_stacked_pngs_to_multicolour_3mf(details: dict) -> dict:
  "Stack PNGs into a 3MF"
  pass


converters: dict[str, Callable[[dict, None], Awaitable[dict]]] = {
  "svg": job_png_to_svg,
  "stl": job_png_to_stl,
  "3mf": job_png_to_3mf,
  "backed_3mf": job_png_to_backed_3mf,
  "stacked_3mf": job_stacked_pngs_to_multicolour_3mf
}


async def job_consumer(worker_id: int):
  while workers[worker_id]["living"]:
    workers[worker_id]["status"] = "idle"
    job = await job_queue.get()
    job_id = make_job_id()
    LOG.info(f"Worker/#{worker_id}/{job_id}: begin processing")
    if job["type"] not in converters:
      jobs_done[job_id] = {
        "ok": False,
        "error": "type is not a valid converter"
      }
      LOG.error(f"Worker/#{worker_id}/{job_id}: type {job['type']} is not valid")
    else:
      converter = converters[job["type"]]
      try:
        workers[worker_id]["status"] = f"{job['type']} / {job["meta"]["filename"]}"
      except Exception:
        workers[worker_id]["status"] = f"{job['type']} / unknown filename"
      result = await converter(job)
      jobs_done[job_id] = result
    job_queue.task_done()
    LOG.info(f"Worker/#{worker_id}: return to idle")
    workers[worker_id]["status"] = "idle"

async def spawn_worker() -> None:
  global last_worker_id
  worker_id = last_worker_id
  last_worker_id += 1

  workers[worker_id] = {
    "living": True
  }
  loop = asyncio.get_event_loop()
  task = loop.create_task(job_consumer(worker_id))
  workers[worker_id]["task"] = task

async def kill_worker(worker_id: int) -> None:
  if worker_id not in workers:
    return
  workers[worker_id]["living"] = False


worker_count_config = {
  "max": 4,
  "min": 1,
  "ratio": 2
}
MAX_WORKERS = 4
MIN_WORKERS = 1
WORKER_RATIO = 2 # Number of jobs per worker, so if there are 6 jobs, 3 workers should be living

async def scale_workers() -> None:
  "Spawn or kill workers in accordance to the queue"
  while True:
    # First, check if any workers are dead
    dead_workers = []
    for id,worker in workers.items():
      if not worker["living"] and worker["status"] == "idle":
        worker["task"].cancel()
        dead_workers.append(id)
    for id in dead_workers:
      workers[id] = None
    
    # Now check the current queue size
    qsize = job_queue.qsize()
    num_workers = len(workers.keys())
    if num_workers < worker_count_config["min"]:
      to_spawn = worker_count_config["min"]-num_workers
      for _ in range(to_spawn):
        await spawn_worker()
    if num_workers > worker_count_config["max"]:
      to_kill = num_workers-worker_count_config["max"]
      for _ in range(to_kill):
        last_worker = workers.keys()[-1]
        await kill_worker(last_worker)
    
    ideal_worker_count = min(round(qsize / worker_count_config["ratio"]), worker_count_config["max"])
    if num_workers < ideal_worker_count:
      # We have less workers than we want, spawn some
      to_spawn = ideal_worker_count-num_workers
      for _ in range(to_spawn):
        await spawn_worker()
    # If we have more workers than we want, then it is no big deal.
    await asyncio.sleep(30)