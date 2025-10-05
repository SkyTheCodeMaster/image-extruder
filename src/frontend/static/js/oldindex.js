"use strict";

import { request, format_element_text } from "/js/libcommon.js";
import { show_popup } from "/js/libpopup.js"

function read_file_as_array_buffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function convert_to_stl() {
  const button_stl = document.getElementById("button_stl");

  button_stl.classList.add("is-loading");
  button_stl.setAttribute("disabled", true);

  // Read the file, grab the height, send it.
  const file_picker = document.getElementById("file_picker");
  let file = file_picker.files[0];
  if (!file) {
    show_popup("No file selected!", "is-danger", 1000);
    return;
  }
  let array_buffer = await read_file_as_array_buffer(file);
  let uint8_array = new Uint8Array(array_buffer);

  
  const input_x = document.getElementById("input_x");
  const input_y = document.getElementById("input_y");
  const input_z = document.getElementById("input_z");

  let x = input_x.value;
  let y = input_y.value;
  let z = input_z.value;

  let filename = file.name;
  format_element_text("file_name", filename);

  let response = await request(`/api/extrude/?filename=${filename}&x=${x}&y=${y}&z=${z}`, {
    "method": "POST",
    "body": uint8_array
  });

  if (response.status == 200) {
    show_popup("Successfully converted!");
    await download_response(response, "export.stl")
  } else {
    show_popup(`Failed to convert!\nHTTP${response.status}: Check log for details...`);
    console.error(`Failed to convert file!\n${await response.text()}`);
  }

  button_stl.classList.remove("is-loading");
  button_stl.removeAttribute("disabled");
}

async function convert_to_3mf() {
  const button_3mf = document.getElementById("button_3mf");

  button_3mf.classList.add("is-loading");
  button_3mf.setAttribute("disabled", true);

  // Read the file, grab the height, send it.
  const file_picker = document.getElementById("file_picker");
  let file = file_picker.files[0];
  if (!file) {
    show_popup("No file selected!", "is-danger", 1000);
    return;
  }
  let array_buffer = await read_file_as_array_buffer(file);
  let uint8_array = new Uint8Array(array_buffer);

  
  const input_x = document.getElementById("input_x");
  const input_y = document.getElementById("input_y");
  const input_z = document.getElementById("input_z");

  let x = input_x.value;
  let y = input_y.value;
  let z = input_z.value;

  let filename = file.name;
  format_element_text("file_name", filename);

  let response = await request(`/api/3mf/?filename=${filename}&x=${x}&y=${y}&z=${z}`, {
    "method": "POST",
    "body": uint8_array
  });

  if (response.status == 200) {
    show_popup("Successfully converted!");
    await download_response(response, "export.3mf")
  } else {
    show_popup(`Failed to convert!\nHTTP${response.status}: Check log for details...`);
    console.error(`Failed to convert file!\n${await response.text()}`);
  }

  button_3mf.classList.remove("is-loading");
  button_3mf.removeAttribute("disabled");
}

