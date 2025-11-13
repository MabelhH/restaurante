document.addEventListener("DOMContentLoaded", () => {
  const chatToggle = document.getElementById("chat-toggle");
  const chatModal = document.getElementById("chat-modal");
  const chatClose = document.getElementById("chat-close");
  const chatHeader = document.getElementById("chatHeader");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const adminName = window.ADMIN_NAME || "Admin";

  // --- Abrir / cerrar chat ---
  chatToggle.addEventListener("click", () => {
    chatModal.classList.toggle("hidden");
    if (!chatModal.classList.contains("hidden")) {
      doGreeting();
    }
  });

  chatClose.addEventListener("click", () => {
    chatModal.classList.add("hidden");
  });

  // --- Mensajes ---
  function appendMessage(text, who) {
    const div = document.createElement("div");
    div.className = "msg " + (who === "user" ? "user" : "ai");
    div.textContent = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // --- Saludo inicial ---
  let greeted = false;
  function doGreeting() {
    if (greeted) return;
    greeted = true;
    const greeting = `Hola ${adminName}, soy chefIA. ¿En qué puedo ayudarte hoy?`;
    appendMessage(greeting, "ai");
  }

  // --- Enviar mensaje ---
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage(text, "user");
    chatInput.value = "";

    try {
      const resp = await fetch("/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await resp.json();
      appendMessage(data.reply || "No se recibió respuesta del servidor.", "ai");
    } catch (err) {
      appendMessage("Error de conexión con el servidor.", "ai");
      console.error(err);
    }
  });

  // --- Arrastrar ventana ---
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  chatHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    chatModal.classList.add("dragging");

    const rect = chatModal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    document.body.style.userSelect = "none"; // evitar selección accidental
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    chatModal.style.left = e.clientX - offsetX + "px";
    chatModal.style.top = e.clientY - offsetY + "px";

    // Para que no se mantenga anclado al bottom/right
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