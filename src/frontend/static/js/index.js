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

async function setup() {
  const button_stl = document.getElementById("button_stl");
  button_stl.onclick = convert_to_stl;
  const button_svg = document.getElementById("button_svg");
  button_svg.onclick = convert_to_svg;
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
}

if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}