"use strict";

import { request, format_element_text, create_element, remove_children, make_id, disable_button, enable_button } from "./libcommon.js";
import { show_popup } from "./libpopup.js"

function read_file_as_array_buffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function buf_to_b64(buffer) {
  let binary = '';
  let bytes = new Uint8Array( buffer );
  let len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode( bytes[ i ] );
  }
  return window.btoa( binary );
}

let current_job = {
  "type": "UNSELECTED",
  "files": [],
  "meta": {
    "filename": "extruded"
  }
}

/*
{"name": "filename.png","bytes":"file contents in base64", "id": "16charsofrandoms"}
*/
let files = [];

const valid_types = {
  "svg": "svg",
  "stl": "stl",
  "3mf": "3mf",
  "backed_3mf": "3mf",
  "stacked_3mf": "3mf"
}

function strip_ext(s) {
  return s.replace(/\.[^/.]+$/, "")
}

async function submit_job(files_to_remove=1) {
  if (current_job["type"] === "UNSELECTED") {
    show_popup("Unselected job type!", "is-error", 5000);
    return;
  }
  if (!current_job["type"] in valid_types) {
    show_popup("Invalid job type!", "is-error", 5000)
  }
  if (!current_job["meta"]["filename"].includes(".")) {
    current_job["meta"]["filename"] = `${current_job["meta"]["filename"]}.${valid_types[current_job["type"]]}`
  } else {
    current_job["meta"]["filename"] = `${strip_ext(current_job["meta"]["filename"])}.${valid_types[current_job["type"]]}`
  }
  
  for (const file of files) {
    current_job["files"].push(file["bytes"]);
  }

  let request = await fetch("/api/job/submit/", {
    "body": JSON.stringify(current_job),
    "method": "POST"
  });
  if (request.status == 200) {
    show_popup("Job submitted!");
    await clear_job(files_to_remove);
  } else {
    console.error(`HTTP ${request.status}`)
    console.error(await request.text());
    show_popup("Failed to submit job!", "is-error", 5000);
  }
}

async function clear_job(files_to_remove=1) {
  current_job = {
    "type": "UNSELECTED",
    "files": [],
    "meta": {
      "filename": "extruded"
    }
  }

  files.splice(0, files_to_remove);
  await refresh_file_viewer();
}

async function convert_svg() {
  disable_button("button_svg");

  if (files.length == 0) {
    show_popup("Select a file!", "is-danger", 2500);
    enable_button("button_svg");
  }

  let current_file = files[0];
  current_job.files.length = 0;
  current_job.files.push(current_file["bytes"]);
  current_job.type = "svg";

  current_job["meta"]["filename"] = current_file["name"];

  await submit_job();
  enable_button("button_svg");
}

async function convert_stl() {
  disable_button("button_stl");

  if (files.length == 0) {
    show_popup("Select a file!", "is-danger", 2500);
    enable_button("button_stl");
  }

  let current_file = files[0];
  current_job.files.length = 0;
  current_job.files.push(current_file["bytes"]);
  current_job.type = "stl";

  current_job["meta"]["filename"] = current_file["name"];

  const input_x = document.getElementById("input_x");
  const input_y = document.getElementById("input_y");
  const input_z = document.getElementById("input_z");
  current_job["meta"]["x"] = parseFloat(input_x.value);
  current_job["meta"]["y"] = parseFloat(input_y.value);
  current_job["meta"]["z"] = parseFloat(input_z.value);
  
  await submit_job();
  enable_button("button_stl");
}

async function convert_3mf() {
  disable_button("button_3mf");

  if (files.length == 0) {
    show_popup("Select a file!", "is-danger", 2500);
    enable_button("button_3mf");
  }
  
  let current_file = files[0];
  current_job.files.length = 0;
  current_job.files.push(current_file["bytes"]);
  current_job.type = "3mf";

  current_job["meta"]["filename"] = current_file["name"];

  const input_x = document.getElementById("input_x");
  const input_y = document.getElementById("input_y");
  const input_z = document.getElementById("input_z");
  current_job["meta"]["x"] = parseFloat(input_x.value);
  current_job["meta"]["y"] = parseFloat(input_y.value);
  current_job["meta"]["z"] = parseFloat(input_z.value);

  await submit_job();
  enable_button("button_3mf");
}

