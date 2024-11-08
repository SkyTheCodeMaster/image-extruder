import { make_id, create_element } from './libcommon.js'
import { ProgressBar } from './libprogress.js';

// libpopup 1.0.0

/** The options for the popup
 * @typedef {Object} PopupOptions
 * @property {string} text - The text to set the popup with
 * @property {string} [background_colour=is-primary] - The colour to set the background to. Defaults to "is-primary", a light green.
 * @property {string} text_colour - The colour of the text.
 * @property {boolean} precise_colour - Whether or not colours are bulma colour classes, or hex strings.
 * @property {number=} width - The width of the popup box, default of 20%.
 * @property {boolean} has_progress_bar - Whether or not the popup has a progress bar at the bottom.
 * @property {import('./libprogress.js').PopupOptions} pg - Options fed directly to the progress bar for initialization.
 */

export class Popup {
  text;
  #text_colour;
  #background_colour;
  #width;
  #has_progress_bar;
  #pg_options;
  #id;

  // In precise colour mode, the colours are set directly in css, instead of bulma colour classes.
  #precise_colour;
  // Internal reference to the progress bar object
  #progress_bar;

  /** Initialize a popup
   * 
   * @param {PopupOptions} opts
   */
  constructor(opts) {
    let resolved_opts = {
      "text": "",
      "background_colour": "is-primary",
      "text_colour": "has-text-white",
      "precise_colour": false,
      "width": 20,
      "has_progress_bar": false,
      "pg": {}
    }
    Object.assign(resolved_opts, opts);

    this.text = resolved_opts.text;
    this.#background_colour = resolved_opts.background_colour;
    this.#text_colour = resolved_opts.text_colour;
    this.#precise_colour = resolved_opts.precise_colour;
    this.#width = resolved_opts.width;
    this.#has_progress_bar = resolved_opts.has_progress_bar;
    this.#pg_options = resolved_opts.pg;

    this.#id = make_id(16);
    // Generate a unique ID every time
    while (document.getElementById(this.#id)) {
      this.#id = make_id(16);
    }
  }

  spawn() {
    let this_popup = this;
    let delbtn = create_element("button", {
      "classes": ["delete"],
      "listeners": {
        "click": function() { this_popup.destroy(); }
      },
      "id": `${this.#id}_delete`
    });

    let text = create_element("p", {
      "inner_text": this.text,
      "id": `${this.#id}_text`
    });

    let notif_opts = {
      "classes": [
        "notification"
      ],
      "style": {
      },
      "id": this.#id,
      "children": [text,delbtn]
    };

    let right = (100-this.#width)/2;
    let outer_div_opts = {
      "style": {
        "right": `${right}%`,
        "width": `${this.#width}%`,
        "position": "fixed",
        "top": "25px",
        "z-index": "10000",
      },
      "id": `${this.#id}_outerdiv`
    }

    if (!this.#precise_colour) {
      notif_opts["classes"].push(this.#background_colour);
      if (this.#text_colour) {
        notif_opts["classes"].push(this.#text_colour);
      }
    } else {
      notif_opts["style"]["backgroundColour"] = this.#background_colour;
      if (this.text_colour) {
        notif_opts["style"]["colour"] = this.#text_colour;
      }
    }

    let notification = create_element("div", notif_opts);
    outer_div_opts["children"] = [notification];

    let element = create_element("div", outer_div_opts);
    document.body.appendChild(element);

    if (this.#has_progress_bar) {
      this.#attach_progressbar();
    }
  }

  #attach_progressbar() {
    let element = document.getElementById(this.#id);

    if (!element) {
      console.error(`Tried to attach a progress bar to popup ${this.#id}, but the popup does not exist!`);
      return;
    }

    if (this.#progress_bar) {
      this.#progress_bar.edit({"parent": element});
      this.#progress_bar.spawn();
    } else {
      let pg_opts = {
        "parent": element
      }
      Object.assign(pg_opts, this.#pg_options);
  
      this.#progress_bar = new ProgressBar(pg_opts);
      this.#progress_bar.spawn();
    }
  }

  #detach_progressbar() {
    if (!this.#progress_bar) {
      console.error(`Tried to detach a progress bar from popup ${this.#id}, but there is no assigned progress bar!`);
      return;
    }

    this.#progress_bar.destroy();
  }

  #delete_progressbar() {
    if (!this.#has_progress_bar) {
      console.error(`Tried to delete a progress bar from popup ${this.#id}, but there is no progress bar enabled!`);
      return;
    }

    if (this.#progress_bar) {
      this.#detach_progressbar();
      this.#progress_bar = undefined; // Once we detach it, we can remove the reference and ignore it.
    }

    this.#has_progress_bar = false;
  }

  /** Delete the popup, removing it from the DOM */
  destroy() {
    let element = document.getElementById(`${this.#id}_outerdiv`);
    if (!element) {
      console.error(`Tried to get popup '${this.#id}', but found nothing!`);
      return;
    }

    if (this.#has_progress_bar) {
      this.#detach_progressbar();
    }

    element.remove();
  }

  /** Edit the popup 
   * @param {PopupOptions} opts
  */
  edit(opts) {
    let resolved_opts = {
      "text": this.text,
      "background_colour": this.#background_colour,
      "text_colour": this.#text_colour,
      "precise_colour": this.#precise_colour,
      "width": this.width,
      "has_progress_bar": false,
      "pg": {}
    }

    Object.assign(resolved_opts, opts);
    this.text = resolved_opts.text;
    this.#background_colour = resolved_opts.background_colour;
    this.#text_colour = resolved_opts.text_colour;
    this.#precise_colour = resolved_opts.precise_colour;
    this.#width = resolved_opts.width;
    this.#has_progress_bar = resolved_opts.has_progress_bar;
    this.#pg_options = resolved_opts.pg;

    this.#update();
  }

  /** Update the popup, redrawing it */
  #update() {
    let outer_element = document.getElementById(`${this.#id}_outerdiv`);
    let element = document.getElementById(this.#id);
    let text_element = document.getElementById(`${this.#id}_text`);
    if (!element) {
      console.error(`Tried to update popup ${this.#id}, but element is missing!`);
      return;
    }

    let right = (100-this.#width)/2;
    outer_element.style.right = `${right}%`;
    outer_element.style.width = `${this.#width}%`;

    if (!this.#precise_colour) {
      element.classList.add(this.#background_colour);
      if (this.#text_colour) {
        element.classList.add(this.#text_colour);
      }
    } else {
      element.style.backgroundColor = this.#background_colour;
      if (this.text_colour) {
        element.style.color = this.#text_colour;
      }
    }

    text_element.innerText = this.text;

    if (this.#has_progress_bar) {
      if (this.#progress_bar) {
        this.#progress_bar.edit(this.#pg_options);
      } else {
        this.#attach_progressbar()
      }
    } else {
      this.#delete_progressbar();
    }
  }
}

export function show_popup(text, background="is-primary", duration=1000) {
  let popup = new Popup({
    "text": text,
    "background_colour": background
  });
  popup.spawn();
  setTimeout(function() { popup.destroy() }, duration);
}