from __future__ import annotations

from typing import TYPE_CHECKING
import numpy
from PIL import Image
from io import BytesIO

if TYPE_CHECKING:
  pass

def get_palette(layers: int = 5) -> list[int]:
  return numpy.linspace(0, 255, layers, dtype=int).tolist()

def find_closest_match(shade: int, palette: list[int]) -> int:
  np_array = numpy.asarray(palette)
  index = (numpy.abs(np_array - shade)).argmin()
  return int(np_array[index])

def quantize_image(png_data: bytes, layers: int = 5) -> list[list[int]]:
  "Take an image, and return a 2D list of greyscale values"
  palette = get_palette(layers)

  bio = BytesIO(png_data)
  image = Image.open(bio)
  greyscale = image.convert("RGB").convert("L")
  np_array = numpy.array(greyscale)
  # The array should be completely greyscale, so it will be fine to use only the R channel.
  output_data: list[list[int]] = []

  for column in np_array:
    output_column = []
    for pixel in column:
      quantized = find_closest_match(pixel[0], palette)
      output_column.append(quantized)
    output_data.append(output_column)

  return output_data