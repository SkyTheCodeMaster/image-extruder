import cv2
import numpy
import math


def close_vertices(contour, max_distance=5):
  """
  Close vertices that are close together.

  Args:
  contour (numpy.ndarray): Inumpyut contour
  max_distance (int): Maximum distance between vertices to consider them close

  Returns:
  numpy.ndarray: Modified contour with closed vertices
  """
  result = []
  for i in range(len(contour)):
    p1 = contour[i]
    p2 = contour[(i + 1) % len(contour)]

    dist = numpy.linalg.norm(p1 - p2)
    if dist > max_distance:
      result.append(p1)
    else:
      midpoint = (p1 + p2) // 2
      result.append(midpoint)

  return numpy.array(result)

def get_distance(x1: float,y1: float,x2: float,y2: float) -> float:
  return math.sqrt(((x2-x1)**2) + ((y2-y1)**2))

def create_polyline(start_x: int, start_y: int, end_x: int, end_y: int, points: int) -> list[tuple[int,int]]:
  x_values = numpy.linspace(start_x, end_x, points)
  y_values = numpy.linspace(start_y, end_y, points)

  merged_points = numpy.column_stack((x_values, y_values))

  return [tuple(row) for row in merged_points.tolist()]


def find_close_ends(
  polylines: list[list[tuple[int, int]]], max_distance: float = 5.0, resolution: int = 2
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



def png_to_svg(png_data: bytes) -> str:
  """
  Convert PNG image to SVG using OpenCV.

  Args:
  image_path (str): Path to inumpyut PNG image
  output_path (str): Path to output SVG file
  """
  # Read the image
  image = cv2.imdecode(
    numpy.frombuffer(png_data, dtype=numpy.uint8), cv2.IMREAD_COLOR
  )

  # Convert to grayscale
  grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

  # Apply Gaussian blur
  #blurred = cv2.GaussianBlur(gray, (11, 11), 0)

  # Perform edge detection
  #edges = cv2.Canny(blurred, 50, 150)
  edges = cv2.Sobel(grey, cv2.CV_8UC1, 1, 1)

  # Apply morphological operations to clean up edges
  #kernel = numpy.ones((5, 5), numpy.uint8)
  #edges = cv2.morphologyEx(edges, cv2.MORPH_TOPHAT, kernel, iterations=10)

  # Find contours
  contours, _ = cv2.findContours(
    edges, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1
  )

  # Create SVG file
  width, height = image.shape[1], image.shape[0]
  svg_style = " style=\"fill:none;stroke:black;stroke-width:1\""
  svg_output = f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">\n'

  polylines = []

  for contour in contours:
    # Approximate the contour
    epsilon = 0.01 * cv2.arcLength(contour, True)
    approx_contour = cv2.approxPolyDP(contour, epsilon, True)

    # Close vertices
    closed_contour = close_vertices(approx_contour[:, 0])

    # Write polyline to SVG
    polyline = []
    for x, y in closed_contour:
      polyline.append((x, y))
    polylines.append(polyline)

    # svg_output += '<polyline points="'
    # for x, y in closed_contour:
    #  svg_output += f"{x},{y} "
    # svg_output += '" style="fill:none;stroke:black;stroke-width:1" />\n'

  # Find polylines that have close ends
  closed_polylines = find_close_ends(polylines, 5)
  for polyline in closed_polylines:
    svg_output += "  <polyline points=\""
    for x,y in polyline:
      svg_output += f"{x},{y} "
    svg_output += f"\" {svg_style} />\n"

  svg_output += "</svg>\n"

  return svg_output
