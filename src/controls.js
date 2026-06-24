for (const id of ["start", "submit"]) {
  const button = document.querySelector(`#${id}`);
  button.style.display = "block";
  button.style.width = "min(78%, 300px)";
  button.style.marginInline = "auto";
}

document.querySelector("#count-readout").style.display = "none";

const colourValues = { GREEN: "#69cf65", BLUE: "#2285df", PINK: "#f73489", ORANGE: "#ff8b25" };
const flashStyle = document.createElement("style");
flashStyle.textContent = ".lamp.flash { background: var(--assigned-flash) !important; box-shadow: 0 0 45px var(--assigned-flash), 0 0 85px var(--assigned-flash) !important; }";
document.head.append(flashStyle);
new MutationObserver(() => {
  const role = document.querySelector("#role-card b")?.textContent ?? "";
  const colour = Object.keys(colourValues).find((name) => role.includes(name));
  if (colour) {
    const lamp = document.querySelector("#lamp");
    lamp.style.setProperty("--assigned-flash", colourValues[colour]);
    lamp.style.borderColor = colourValues[colour];
    lamp.style.boxShadow = `inset 0 0 30px #07162f, 0 0 24px ${colourValues[colour]}55`;
  }
}).observe(document.querySelector("#role-card"), { childList: true, subtree: true, characterData: true });
