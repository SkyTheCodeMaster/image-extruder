"use strict";

import { request, format_element_text } from "/js/libcommon.js";

async function load_db_counts() {
  let data;
  try {
    let response = await request("/api/srv/get/");
    data = await response.json();
  } catch (e) {
    console.error(e)
  }
  format_element_text("db_size", data["db_size"] ? data["db_size"] : "No DB")
}

async function setup() {
  await load_db_counts();
}

if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}