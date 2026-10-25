document.getElementById("langbtn").addEventListener("click", function () {
  var next = document.documentElement.dataset.lang === "vi" ? "en" : "vi";
  document.documentElement.dataset.lang = next;
  document.documentElement.lang = next;
  try { localStorage.setItem("lang", next); } catch (e) {}
});
