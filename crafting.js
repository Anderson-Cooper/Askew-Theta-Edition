const recipes = {
  "Tools": {
    "pick": {"wood": 20, "workbench": "+"}
  },
  "Materials": {
    "steel": {"stone": 5, "oven": "+"},
  },
  "Fire": {
    "fire": {"wood": 50, "stone": 5},
    "oven": {"ash": 5, "stone": 15, "workbench": "+"},
  },
  "Structures": {
    "workbench": {"wood": 20},
    "wall": {"wood": 30, "workbench": "+"},
    "roof": {"wood": 20, "workbench": "+"},
    "steelwall": {"steel": 10, "workbench": "+"},
  }
};

let buttonY = 50;
for (let category in recipes) {
  let newbutton = document.createElement("button");
  newbutton.innerText = category;
  newbutton.classList.add("crafting-button");
  newbutton.style.top = buttonY + "px";
  document.body.appendChild(newbutton);
  buttonY += 50;

  let y = 20;
  for (let recipe in recipes[category]) {
    let x = - (Object.keys(recipes[category][recipe]).length) * 70;

    for (let item in recipes[category][recipe]) {
      let newdiv = document.createElement("div");
      let img = document.createElement("img");
      img.classList.add("crafting-display", "crafting-category-" + category);
      img.src = "./images/item_" + item + ".png";
      newdiv.appendChild(img);
      newdiv.classList.add("crafting-display", "crafting-category-" + category, "crafting");

      newdiv.style.left = "50vw";
      newdiv.style.transform = "translate(" + x + "px, 0px)";
      newdiv.style.top = y + "px";

      document.body.appendChild(newdiv);

      newdiv = document.createElement("div");
      newdiv.innerText = recipes[category][recipe][item];
      newdiv.classList.add("crafting-display", "crafting-category-" + category, "crafting-number");

      newdiv.style.left = "50vw";
      newdiv.style.transform = "translate(" + (x+7) + "px, -2em)";
      newdiv.style.top = y+65 + "px";

      document.body.appendChild(newdiv);

      x += 70;
    }

    let newdiv = document.createElement("div");
    newdiv.innerText = "=";
    newdiv.classList.add("crafting-display", "crafting-category-" + category, "craftingeq");
    newdiv.style.left = "50vw";
    newdiv.style.transform = "translate(" + (x+35/2) + "px, -0.25em)";
    newdiv.style.top = y + "px";
    document.body.appendChild(newdiv);

    x += 70;

    newdiv = document.createElement("div");
    let img = document.createElement("img");
    img.src = "./images/item_" + recipe + ".png";
    img.classList.add("crafting-display", "crafting-category-" + category);
    newdiv.appendChild(img);
    newdiv.classList.add("crafting-display", "crafting-category-" + category, "crafting");
    newdiv.style.left = "50vw";
    newdiv.style.transform = "translate(" + x + "px, 0px)";
    newdiv.style.top = y + "px";
    document.body.appendChild(newdiv);

    y += 70;
  }
}