async function download_response(response, default_filename = "export.txt") {
  let blob = await response.blob();

  // Determine the filename
  let file_name = default_filename;
  let disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('attachment')) {
    const filename_regex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    let matches = filename_regex.exec(disposition);
    if (matches != null && matches[1]) {
      file_name = matches[1].replace(/['"]/g, '');
    }
  }

  // Create a downloadable link
  let url_object = window.URL.createObjectURL(blob);
  let link = document.createElement('a');
  link.href = url_object;
  link.download = file_name;

  // Append the link to the DOM and click it
  document.body.appendChild(link);
  link.click();

  // Clean up
  link.remove();
  window.URL.revokeObjectURL(url_object);
}

async function convert_to_svg() {
  const button_svg = document.getElementById("button_svg");

  button_svg.classList.add("is-loading");
  button_svg.setAttribute("disabled", true);

  // Read the file, grab the height, send it.
  const file_picker = document.getElementById("file_picker");
  let file = file_picker.files[0];
  if (!file) {
    show_popup("No file selected!", "is-danger", 1000);
    return;
  }
  let array_buffer = await read_file_as_array_buffer(file);
  let uint8_array = new Uint8Array(array_buffer);

  let filename = file.name;
  format_element_text("file_name", filename);

  let response = await request(`/api/svg/?filename=${filename}`, {
    "method": "POST",
    "body": uint8_array
  });

  if (response.status == 200) {
    show_popup("Successfully converted!");
    await download_response(response, "export.svg")
  } else {
    show_popup(`Failed to convert!\nHTTP${response.status}: Check log for details...`);
    console.error(`Failed to convert file!\n${await response.text()}`);
  }

  button_svg.classList.remove("is-loading");
  button_svg.removeAttribute("disabled");
}

let last_x;
let last_y;
let last_z;

function on_change() {
  const file_picker = document.getElementById("file_picker");
  let file = file_picker.files[0];
  if (!file) {
    format_element_text("file_name", "No file selected");
  } else {
    let filename = file.name;
    format_element_text("file_name", filename);
  }

  const slider_x = document.getElementById("slider_x");
  const input_x = document.getElementById("input_x");
  const slider_y = document.getElementById("slider_y");
  const input_y = document.getElementById("input_y");
  const slider_z = document.getElementById("slider_z");
  const input_z = document.getElementById("input_z");

  if (input_x.value != last_x) {
    last_x = input_x.value;
    slider_x.value = last_x;
  }
  if (input_y.value != last_y) {
    last_y = input_y.value;
    slider_y.value = last_y;
  }
  if (input_z.value != last_z) {
    last_z = input_z.value;
    slider_z.value = last_z;
  }
}

function on_slider_change(slider, input) {
  return function() {
    input.value = slider.value;
  }
}

function on_dpi_change() {
  const dpi_calc_x = document.getElementById("dpi_calc_x");
  const dpi_calc_y = document.getElementById("dpi_calc_y");
  const dpi_calc_dpi = document.getElementById("dpi_calc_dpi");
  const dpi_calc_out_x = document.getElementById("dpi_calc_out_x");
  const dpi_calc_out_y = document.getElementById("dpi_calc_out_y");

  const dpi = dpi_calc_dpi.value;
  const pixels_x = dpi_calc_x.value;
  const pixels_y = dpi_calc_y.value;

  let mm_x = (pixels_x / dpi) * 25.4;
  let mm_y = (pixels_y / dpi) * 25.4;

  dpi_calc_out_x.value = mm_x;
  dpi_calc_out_y.value = mm_y;
}

function fill_dpi_values() {
  const dpi_calc_out_x = document.getElementById("dpi_calc_out_x");
  const dpi_calc_out_y = document.getElementById("dpi_calc_out_y");
  const input_x = document.getElementById("input_x");
  const input_y = document.getElementById("input_y");

  input_x.value = dpi_calc_out_x.value;
  input_y.value = dpi_calc_out_y.value;

  on_change();
}

async function identify_colours() {
  const button_find_colours = document.getElementById("button_find_colours");

  button_find_colours.classList.add("is-loading");
  button_find_colours.setAttribute("disabled", true);

  // Read the file, grab the height, send it.
  const file_picker = document.getElementById("file_picker");
  let file = file_picker.files[0];
  if (!file) {
    show_popup("No file selected!", "is-danger", 1000);
    return;
  }
  let array_buffer = await read_file_as_array_buffer(file);
  let uint8_array = new Uint8Array(array_buffer);

  let filename = file.name;
  format_element_text("file_name", filename);

  let response = await request(`/api/colouridentify/`, {
    "method": "POST",
    "body": uint8_array
  });

  if (response.status == 200) {
    show_popup("Successfully identified!");
    let data = await response.json();
    let number_of_colours = Object.keys(data).length;
    format_element_text("colour_identifier_text", number_of_colours);
    const colour_identifier_p = document.getElementById("colour_identifier_p");
    let text = "";
    for (const [hex,human] of Object.entries(data)) {
      text += `${hex} / ${human}\n`
    }
    colour_identifier_p.innerText = text;
  } else {
    show_popup(`Failed to convert!\nHTTP${response.status}: Check log for details...`);
    console.error(`Failed to convert file!\n${await response.text()}`);
  }

  button_find_colours.classList.remove("is-loading");
  button_find_colours.removeAttribute("disabled");
}

async function setup() {
  const button_stl = document.getElementById("button_stl");
  button_stl.onclick = convert_to_stl;
  const button_3mf = document.getElementById("button_3mf");
  button_3mf.onclick = convert_to_3mf;
  const button_svg = document.getElementById("button_svg");
  button_svg.onclick = convert_to_svg;
  const button_find_colours = document.getElementById("button_find_colours");
  button_find_colours.onclick = identify_colours;
  const file_picker = document.getElementById("file_picker");
  file_picker.onchange = on_change;
  const slider_x = document.getElementById("slider_x");
  const input_x = document.getElementById("input_x");
  const slider_y = document.getElementById("slider_y");
  const input_y = document.getElementById("input_y");
  const slider_z = document.getElementById("slider_z");
  const input_z = document.getElementById("input_z");

  slider_x.onchange = on_slider_change(slider_x, input_x);
  input_x.onchange = on_change;
  slider_y.onchange = on_slider_change(slider_y, input_y);
  input_y.onchange = on_change;
  slider_z.onchange = on_slider_change(slider_z, input_z);
  input_z.onchange = on_change;

  
  const dpi_calc_x = document.getElementById("dpi_calc_x");
  const dpi_calc_y = document.getElementById("dpi_calc_y");
  const dpi_calc_dpi = document.getElementById("dpi_calc_dpi");
  dpi_calc_x.onchange = on_dpi_change;
  dpi_calc_y.onchange = on_dpi_change;
  dpi_calc_dpi.onchange = on_dpi_change;
  const dpi_calc_fill_values = document.getElementById("dpi_calc_fill_values");
  dpi_calc_fill_values.onclick = fill_dpi_values;
}

if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}