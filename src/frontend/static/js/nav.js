import { format_element_text } from "/js/libcommon.js";

fetch("/sup/navbar")
.then(res => res.text())
.then(text => {
  let oldelem = document.querySelector("script#replace_with_navbar");
  let newelem = document.createElement("div");
  newelem.innerHTML = text;
  oldelem.replaceWith(newelem);
});
fetch("/sup/footer")
.then(res => res.text())
.then(text => {
  let oldelem = document.querySelector("div#replace_with_footer");
  let newelem = document.createElement("div");
  newelem.innerHTML = text;
  oldelem.replaceWith(newelem);

  // Now that footer exists, we can fill in the details
  fetch("/api/srv/get/")
    .then(res => res.json())
    .then(data => {
      format_element_text("footer_frontend_p", data["frontend_version"]);
      format_element_text("footer_backend_p", data["api_version"])
    })
})