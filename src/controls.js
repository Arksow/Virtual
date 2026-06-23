for (const id of ["start", "submit"]) {
  const button = document.querySelector(`#${id}`);
  button.style.display = "block";
  button.style.width = "min(78%, 300px)";
  button.style.marginInline = "auto";
}

document.querySelector("#count-readout").style.display = "none";
