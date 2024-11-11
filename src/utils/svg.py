import io
import math

import cv2
import numpy
from PIL import Image

# A structure representing an SVG polyline
Polyline = list[tuple[int, int]]

def get_distance(x1: float,y1: float,x2: float,y2: float) -> float:
  return math.sqrt(((x2-x1)**2) + ((y2-y1)**2))

def create_polyline(start_x: int, start_y: int, end_x: int, end_y: int, points: int) -> list[tuple[int,int]]:
  x_values = numpy.linspace(start_x, end_x, points)
  y_values = numpy.linspace(start_y, end_y, points)

  merged_points = numpy.column_stack((x_values, y_values))

  return [tuple(row) for row in merged_points.tolist()]


def find_close_ends(
  polylines: list[Polyline], max_distance: float = 5.0, resolution: int = 2
) -> list[list[tuple[int, int]]]:
  """
  Find close ends of polylines.

  Finds distance between ends of polylines using simple search, O(2n^2)

  If the distance between the start and end are less than max_distance, it creates a new polyline connecting them.
  
  The resolution argument is how many points the joining polyline consists of."""

  output_polylines = []

  for i,src_polyline in enumerate(polylines):
    output_polylines.append(src_polyline)
    src_start = src_polyline[0]
    src_end = src_polyline[-1]

    for o,dst_polyline in enumerate(polylines):
      if o == i:
        continue
      dst_start = dst_polyline[0]
      dst_end = dst_polyline[-1]

      # Check the distances
      start_start_distance = get_distance(*src_start, *dst_start)
      start_end_distance = get_distance(*src_start, *dst_end)
      end_start_distance = get_distance(*src_end, *dst_start)
      end_end_distance = get_distance(*src_end, *dst_end)

      if start_start_distance <= max_distance:
        output_polylines.append(create_polyline(*src_start, *dst_start, resolution))

      if start_end_distance <= max_distance:
        output_polylines.append(create_polyline(*src_start, *dst_end, resolution))

      if end_start_distance <= max_distance:
        output_polylines.append(create_polyline(*src_end, *dst_start, resolution))

      if end_end_distance <= max_distance:
        output_polylines.append(create_polyline(*src_end, *dst_end, resolution))

  return output_polylines

def get_path_length(path: Polyline) -> float:
  length: float = 0
  for i,point in enumerate(path):
    if i == 0:
      continue
    length += get_distance(*path[i-1],*point)
  return length

def path_similarity(a: Polyline, b: Polyline) -> float:
  node_count_weight = 0.25 # The closer the paths are in length, the higher this is.
  length_weight = 0.25 # The closer the paths are in length, the higher this is.
  point_similarity_weight = 0.5 # The smaller the distance between points, the higher this is.

  max_count_diff = 15 # If it's above this, the count_weight is 0
  max_length_diff = 100 # If it's above this, the length_weight is 0
  max_similarity_diff = 200

  a_count = len(a)
  b_count = len(b)

  a_length: float = get_path_length(a)
  b_length: float = get_path_length(b)

  similarity_sum: float = 0
  similarity_count: int = 0
  for a_node, b_node in zip(a, b):
    similarity_sum += get_distance(*a_node, *b_node)
    similarity_count += 1

  similarity = similarity_sum / similarity_count

  result_count = (1-(abs((a_count-b_count)/max_count_diff))) * node_count_weight
  result_length = (1-(abs((a_length-b_length)/max_length_diff))) * length_weight
  result_similarity = (1-(similarity/max_similarity_diff)) * point_similarity_weight

  return sum([result_count, result_length, result_similarity])

def get_path_area(path: list[tuple[int, int]]) -> float:
  n = len(path)
  area: float = 0

  for i in range(n):
    j = (i + 1) % n
    area += path[i][0] * path[j][1]
    area -= path[j][0] * path[i][1]

  return abs(area) / 2

def png_to_svg(png_data: bytes) -> str:
  b = io.BytesIO(png_data)
  img = Image.open(b).convert("RGB")
  grey_img = img.convert("L")

  edges = numpy.array(grey_img)  # .astype(numpy.uint32)
  edges = cv2.Canny(edges, 50, 150)

  contours, _ = cv2.findContours(edges, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_KCOS)
  svg_style = " style=\"fill:none;stroke:black;stroke-width:1\""
  svg_content = f'<svg width="{img.width}" height="{img.height}" xmlns="http://www.w3.org/2000/svg">'

  polylines = []

  for contour in contours:
    polyline = []
    for i in range(len(contour)):
      x, y = contour[i][0]
      polyline.append((x, y))
    polylines.append(polyline)

  # Remove similar paths
  for polyline in polylines.copy():
    removed = False
    for checkline in polylines:
      if polyline == checkline or removed:
        continue
      if path_similarity(polyline, checkline) > 0.9:
        polylines.remove(polyline)
        removed = True


  for polyline in polylines:
    svg_content += "  <polyline points=\""
    for x,y in polyline:
      svg_content += f"{x},{y} "
    svg_content += f"\" {svg_style} />\n"

  svg_content += "</svg>"

  return svg_content
