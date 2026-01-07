export function Button({ text, onClick, kind = "primary" }) {
  const btn = document.createElement("button");
  btn.className = `btn btn-${kind}`;
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

