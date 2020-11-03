for(let i = 0; i < 10; i ++){
  document.body.innerHTML += `<div id="itembar-${i}" class="itembar"></div>
  <div id="itembar-number-${i}" class="itembar-number"></div>`;

  const item = document.getElementById("itembar-" + i);
  item.style.left = `calc(50vw + ${-70 * 5 + 70 * i}px)`;
  item.style.display = "none";
  document.getElementById("itembar-number-" + i).style.left = `calc(50vw + ${-70 * 5 + 70 * i}px)`;
}