async function convert_backed_3mf() {
  disable_button("button_3mf_black");

  if (files.length == 0) {
    show_popup("Select a file!", "is-danger", 2500);
    enable_button("button_3mf_black");
  }
  
  let current_file = files[0];
  current_job.files.length = 0;
  current_job.files.push(current_file["bytes"]);
  current_job.type = "backed_3mf";

  current_job["meta"]["filename"] = current_file["name"];

  const input_x = document.getElementById("input_x");
  const input_y = document.getElementById("input_y");
  const input_z = document.getElementById("input_z");
  current_job["meta"]["x"] = parseFloat(input_x.value);
  current_job["meta"]["y"] = parseFloat(input_y.value);
  current_job["meta"]["z"] = parseFloat(input_z.value);

  const input_black = document.getElementById("input_black");
  current_job["meta"]["black_thickness"] = parseFloat(input_black.value);

  await submit_job();
  enable_button("button_3mf_black");
}

async function add_file() {
  let file_input = create_element("input", {
    "attributes": {
      "type": "file",
      "accept": ".png",
      "multiple": true
    },
    "listeners": {
      "change": async function(e) {
        if (!e.target.files[0]) {
          show_popup("Please select a file!", "is-danger", 5000);
          return;
        }

        for (const file of e.target.files) {
          let filename = file.name;
          let filebuffer = await read_file_as_array_buffer(file);
          let b64 = buf_to_b64(filebuffer);
          files.push({
            "name": filename,
            "bytes": b64,
            "file_id": make_id(16)
          });
        }

        await refresh_file_viewer();
      }
    }
  });
  file_input.type = "file";
  file_input.click();
}

function build_file(file_id) {
  let remove_button = create_element("button", {
    "classes": ["button", "is-danger"],
    "inner_text": "X",
    "listeners": {
      "click": async function(e) {
        let idx = files.findIndex((ele) => ele["file_id"] === file_id);
        files.splice(idx, 1);
        await refresh_file_viewer();
      }
    }
  });
  let up_button = create_element("button", {
    "classes": ["button"],
    "inner_text": "∧",
    "listeners": {
      "click": async function() {
        let idx = files.findIndex((ele) => ele["file_id"] === file_id);
        if (idx == 0) {
          return;
        }
        let up_idx = idx - 1;
        [files[up_idx], files[idx]] = [files[idx], files[up_idx]];
        await refresh_file_viewer();
      }
    }
  });
  let down_button = create_element("button", {
    "classes": ["button"],
    "inner_text": "∨",
    "listeners": {
      "click": async function() {
        let idx = files.findIndex((ele) => ele["file_id"] === file_id);
        if (idx == files.length-1) {
          return;
        }
        let down_idx = idx + 1;
        [files[down_idx], files[idx]] = [files[idx], files[down_idx]];
        await refresh_file_viewer();
      }
    }
  });
  let idx = files.findIndex((ele) => ele["file_id"] === file_id);

  if (idx == files.length-1) {
    down_button.setAttribute("disabled", true);
    down_button.classList.add("is-disabled");
  }
  if (idx == 0) {
    up_button.setAttribute("disabled", true);
    up_button.classList.add("is-disabled");
  }

  let file_name = files[idx]["name"]
  let p = create_element("p", {
    "inner_text": file_name.substring(0, 20)
  });

  let updowndiv = create_element("div", {
    "children": [up_button, down_button]
  });

  let div = create_element("div", {
    "classes": ["box", "level", "mt-1", "mb-0"],
    "children": [updowndiv, p, remove_button]
  });

  return div;
}

async function remove_all_files() {
  files.length = 0;
  await refresh_file_viewer();
}

