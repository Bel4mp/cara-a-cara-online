
const socket = io();

const CHARACTERS = (() => {
  const hairColors = ["black","brown","blonde","red","gray"];
  const skinTones = ["#F2D6CB","#E5B299","#C88E6B","#A86B4E","#7A4B33"];
  const eyeColors = ["brown","blue","green","black"];
  const hairStyles = ["short","long","bald","curly","bun"];
  const names = [
    "Matheus", "Enzo", "Samuel", "Davi", "Lorenzo", "Theo", "Noah", "Gael", "Benício", "Ian", "Oliver", "Heitor", "Arthur", "Miguel", "Vicente", "Isaac", "Levi", "Otávio", "Pietro", "Ravi", "Camila", "Alice", "Rafaela", "Bianca", "Elisa", "Valentina", "Chiara", "Luna", "Mirela", "Ayla", "Melina", "Isadora", "Helena", "Lorena", "Stella", "Nina", "Júlia", "Aurora", "Maitê", "Cecília"
  ];
  const chars = [];
  for (let i=0;i<40;i++) {
    const t = {
      id: i,
      name: names[i],
      skin: skinTones[i % skinTones.length],
      hairColor: hairColors[i % hairColors.length],
      eye: eyeColors[i % eyeColors.length],
      hair: hairStyles[i % hairStyles.length],
      hat: (i % 5 === 0),
      glasses: (i % 3 === 0),
      beard: (i % 2 === 1) && (i % 4 === 0),
      mustache: (i % 2 === 1) && (i % 6 === 0),
      gender: (i < 20) ? "m" : "f"
    };
    if (t.gender === "f") { t.beard = false; t.mustache = false; }
    if (t.hair === "bald") { t.hairColor = "black"; }
    chars.push(t);
  }
  return chars;
})();

const nameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCode");
const btnCreate = document.getElementById("btnCreate");
const btnJoin = document.getElementById("btnJoin");
const lblRoom = document.getElementById("lblRoom");
const lblStatus = document.getElementById("lblStatus");
const lblTurn = document.getElementById("lblTurn");
const chooser = document.getElementById("chooser");
const board = document.getElementById("board");
const legend = document.getElementById("legend");
const btnConfirmSecret = document.getElementById("btnConfirmSecret");
const lblChosen = document.getElementById("lblChosen");
const txtQuestion = document.getElementById("txtQuestion");
const btnAsk = document.getElementById("btnAsk");
const qa = document.getElementById("qa");
const btnYes = document.getElementById("btnYes");
const btnNo = document.getElementById("btnNo");
const guessId = document.getElementById("guessId");
const btnGuess = document.getElementById("btnGuess");
const btnReset = document.getElementById("btnReset");
const chatLog = document.getElementById("chatLog");
const chatMsg = document.getElementById("chatMsg");
const btnChat = document.getElementById("btnChat");

let state = null;
let myId = null;
let selectedSecretId = null;
const cardDown = new Set();

