from __future__ import annotations

from typing import TYPE_CHECKING

import numpy
from PIL import Image
from svg3 import png_to_svg  # svg3 kernel is the best currently

if TYPE_CHECKING:
  pass

# Recommended steps to create a 3D bitmap for greyscaler:
# 1) Quantize the PNG into a 2D array of values
# 2) Convert it to Bitmap3D
# 3) Check each layer for small islands, optionally remove them. (for layer in bitmap3d: identify_small_islands(layer, 10, True))
# 4) Regenerate supports in case the island remover broke it
# 5) Convert each layer back into a PNG
# 6) Trace each layer into an SVG
# 7) Generate openscad script to assemble the entire thing into a single STL

# A couple of helper functions for dealing with (and fixing) greyscale bitmaps
type Bitmap = list[list[int]]
type Bitmap3D = list[Bitmap]


def turn_bitmap_3d(bitmap: Bitmap) -> Bitmap3D:
  "Convert a bitmap into a 3D representation of each layer."
  # First, identify the number of layers.
  layers = set()
  for column in bitmap:
    for pixel in column:
      layers.add(pixel)
  layer_list = list(layers)
  layer_list.sort(reverse=True)

  num_layers = len(layers)
  layer_lookup = {}

  for i, layer in enumerate(layer_list):
    layer_lookup[layer] = i

  output_data = []
  for _ in range(num_layers):
    columns = []
    for bitmap_column in bitmap:
      columns.append([0 for __ in range(bitmap_column)])
    output_data.append(columns)

  for y, column in enumerate(bitmap):
    for x, pixel in enumerate(column):
      pixel_layer = layer_lookup[pixel]
      for i in range(pixel_layer):
        output_data[i][y][x] = 1

  return output_data


# Return the updated bitmap, and a log
def identify_small_islands(
  bitmap: Bitmap, area_threshold: int = 10, remove: bool = False
) -> tuple[Bitmap, str]:
  already_checked: list[tuple[int, int]] = []

  def get_island_size(x: int, y: int) -> int:
    size = 0
    if (y, x) in already_checked:
      return 0
    if bitmap[y][x] == 0:
      return 0
    else:
      size += 1
      already_checked.append(
        (
          y,
          x,
        )
      )

    if x - 1 >= 0:
      size += get_island_size(x - 1, y)
    if x + 1 <= len(bitmap[y]):
      size += get_island_size(x + 1, y)
    if y - 1 >= 0:
      size += get_island_size(x, y - 1)
    if y + 1 <= len(bitmap):
      size += get_island_size(x, y + 1)

    return size

  def remove_island(x: int, y: int, removed: list = None) -> None:
    if removed is None:
      removed = []

    # We've already processed this.
    if (y, x) in removed:
      return
    # This is an empty area (Outer edge of island)
    if bitmap[y][x] == 0:
      return
    # This is a spot we should remove.
    else:
      bitmap[y][x] = 0
      removed.append(
        (
          y,
          x,
        )
      )

    if x - 1 >= 0:
      remove_island(x - 1, y, removed)
    if x + 1 <= len(bitmap[y]):
      remove_island(x + 1, y, removed)
    if y - 1 >= 0:
      remove_island(x, y - 1, removed)
    if y + 1 <= len(bitmap):
      remove_island(x, y + 1, removed)

  islands: dict[tuple[int, int], int] = {}

  log = ""
  for y, row in enumerate(bitmap):
    for x, value in enumerate(row):
      island_size = get_island_size(x, y)
      if island_size != 0:
        islands[(y, x)] = island_size
        if remove and island_size <= area_threshold:
          remove_island(x, y)
          log += f"island of size {island_size} at {x},{y} was removed.\n"
        elif island_size <= area_threshold:
          # We're watching for small islands, but not removing them.
          log += f"island of size {island_size} at {x},{y} is below threshold {area_threshold}, but not removed.\n"

  return bitmap, log


def generate_supports(bitmap: Bitmap3D) -> Bitmap3D:
  for layer in range(len(bitmap), 0, -1):
    for y, row in enumerate(bitmap[layer]):
      for x, value in enumerate(row):
        if value == 1:
          bitmap[layer - 1][y][x] = 1
  return bitmap
