"use strict";

// libcommon 1.2.0

import { Popup, show_popup } from "./libpopup.js";

export function format(_format) {
  let args = Array.prototype.slice.call(arguments, 1);
  return _format.replace(/{(\d+)}/g, function(match, number) { 
    return typeof args[number] != 'undefined'
      ? args[number] 
      : match
    ;
  });
};

/** Make a randomized ID based off of a set length
 * 
 * @param {number} length 
 * @returns {string}
 */
export function make_id(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i=0; i<length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/** Return a formatted string with the units auto calculated
 * @param {number} num - The raw number to format
 * @param {Object} opts - Options to format with
 * @param {Array<String>} opts.units - The units to append to the number
 * @param {number} k - The separator for each unit (Usually 1000 or 1024)
 * @param {number} decimals - The number of decimals to format to.
*/
export function format_units(num, opts) {
  if (!opts) {
    opts = {
      "k": 1000,
      "units": ['', 'k', 'M', 'B', 'T', 'Qd', 'Qt', 'Sx', 'Sp', 'Oc', 'No', 'De', 'Ud', 'Du'],
      "decimals": 2
    }
  }
  const k = opts.k
  const sizes = opts.units
  const decimals = opts.decimals

  if (!+num) return `0 ${sizes[0]}`;

  const dm = decimals < 0 ? 0 : decimals;

  const i = Math.floor(Math.log(num) / Math.log(k));

  return `${parseFloat((num / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function format_bytes(bytes, decimals = 2) {
  let opts = {
    "k": 1024,
    "units": ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
    "decimals": decimals
  }
  return format_units(bytes, opts);
}

export function format_bytes_per_second(bytes, decimals = 2) {;
  let opts = {
    "k": 1024,
    "units": ['B/s', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps', 'Ebps', 'Zbps', 'Ybps'],
    "decimals": decimals
  }
  return format_units(bytes, opts);
}

export function format_hashes_per_second(bytes, decimals = 2) {
  let opts = {
    "k": 1024,
    "units": ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s', 'ZH/s', 'YH/s'],
    "decimals": decimals
  }
  return format_units(bytes, opts);
}

export function to_title_case(str) {
  return str.replace(
    /\w\S*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

function _longdiv(numerator, denominator) {
  let remainder = numerator % denominator;
  let quotient = ((numerator-remainder)/denominator);

  return [quotient, remainder];
}

export function parse_seconds(_seconds, decimal_length = 0) {
  // Turn seconds into year month day hour minute second, like
  // 1y 3m 2d 16h 13m 45s
  
  let [_minutes, seconds]  = _longdiv(_seconds, 60);
  let [_hours, minutes] = _longdiv(_minutes, 60);
  let [_days, hours] = _longdiv(_hours, 60);
  let [_months, days] = _longdiv(_days, 24);
  let [_years, months] = _longdiv(_months, 30);
  let years = Math.floor(_years/12);

  let out = ""

  if (years != 0) {
    out = out + format("{0}y ", years.toFixed(decimal_length))
  }
  if (months != 0) {
    out = out + format("{0}m ", months.toFixed(decimal_length))
  }
  if (days != 0) {
    out = out + format("{0}d ", days.toFixed(decimal_length))
  }
  if (hours != 0) {
    out = out + format("{0}h ", hours.toFixed(decimal_length))
  }
  if (minutes != 0) {
    out = out + format("{0}m ", minutes.toFixed(decimal_length))
  }
  if (seconds != 0) {
    out = out + format("{0}s ", seconds.toFixed(decimal_length))
  }

  return out
}

export function remove_children(element) {
  while (element.firstChild) {
    element.removeChild(element.lastChild);
  }
}

export function set_cookie(name,value,days) {
  var expires = "";
  if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days*24*60*60*1000));
      expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

export function get_cookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

export function delete_cookie(name) {   
  document.cookie = name+'=; Max-Age=-99999999;';  
}

/** Create an element with predefined attributes
 * @param {string} type - The type of element to make.
 * @param {Object} opts - Options to instantiate the element with.
 * @param {string} opts.classes[] - Classes to add to the element.
 * @param {Object} opts.style - Default styles to apply.
 * @param {string} opts.id - ID to apply to the element.
 * @param {string} opts.inner_text - Inner text of the element. Mutually exclusive with `opts.inner_html` and `opts.children`.
 * @param {string} opts.inner_html - Inner HTML of the element. Mutually exclusive with `opts.inner_text` and `opts.children`.
 * @param {HTMLElement} opts.children[] - Children to add to the element. Mutually exclusive with `opts.inner_text` and `opts.inner_html`.
 * @param {Object} opts.attributes - Attributes to apply to the element.
 * @param {Object} opts.listeners - Event listeners to attach to the object.
 * @param {String} opts.title - Title of the element.
 * @param {String} opts.access_key - {@link HTMLElement.accessKey}
 * @param {String} opts.autocapitalize - {@link HTMLElement.autocapitalize}
 * @param {boolean} opts.autofocus - {@link HTMLElement.autofocus}
 * @param {boolean} opts.content_editable - {@link HTMLElement.contentEditable}
 * @param {String} opts.dir - {@link HTMLElement.dir}
 * @param {boolean} opts.draggable - {@link HTMLElement.draggable}
 * @param {String} opts.enter_key_hint - {@link HTMLElement.enterKeyHint}
 * @param {boolean} opts.hidden - {@link HTMLElement.hidden}
 * @param {boolean} opts.inert - {@link HTMLElement.inert}
 * @param {String} opts.inputmode - {@link HTMLElement.inputMode}
 * @param {String} opts.lang - {@link HTMLElement.lang}
 * @param {String} opts.popover - {@link HTMLElement.popover}
 * @param {boolean} opts.spellcheck - {@link HTMLElement.spellcheck}
 * @returns {HTMLElement}
 */
export function create_element(type, opts={}) {
  const element = document.createElement(type);
  let keys = Object.keys(opts);

  if (keys.includes("classes")) {
    for (let cls of opts.classes) {
      element.classList.add(cls);
    }
  }
  if (keys.includes("style")) {
    for (let [k,v] of Object.entries(opts.style)) {
      element.style[k] = v;
    }
  }
  if (keys.includes("id")) {
    element.id = opts.id;
  }

  // Check for default filling
  let exclusive = false;

  const combinations = [
    ["inner_text", "inner_html"],
    ["inner_text", "children"],
    ["inner_html", "children"]
  ]

  for (const combo of combinations) {
    if (combo.every(key => keys.includes(key))) {
      exclusive = true;
      break;
    }
  }

  if (exclusive) {
    throw new Error("inner_text inner_html and children are mutually exclusive");
  }

  if (keys.includes("inner_text")) {
    element.innerText = opts.inner_text;
  } else if (keys.includes("inner_html")) {
    element.innerHTML = opts.inner_html;
  } else if (keys.includes("children")) {
    for (let child of opts.children) {
      element.appendChild(child);
    }
  }

  if (keys.includes("attributes")) {
    for (let [k,v] of Object.entries(opts.attributes)) {
      element.setAttribute(k,v);
    }
  }

  if (keys.includes("listeners")) {
    for (let [k,v] of Object.entries(opts.listeners)) {
      element.addEventListener(k, v);
    }
  }

  if (keys.includes("title")) {
    element.title = opts.title;
  }

  if (keys.includes("access_key")) {
    element.accessKey = opts.access_key;
  }

  if (keys.includes("autocapitalize")) {
    element.autocapitalize = opts.autocapitalize;
  }

  if (keys.includes("autofocus")) {
    element.autofocus = opts.autofocus;
  }

  if (keys.includes("content_editable")) {
    element.contentEditable = opts.content_editable;
  }

  if (keys.includes("dir")) {
    element.dir = opts.dir;
  }

  if (keys.includes("draggable")) {
    element.draggable = opts.draggable;
  }

  if (keys.includes("enter_key_hint")) {
    element.enterKeyHint = opts.enter_key_hint;
  }

  if (keys.includes("hidden")) {
    element.hidden = opts.hidden;
  }

  if (keys.includes("inert")) {
    element.inert = opts.inert;
  }

  if (keys.includes("inputmode")) {
    element.inputMode = opts.inputmode;
  }

  if (keys.includes("lang")) {
    element.lang = dir.lang;
  }

  if (keys.includes("popover")) {
    element.popover = opts.popover;
  }

  if (keys.includes("spellcheck")) {
    element.spellcheck = opts.spellcheck;
  }

  // Make element cloning easier

  /**
   * Clones the element using the same options to make it again.
   * @param {boolean} deep - Whether or not to recreate children too.
   * @returns {HTMLElement}
   */
  element.recreate = function(deep=false) {

    if (deep && opts.children != null) {
      let new_children = [];
      for (let child of opts.children) {
        if (child.recreate != null) {
          new_children.push(child.recreate(deep));
        } else {
          new_children.push(child);
        }
      }
      opts.children = new_children
    }

    return create_element(type, opts);
  }

  return element;
}

/** Format an element's innerText based on `data-text` attribute.
 * 
 * @param {HTMLElement|String} element Element to set innerText on  
 * @param  {...any} format_args Format args
 */
export function format_element_text(element, ...format_args) {
  if (typeof(element) == "string") {
    element = document.getElementById(element);
  }

  if (element == null) {
    throw new Error("Pass an element object or id!");
  }

  if (element.dataset.text === null) {
    throw new Error("Element does not have data-text attribute!");
  }

  element.innerText = format(element.dataset.text, ...format_args);
}

/** Get auth token from https://auth.skystuff.cc/.
 * @param {boolean} auto_redirect - Whether or not to automatically redirect to the login page upon 401 response.
 * @returns {string=true} Token in Bearer format.
 * @returns {boolean} False if unknown error while get details.
 */
export async function get_auth_token(auto_redirect = true, use_cache = true) {
  if (use_cache && window.sessionStorage.getItem("auth_token_cache") !== null) {
    return window.sessionStorage.getItem("auth_token_cache");
  }
  try {
    let user_request = await request("https://auth.skystuff.cc/api/user/get/", { credentials: "include" });
    if (user_request.status === 401) {
      if (auto_redirect) {
        let new_url = "https://auth.skystuff.cc/login?r=" + encodeURIComponent(window.location.href);
        window.location.assign(new_url);
      } else {
        console.log("[get_auth_token] received http 401");
        return false;
      }
    } else if (user_request.status === 200) {
      let data = await user_request.json();
      // Now, just return the token in Bearer format.
      window.sessionStorage.setItem("auth_token_cache", "Bearer " + data["token"]);
      window.sessionStorage.setItem("user_details_cache", JSON.stringify(data));
      return "Bearer " + data["token"];
    } else {
      console.log("[get_auth_token] received http " + user_request.status + ": " + await user_request.text());
    }
  } catch (e) {
    console.error("[get_auth_token] unknown error: " + e);
    return false;
  }
}

/** User Details object from auth.skystuff.cc/api/user/get/
 * @typedef {Object} UserDetails
 * @property {string} name - Username of user.
 * @property {string} email - Email of user.
 * @property {string} token - Token of user.
 * @property {boolean} super_admin - Whether or not the user is a super admin on the SSO.
 */

/** Get user details from https://auth.skystuff.cc/.
 * @param {boolean = true} auto_redirect - Whether or not to automatically redirect to the login page upon 401 response.
 * @returns {UserDetails}
 * @returns {boolean} False if unknown error while get details.
 */
export async function get_user_details(auto_redirect = true, use_cache = true) {
  if (use_cache && window.sessionStorage.getItem("auth_token_cache") !== null) {
    return JSON.parse(window.sessionStorage.getItem("user_details_cache"));
  }
  try {
    let user_request = await request("https://auth.skystuff.cc/api/user/get/", { credentials: "include" });
    if (user_request.status === 401) {
      if (auto_redirect) {
        let new_url = "https://auth.skystuff.cc/login?r=" + encodeURIComponent(window.location.href);
        window.location.assign(new_url);
      } else {
        console.log("[get_user_details] received http 401");
        return false;
      }
    } else if (user_request.status === 200) {
      let data = await user_request.json();
      window.sessionStorage.setItem("auth_token_cache", "Bearer " + data["token"]);
      window.sessionStorage.setItem("user_details_cache", JSON.stringify(data));
      return data;
    } else {
      console.log("[get_user_details] received http " + user_request.status + ": " + await user_request.text());
    }
  } catch (e) {
    console.error("[get_user_details] unknown error: " + e);
    return false;
  }
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function get_upcs(upcs, host="https://upc.skystuff.cc/api/upc/bulk/") {
  let total_upcs = upcs.length;
  let page_size = 50;
  let token = await get_auth_token();

  let popup = new Popup({
    "text": "Fetching UPC data...",
    "has_progress_bar": true,
    "pg": {
      "indeterminate": true
    }
  });

  popup.spawn();

  if (total_upcs <= page_size) {
    popup.edit({
      "has_progress_bar": true,
      "pg": {
        "indeterminate": false,
        "value": 0,
        "max": 100
      }
    });
    let upc_bulk_request = await request(host + "?upcs="+upcs.join(","),{
      "headers": {
        "Authorization": token
      }
    });
    let upc_bulk_data = {};
    if (upc_bulk_request.status == 200) {
      upc_bulk_data = await upc_bulk_request.json();
      if (upc_bulk_data["requested"] != upc_bulk_data["found"]) {
        show_popup("Some items are missing UPC entries!");
      }
    } else {
      upc_bulk_data = {"items":{}}
    }
    popup.destroy();
    return upc_bulk_data
  }

  let total_pages = Math.ceil(total_upcs / page_size);

  popup.edit({
    "has_progress_bar": true,
    "pg": {
      "indeterminate": false,
      "value": 0,
      "max": total_pages
    }
  });

  let full_data = {};

  let tries = 0;

  for (let page=0; page<total_pages; page++) {
    if (tries == 5) {
      show_popup("Failed to get page after 5 tries", true);
      break;
    }

    popup.edit({
      "has_progress_bar": true,
      "pg": {
        "indeterminate": false,
        "value": page,
        "max": total_pages
      }
    });

    let page_upcs = upcs.slice(page * page_size, (page+1)*page_size);
    let request = await fetch(host + "?upcs=" + page_upcs.join(","),{
      "headers": {
        "Authorization": token
      }
    });

    if (request.status == 200) {
      let request_data = await request.json();
      full_data = {...full_data, ...request_data["items"]};
      tries = 0;
    } else if (request.status == 429) {
      let retry_after = request.headers.get("Retry-After");
      popup.edit({
        "text": `Ratelimited. Retrying after ${retry_after} seconds`,
        "pg": {
          "value": 0,
          "max": retry_after,
          "counting": true,
          "count_speed": 1000
        }
      });

      await sleep(retry_after);
      page--; // This should retry the current request.
      tries++;
    } else {
      console.error("Failure in getting data blob for page " + page, request.statusText);
    }
  }

  popup.destroy();
  return full_data;
}

export async function walk_paginator(key, endpoint) {
  let token = await get_auth_token();

  let popup = new Popup({
    "text": "Fetching data...",
    "background_colour": "is-primary",
    "has_progress_bar": true,
    "pg": {
      "indeterminate": true
    }
  });

  popup.spawn();

  let first_request = await request(endpoint, {
    "headers": {
      "Authorization": token
    }
  });

  if (first_request.status != 200) {
    console.error("Failure in getting first data blob", first_request.statusText);
  }

  let first_data = await first_request.json();

  let total_pages = Math.ceil(first_data["total"] / first_data["returned"]);
  if (total_pages == 1) {
    // Theres only 1 page, just return the items.
    popup.destroy()
    return first_data[key];
  }

  popup.edit({
    "has_progress_bar": true,
    "background_colour": "is-primary",
    "pg": {
      "indeterminate": false,
      "value": 0,
      "max": total_pages
    }
  });

  let page_size = first_data["returned"];

  const IS_ARRAY = first_data[key].constructor === Array;

  let full_data;
  if (IS_ARRAY) {
    full_data = [];
    full_data.push(...first_data[key]);
  } else {
    full_data = {};
    full_data = {...full_data, ...first_data[key]};
  }

  let tries = 0;

  for (let page=1; page<total_pages; page++) {
    if (tries == 5) {
      show_popup("Failed to get page after 5 tries", true);
      break;
    }

    popup.edit({
      "has_progress_bar": true,
      "background_colour": "is-primary",
      "pg": {
        "indeterminate": false,
        "value": page,
        "max": total_pages
      }
    });

    let offset = page * page_size;
    let request = await fetch(endpoint + "?offset=" + offset,{
      "headers": {
        "Authorization": token
      }
    });

    if (request.status == 200) {
      let request_data = await request.json();
      if (IS_ARRAY) {
        full_data.push(...request_data[key]);
      } else {
        full_data = {...full_data, ...request_data[key]};
      }
      tries = 0;
    } else if (request.status == 429) {
      let retry_after = request.headers.get("Retry-After");
      popup.edit({
        "text": `Ratelimited. Retrying after ${retry_after} seconds`,
        "background_colour": "is-danger",
        "has_progress_bar": true,
        "pg": {
          "value": 0,
          "max": retry_after,
          "counting": true,
          "count_speed": 1000
        }
      });

      await sleep(retry_after*1000);
      page--; // This should retry the current request.
      tries++;
    } else {
      console.error("Failure in getting data blob for page " + page, request.statusText);
    }
  }

  popup.destroy();
  return full_data;
}

/** Make a request, respecting ratelimits.
 * 
 * @param {String} url - URL to get
 * @param {RequestInit} opts - Options for fetch
 * @returns {Response}
 */
export async function request(url, opts) {
  let resp = await fetch(url, opts);

  if (resp.status == 200) {
    return resp;
  } else if (resp.status == 429) {
    let retry_after = resp.headers["Retry-After"];
    // Show a funny popup
    let popup = new Popup({
      "text": `Ratelimited. Waiting ${retry_after}s.`,
      "has_progress_bar": true,
      "pg": {
        "value": 0,
        "max": retry_after,
        "counting": true
      }
    });
    popup.spawn();
    await sleep(retry_after*1000);
    popup.destroy();
    return request(url, opts);
  } else {
    return resp;
  }
}

export function disable_button(element) {
  if (typeof(element) == "string") {
    element = document.getElementById(element);
  }

  element.setAttribute("disabled", true);
  element.classList.add("is-loading");
}

export function enable_button(element) {
  if (typeof(element) == "string") {
    element = document.getElementById(element);
  }

  element.removeAttribute("disabled");
  element.classList.remove("is-loading");
}