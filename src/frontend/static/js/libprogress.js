import { make_id, create_element } from './libcommon.js'

// libprogress 1.0.0

/** 
 * @typedef {Object} ProgressOptions 
 * @property {number} value - The initial value of the progress bar
 * @property {number} max - The initial max of the progress bar
 * @property {number} size - The size of the progress bar. Must be one of "is-small", "is-normal", "is-medium", "is-large".
 * @property {string} width - The initial width of the progress bar
 * @property {string} foreground - The initial foreground colour of the progress bar
 * @property {string} background - The initial background colour of the progress bar
 * @property {boolean} indeterminate - Whether or not it is a loading bar
 * @property {boolean} flashing - Whether or not the bar is flashing
 * @property {number} flashing_frequency - Speed (in ms) of the bar flashing
 * @property {boolean} counting - Whether or not the bar is counting up to it's maximum
 * @property {number} counting_speed - Speed (in ms) of the count up. Defaults to 1000ms
 * @property {HTMLElement} parent - The parent element to attach to, defaults to document.body
 */

export class ProgressBar {
  value; // Value
  max; // Max number
  width; // Width string, directly passed to css 'width'
  #parent; // Parent HTMLElement
  #foreground; // Foreground colour
  #background; // Background colour
  #indeterminate; // Whether or not it is a loading bar
  #flashing; // Whether or not this is a flashing bar
  #flashing_frequency; // Speed (in ms) of the bar flashing
  #counting; // Whether or not the bar is counting up to it's maximum
  #counting_speed; // Speed (in ms) of the count up. Defaults to 1000ms
  #size; // The size of the progress bar. Must be one of "is-small", "is-normal", "is-medium", "is-large".
  #id; // The ID of the progress bar

  #flash_active = false;
  #flash_interval_id;

  #count_active = false;
  #count_interval_id;

  /** Construct a new progress bar
   * 
   * @param {ProgressOptions} opts
   */
  constructor(opts) {
    let resolved_opts = {
      "value": 0,
      "max": 100,
      "width": null,
      "foreground": "aaff6a",
      "background": "ebecf0",
      "indeterminate": false,
      "flashing": false,
      "size": "is-normal",
      "flashing_frequency": 500,
      "counting": false,
      "counting_speed": 1000,
      "parent": document.body
    };
    Object.assign(resolved_opts, opts);

    this.value = resolved_opts.value;
    this.max = resolved_opts.max;
    this.width = resolved_opts.width;
    this.#parent = resolved_opts.parent;
    this.#foreground = resolved_opts.foreground;
    this.#background = resolved_opts.background;
    this.#indeterminate = resolved_opts.indeterminate;
    this.#size = resolved_opts.size;
    this.#flashing = resolved_opts.flashing;
    this.#flashing_frequency = resolved_opts.flashing_frequency;
    this.#counting = resolved_opts.counting;
    this.#counting_speed = resolved_opts.counting_speed;
    this.#parent = resolved_opts.parent;

    this.#id = make_id(16);
    // Generate a unique ID every time
    while (document.getElementById(this.#id)) {
      this.#id = make_id(16);
    }
  }

  /** Spawn the progress bar and attach it to the parent element
   * @returns {null}
   */
  spawn() {
    // Check if it already exists
    if (document.getElementById(this.#id)) {
      console.error(`Tried to create progress bar ${this.#id}, but element already exists!`);
      return;
    }

    let element = create_element("progress", {
      "classes": ["progress", this.#size],
      "attributes": {
        "value": this.value,
        "max": this.max
      },
      "style": {
        "width": this.width,
        "colour": this.#foreground,
        "backgroundColor": this.#background
      },
      "id": this.#id
    });

    if (this.#indeterminate) {
      element.removeAttribute("value");
    }

    this.#parent.appendChild(element);

    if (this.#flashing) {
      this.#start_flashing();
    }
  }

  /** Remove the progress bar from the element */
  destroy() {
    let element = document.getElementById(this.#id);
    if (!element) {
      console.error(`Tried to destroy progress bar ${this.#id}, but element is already missing!`);
      return;
    }

    element.parentNode.removeChild(element);
    this.#stop_flashing();
  }

  /** Edits the progress bar
   * 
   * @param {ProgressOptions} opts
   */
  edit(opts) {
    let resolved_opts = {
      "value": this.value,
      "max": this.max,
      "width": this.width,
      "foreground": this.#foreground,
      "background": this.#background,
      "indeterminate": this.#indeterminate,
      "flashing": this.#flashing,
      "flashing_frequency": this.#flashing_frequency,
      "counting": this.#counting,
      "counting_speed": this.#counting_speed,
      "parent": this.#parent
    };
    Object.assign(resolved_opts, opts);

    this.value = resolved_opts.value;
    this.max = resolved_opts.max;
    this.width = resolved_opts.width;
    this.#parent = resolved_opts.parent;
    this.#foreground = resolved_opts.foreground;
    this.#background = resolved_opts.background;
    this.#indeterminate = resolved_opts.indeterminate;
    this.#flashing = resolved_opts.flashing;
    this.#flashing_frequency = resolved_opts.flashing_frequency;
    this.#counting = resolved_opts.counting;
    this.#counting_speed = resolved_opts.counting_speed;
    this.#parent = resolved_opts.parent;

    this.#update();
  }

  /** Update the progress bar, redrawing it */
  #update() {
    let element = document.getElementById(this.#id);
    if (!element) {
      console.error(`Tried to update progress bar ${this.#id}, but element is missing!`);
      return;
    }

    this.#raw_update();

    element.style.colour = this.#foreground;
    element.style.backgroundColor = this.#background;
    element.width = this.width;
    

    this.#stop_flashing();

    if (this.#flashing) {
      this.#start_flashing();
    }

    if (this.#counting) {
      this.#start_counting();
    } else {
      this.#stop_counting();
    }
  }

  /** Only update the value, indeterminate, and max. Nothing else. */
  #raw_update() {
    let element = document.getElementById(this.#id);
    if (!element) {
      console.error(`Tried to update progress bar ${this.#id}, but element is missing!`);
      return;
    }

    if (this.#indeterminate) {
      element.removeAttribute("value");
    } else {
      element.setAttribute("value", this.value);
    }
    element.setAttribute("max", this.max);
  }

  #flash_function() {
    if (this.#flash_active) {
      this.value = 0;
    } else {
      this.value = 100;
    }
    this.#flash_active = !this.#flash_active;
  }

  #start_flashing() {
    if (this.#flash_interval_id) {
      this.#stop_flashing();
    }

    this.#flash_interval_id = setInterval(this.#flash_function, this.#flashing_frequency/2);
  }

  #stop_flashing() {
    if (this.#flash_interval_id) {
      clearInterval(this.#flash_interval_id);
      this.#flash_interval_id = undefined;
    }
  }

  _count_function() {
    if (this.value >= this.max) {
      this.#stop_counting();
      return;
    } else {
      this.value++;
      this.#raw_update();
      let this_pg = this;
      this.#count_interval_id = setTimeout(function() { this_pg._count_function() }, this.#counting_speed);
    }
  }

  #start_counting() {
    this._count_function();
    this.#count_active = true;
    this.#counting = false;
  }

  #stop_counting() {
    clearTimeout(this.#count_interval_id);
    this.#count_active = false;
    this.#counting = false;
  }
}