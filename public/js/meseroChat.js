document.addEventListener("DOMContentLoaded", () => {
  const chatToggle = document.getElementById("chat-toggle");
  const chatModal = document.getElementById("chat-modal");
  const chatClose = document.getElementById("chat-close");
  const chatHeader = document.querySelector(".chat-header"); //CORREGIDO
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  const meseroName = window.MESERO_NAME || "Mesero";

  // ---------------------------------------
  // ⭐ Abrir / cerrar chat
  // ---------------------------------------
  if (chatToggle) {
    chatToggle.addEventListener("click", () => {
      chatModal.classList.toggle("hidden");
      if (!chatModal.classList.contains("hidden")) {
        doGreeting();
      }
    });
  }

  if (chatClose) {
    chatClose.addEventListener("click", () => {
      chatModal.classList.add("hidden");
    });
  }

  // ---------------------------------------
  // ⭐ Agregar mensajes al chat
  // ---------------------------------------
  function appendMessage(text, who) {
    const div = document.createElement("div");
    div.className = "msg " + (who === "user" ? "user" : "ai");
    div.textContent = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ---------------------------------------
  // ⭐ Saludo inicial automático
  // ---------------------------------------
  let greeted = false;
  function doGreeting() {
    if (greeted) return;
    greeted = true;
    const greeting = `Hola ${meseroName}, soy chefIA. ¿En qué puedo ayudarte hoy?`;
    appendMessage(greeting, "ai");
  }

  // ---------------------------------------
  // ⭐ Enviar mensaje al servidor IA
  // ---------------------------------------
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      appendMessage(text, "user");
      chatInput.value = "";

      try {
        const resp = await fetch("/mesero/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, name: meseroName }),
        });

        if (!resp.ok) throw new Error("Error en la respuesta del servidor");

        const data = await resp.json();
        appendMessage(
          data.reply || "No se recibió respuesta del servidor.",
          "ai"
        );
      } catch (err) {
        console.error(err);
        appendMessage("Error de conexión con el servidor MeseroIA.", "ai");
      }
    });
  }

  // DRAGGABLE
  let isDragging = false;
  let offsetX = 0,
    offsetY = 0;

  if (chatHeader) {
    chatHeader.addEventListener("mousedown", (e) => {
      isDragging = true;
      chatModal.classList.add("dragging");

      const rect = chatModal.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      document.body.style.userSelect = "none";
    });
  }

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    chatModal.style.left = e.clientX - offsetX + "px";
    chatModal.style.top = e.clientY - offsetY + "px";

    chatModal.style.bottom = "auto";
    chatModal.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      chatModal.classList.remove("dragging");
      document.body.style.userSelect = "";
    }
  });
});