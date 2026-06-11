// Hero waitlist form → MailerLite.
// Submits in the background so visitors stay on the page and see an inline
// "thank you" instead of being redirected to MailerLite's own success page.
(function () {
  "use strict";

  var form = document.getElementById("waitlist");
  if (!form) return;

  var note = document.querySelector(".waitlist__note");
  var success = document.querySelector(".waitlist__success");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // application/x-www-form-urlencoded keeps this a "simple" cross-origin
    // request (no CORS preflight), which MailerLite's endpoint accepts.
    var body = new URLSearchParams(new FormData(form));

    fetch(form.action, {
      method: "POST",
      mode: "no-cors",
      body: body,
    }).catch(function () {
      // Opaque response — nothing to read. Ignore network noise.
    });

    // We can't read a no-cors response, so optimistically show success.
    form.hidden = true;
    if (note) note.hidden = true;
    if (success) success.hidden = false;
  });
})();