let last_x;
let last_y;
let last_z;
let last_black;

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
  const slider_black = document.getElementById("slider_black");
  const input_black = document.getElementById("input_black");

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
  if (input_black.value != last_black) {
    last_black = input_black.value;
    slider_black.value = last_black;
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

async function refresh_file_viewer() {
  let image_list_box = document.getElementById("image_list_box");
  remove_children(image_list_box);

  for (const file of files) {
    let element = build_file(file["file_id"]);
    console.log(element);
    image_list_box.appendChild(element);
  }
}

async function refresh_job_queue() {
  let request = await fetch("/api/job/current/");
  if (request.status != 200) {
    show_popup("Failed to retrieve current jobs!", "is-danger", 2500);
    return;
  }

  let data = await request.json();

  let pending_jobs_div = document.getElementById("pending_jobs_div");
  remove_children(pending_jobs_div);

  for (const file of data) {
    let p = create_element("p", {"inner_text": file});
    let box = create_element("div", {
      "classes": ["box"],
      "children": [p],
    });
    pending_jobs_div.appendChild(box);
  }
}

async function refresh_worker_stats() {
  let request = await fetch("/api/job/workers/");
  if (request.status != 200) {
    show_popup("Failed to retrieve worker stats!", "is-danger", 2500);
    return;
  }

  let data = await request.json();

  let worker_stats_div = document.getElementById("worker_stats_div");
  remove_children(worker_stats_div);

  for (const [id,state] of Object.entries(data)) {
    let p = create_element("p", {"inner_text": `Worker/#${id}: ${state}`});
    let box = create_element("div", {
      "classes": ["box"],
      "children": [p],
    });
    worker_stats_div.appendChild(box);
  }
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

async function refresh_finished_jobs() {
  let request = await fetch("/api/job/complete/");
  if (request.status != 200) {
    show_popup("Failed to retrieve complete jobs!", "is-danger", 2500);
    return;
  }

  let data = await request.json();

  let finished_jobs_div = document.getElementById("finished_jobs_div");
  remove_children(finished_jobs_div);

  for (const [id, info] of Object.entries(data)) {
    if (!info["ok"]) {
      let p = create_element("p", {"inner_text": info["filename"]});
      let err = create_element("button", {
        "inner_text": "Error",
        "attributes": {
          "title": info["error"]
        },
        "listeners": {
          "click": async function() {
            await fetch("/api/job/download/?id="+id);
            await refresh_finished_jobs();
          }
        }
      });
      let box = create_element("div", {
        "classes": ["box", "level"],
        "children": [p, err],
      });
      finished_jobs_div.appendChild(box);
    } else {
      let p = create_element("p", {"inner_text": info["filename"]});
      let save_button = create_element("button", {
        "classes": ["button", "is-link"],
        "inner_text": "💾",
        "listeners": {
          "click": async function() {
            let request = await fetch("/api/job/download/?id="+id);
            if (request.status == 200) {
              download_response(request);
            } else {
              show_popup("Failed to download!", "is-danger", 5000);
            }
            await refresh_finished_jobs();
          }
        }
      });
      let delete_button = create_element("button", {
        "classes": ["button", "is-danger", "ml-2"],
        "inner_text": "❌",
        "listeners": {
          "click": async function() {
            let request = await fetch("/api/job/download/?id="+id);
            await refresh_finished_jobs();
          }
        }
      })
      let button_div = create_element("div", {
        "children": [save_button, delete_button]
      });
      let box = create_element("div", {
        "classes": ["box", "level"],
        "children": [p, button_div],
      });
      finished_jobs_div.appendChild(box);
    }
  }
}

function b64_to_array_buffer(b64) {
  const binary_string = atob(b64);

  const length = binary_string.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }

  return bytes.buffer;
}

async function identify_colours() {
  disable_button("button_find_colours");

  if (files.length == 0) {
    show_popup("Select a file!", "is-danger", 2500);
    enable_button("button_find_colours");
  }

  let arrbuf = b64_to_array_buffer(files[0]["bytes"]);
  
  let filename = files[0]["name"];
  format_element_text("colour_identifier_file", filename);

  let response = await request(`/api/colouridentify/`, {
    "method": "POST",
    "body": arrbuf
  });

  if (response.status == 200) {
    show_popup("Successfully identified!");
    let data = await response.json();
    let number_of_colours = Object.keys(data).length;
    format_element_text("colour_identifier_text", number_of_colours);
    const colour_identifier_p = document.getElementById("colour_identifier_p");
    let text = "";
    let cols = {}
    for (const [hex,human] of Object.entries(data)) {
      if (human in cols) {
        cols[human].push(hex);
      } else {
        cols[human] = [hex];
      }
    }
    for (const [human, hexs] of Object.entries(cols)) {
      text += `<b>${human}</b>:<br>`;
      for (const hex of hexs) {
        text += `  #${hex}<br>`
      }
      text += "<br>"
    }
    // remove last 4 characters (\n\n)
    text = text.replace(/<br><br>$/, "")
    colour_identifier_p.innerHTML = text;
  } else {
    show_popup(`Failed to convert!\nHTTP${response.status}: Check log for details...`);
    console.error(`Failed to convert file!\n${await response.text()}`);
  }

  enable_button("button_find_colours");
}

async function setup() {
  const button_new_image = document.getElementById("button_new_image");
  button_new_image.onclick = add_file;
  const button_clear_images = document.getElementById("button_clear_images");
  button_clear_images.onclick = remove_all_files;
  
  const button_stl = document.getElementById("button_stl");
  button_stl.onclick = convert_stl;
  const button_3mf = document.getElementById("button_3mf");
  button_3mf.onclick = convert_3mf;
  const button_svg = document.getElementById("button_svg");
  button_svg.onclick = convert_svg;
  const button_find_colours = document.getElementById("button_find_colours");
  button_find_colours.onclick = identify_colours;
  const button_3mf_black = document.getElementById("button_3mf_black");
  button_3mf_black.onclick = convert_backed_3mf;

  // Sliders, DPI
  const slider_x = document.getElementById("slider_x");
  const input_x = document.getElementById("input_x");
  const slider_y = document.getElementById("slider_y");
  const input_y = document.getElementById("input_y");
  const slider_z = document.getElementById("slider_z");
  const input_z = document.getElementById("input_z");
  const slider_black = document.getElementById("slider_black");
  const input_black = document.getElementById("input_black");

  slider_x.onchange = on_slider_change(slider_x, input_x);
  input_x.onchange = on_change;
  slider_y.onchange = on_slider_change(slider_y, input_y);
  input_y.onchange = on_change;
  slider_z.onchange = on_slider_change(slider_z, input_z);
  input_z.onchange = on_change;
  slider_black.onchange = on_slider_change(slider_black, input_black);
  input_black.onchange = on_change;

  
  const dpi_calc_x = document.getElementById("dpi_calc_x");
  const dpi_calc_y = document.getElementById("dpi_calc_y");
  const dpi_calc_dpi = document.getElementById("dpi_calc_dpi");
  dpi_calc_x.onchange = on_dpi_change;
  dpi_calc_y.onchange = on_dpi_change;
  dpi_calc_dpi.onchange = on_dpi_change;
  const dpi_calc_fill_values = document.getElementById("dpi_calc_fill_values");
  dpi_calc_fill_values.onclick = fill_dpi_values;
  
  setInterval(refresh_job_queue, 5000);
  await refresh_job_queue();
  const button_refresh_current_jobs = document.getElementById("button_refresh_current_jobs");
  button_refresh_current_jobs.onclick = refresh_job_queue
  setInterval(refresh_finished_jobs, 5000);
  await refresh_finished_jobs();
  const button_refresh_finished_jobs = document.getElementById("button_refresh_finished_jobs");
  button_refresh_finished_jobs.onclick = refresh_finished_jobs
  setInterval(refresh_worker_stats, 5000);
  await refresh_worker_stats();
  const button_refresh_worker_stats = document.getElementById("button_refresh_worker_stats");
  button_refresh_worker_stats.onclick = refresh_worker_stats
}

if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}