function el(tag, className, children = []) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  for (const c of children) {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function faceSVG(traits) {
  const svgNS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(svgNS, "svg");
  s.setAttribute("viewBox","0 0 100 100");
  s.setAttribute("width","90");
  s.setAttribute("height","90");

  const head = document.createElementNS(svgNS, "circle");
  head.setAttribute("cx","50"); head.setAttribute("cy","50"); head.setAttribute("r","28");
  head.setAttribute("fill", traits.skin);
  s.appendChild(head);

  if (traits.hair !== "bald") {
    const hair = document.createElementNS(svgNS, "path");
    hair.setAttribute("fill", traits.hairColor);
    if (traits.hair === "short") hair.setAttribute("d","M22,45 Q50,15 78,45 L78,38 Q50,8 22,38 Z");
    else if (traits.hair === "long") hair.setAttribute("d","M22,45 Q50,15 78,45 L78,75 Q50,90 22,75 Z");
    else if (traits.hair === "curly") hair.setAttribute("d","M22,45 C30,20 70,20 78,45 C75,50 25,50 22,45 Z");
    else if (traits.hair === "bun") {
      hair.setAttribute("d","M22,45 Q50,15 78,45 Z");
      const bun = document.createElementNS(svgNS, "circle");
      bun.setAttribute("cx","50"); bun.setAttribute("cy","20"); bun.setAttribute("r","8");
      bun.setAttribute("fill", traits.hairColor);
      s.appendChild(bun);
    }
    s.appendChild(hair);
  }

  if (traits.hat) {
    const brim = document.createElementNS(svgNS, "rect");
    brim.setAttribute("x","20"); brim.setAttribute("y","28"); brim.setAttribute("width","60"); brim.setAttribute("height","6");
    brim.setAttribute("fill","#333");
    const top = document.createElementNS(svgNS, "rect");
    top.setAttribute("x","34"); top.setAttribute("y","10"); top.setAttribute("width","32"); top.setAttribute("height","20");
    top.setAttribute("rx","4"); top.setAttribute("fill","#444");
    s.appendChild(top); s.appendChild(brim);
  }

  const eyeFill = traits.eye === "blue" ? "#4ea3ff" : (traits.eye === "green" ? "#4ade80" : "#111");
  const eyeL = document.createElementNS(svgNS, "circle");
  eyeL.setAttribute("cx","40"); eyeL.setAttribute("cy","52"); eyeL.setAttribute("r","3");
  eyeL.setAttribute("fill", eyeFill);
  const eyeR = document.createElementNS(svgNS, "circle");
  eyeR.setAttribute("cx","60"); eyeR.setAttribute("cy","52"); eyeR.setAttribute("r","3");
  eyeR.setAttribute("fill", eyeFill);
  s.appendChild(eyeL); s.appendChild(eyeR);

  if (traits.glasses) {
    const g1 = document.createElementNS(svgNS, "circle");
    g1.setAttribute("cx","40"); g1.setAttribute("cy","52"); g1.setAttribute("r","7");
    g1.setAttribute("fill","none"); g1.setAttribute("stroke","#ddd"); g1.setAttribute("stroke-width","2");
    const g2 = document.createElementNS(svgNS, "circle");
    g2.setAttribute("cx","60"); g2.setAttribute("cy","52"); g2.setAttribute("r","7");
    g2.setAttribute("fill","none"); g2.setAttribute("stroke","#ddd"); g2.setAttribute("stroke-width","2");
    const bridge = document.createElementNS(svgNS, "rect");
    bridge.setAttribute("x","47"); bridge.setAttribute("y","51"); bridge.setAttribute("width","6"); bridge.setAttribute("height","2");
    bridge.setAttribute("fill","#ddd");
    s.appendChild(g1); s.appendChild(g2); s.appendChild(bridge);
  }

  const nose = document.createElementNS(svgNS, "path");
  nose.setAttribute("d","M50,52 q-2,6 2,6");
  nose.setAttribute("stroke","#633"); nose.setAttribute("stroke-width","2"); nose.setAttribute("fill","none");
  s.appendChild(nose);

  const mouth = document.createElementNS(svgNS, "path");
  mouth.setAttribute("d","M42,64 q8,6 16,0");
  mouth.setAttribute("stroke","#922"); mouth.setAttribute("stroke-width","2"); mouth.setAttribute("fill","none");
  s.appendChild(mouth);

  if (traits.beard) {
    const beard = document.createElementNS(svgNS, "path");
    beard.setAttribute("d","M32,66 q18,14 36,0 l0,4 q-18,12 -36,0 z");
    beard.setAttribute("fill","#333"); s.appendChild(beard);
  }
  if (traits.mustache) {
    const st = document.createElementNS(svgNS, "path");
    st.setAttribute("d","M42,60 q8,4 16,0 q-8,6 -16,0");
    st.setAttribute("fill","#333"); s.appendChild(st);
  }
  return s;
}

function renderGrid(container, onClick, downSet=null) {
  container.innerHTML = "";
  CHARACTERS.forEach(ch => {
    const card = el("div","cardlet");
    card.dataset.id = ch.id;
    const f = el("div","face"); f.appendChild(faceSVG(ch));
    const nm = el("div","name",[`${ch.name}`]);
    const id = el("div","id",[`${ch.id}`]);
    const cover = el("div","cover",["VIRADA"]);
    card.appendChild(id); card.appendChild(f); card.appendChild(nm); card.appendChild(cover);
    if (downSet && downSet.has(ch.id)) card.classList.add("down");
    card.onclick = () => onClick(ch.id, card);
    container.appendChild(card);
  });
  legend.innerHTML = "IDs 0–39. Clique nas cartas do tabuleiro para 'virar' quando eliminar possibilidades.";
}

socket.on("connect", () => { myId = socket.id; });

socket.on("state", (st) => {
  state = st;
  lblRoom.textContent = st.code || "—";
  lblStatus.textContent = st.status;
  lblTurn.textContent = st.turnSocketId === myId ? "Você" : (st.turnSocketId ? "Oponente" : "—");

  if (st.status === "waiting") {
    btnConfirmSecret.disabled = true;
  } else if (st.status === "choosing") {
    btnConfirmSecret.disabled = (selectedSecretId == null);
  } else if (st.status === "playing") {
    btnConfirmSecret.disabled = true;
  } else if (st.status === "finished") {
    if (st.winnerSocketId) {
      const win = st.winnerSocketId === myId ? "Você venceu! 🏆" : "Oponente venceu!";
      alert(win);
    }
  }

  const q = st.lastQuestion ? st.lastQuestion.text : null;
  const a = st.lastAnswer ? (st.lastAnswer.yes ? "Sim" : "Não") : null;
  qa.innerHTML = "";
  if (q) qa.appendChild(el("div", null, ["Pergunta: " + q]));
  if (a !== null) qa.appendChild(el("div", null, ["Resposta: " + a]));
});

socket.on("question", (q) => {
  qa.innerHTML = "";
  qa.appendChild(el("div", null, ["Pergunta recebida: " + q]));
});

socket.on("chat", (m) => {
  const who = m.from === myId ? "Você" : "Oponente";
  const line = el("div", null, [`${who}: ${m.text}`]);
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
});

btnCreate.onclick = () => {
  const code = (roomCodeInput.value || "").trim().toUpperCase();
  socket.emit("createRoom", code, (res) => {
    if (!res.ok) return alert(res.error || "Erro ao criar sala.");
    renderGrid(chooser, (id) => {
      selectedSecretId = id;
      lblChosen.textContent = `Selecionado: ${id} - ${CHARACTERS[id].name}`;
      btnConfirmSecret.disabled = false;
    });
    renderGrid(board, (id, card) => {
      if (cardDown.has(id)) { cardDown.delete(id); card.classList.remove("down"); }
      else { cardDown.add(id); card.classList.add("down"); }
    }, cardDown);
    if (nameInput.value) socket.emit("setName", nameInput.value);
  });
};

btnJoin.onclick = () => {
  const code = (roomCodeInput.value || "").trim().toUpperCase();
  if (!code) return alert("Digite o código da sala.");
  socket.emit("joinRoom", code, (res) => {
    if (!res.ok) return alert(res.error || "Erro ao entrar na sala.");
    renderGrid(chooser, (id) => {
      selectedSecretId = id;
      lblChosen.textContent = `Selecionado: ${id} - ${CHARACTERS[id].name}`;
      btnConfirmSecret.disabled = false;
    });
    renderGrid(board, (id, card) => {
      if (cardDown.has(id)) { cardDown.delete(id); card.classList.remove("down"); }
      else { cardDown.add(id); card.classList.add("down"); }
    }, cardDown);
    if (nameInput.value) socket.emit("setName", nameInput.value);
  });
};

btnConfirmSecret.onclick = () => {
  if (selectedSecretId == null) return;
  socket.emit("setSecret", selectedSecretId);
  btnConfirmSecret.disabled = true;
};

btnAsk.onclick = () => {
  const q = (txtQuestion.value || "").trim();
  if (!q) return;
  socket.emit("ask", q);
  txtQuestion.value = "";
};

btnYes.onclick = () => socket.emit("answer", true);
btnNo.onclick = () => socket.emit("answer", false);

btnGuess.onclick = () => {
  const id = Number(guessId.value);
  if (Number.isNaN(id) || id < 0 || id > 39) return alert("Digite um ID entre 0 e 39.");
  socket.emit("guess", id, (res) => {
    if (!res || !res.ok) return;
    if (res.correct === false) alert("Não é esse personagem! Sua vez passou para o oponente.");
  });
};

btnReset.onclick = () => {
  cardDown.clear();
  renderGrid(board, (id, card)=>{
    if (cardDown.has(id)) { cardDown.delete(id); card.classList.remove("down"); }
    else { cardDown.add(id); card.classList.add("down"); }
  }, cardDown);
  selectedSecretId = null;
  lblChosen.textContent = "";
  btnConfirmSecret.disabled = true;
  socket.emit("resetRoom");
};

btnChat.onclick = () => {
  const msg = (chatMsg.value || "").trim();
  if (!msg) return;
  socket.emit("chat", msg);
  chatMsg.value = "";
};

renderGrid(chooser, ()=>{});
renderGrid(board, (id, card)=>{
  if (cardDown.has(id)) { cardDown.delete(id); card.classList.remove("down"); }
  else { cardDown.add(id); card.classList.add("down"); }
}, cardDown);
legend.textContent = "IDs 0–39. Clique para virar.";
